/**
 * Batch Enrichment Queue Processor
 * 
 * Processes orders needing HDS enrichment in batches
 * Respects Shopify API rate limits (~2 calls/sec)
 * Runs every 10 seconds, processes up to 10 orders per run
 */

const pool = require('../lib/db');
const axios = require('axios');

const BATCH_SIZE = 10;
const PROCESS_INTERVAL = 10000; // 10 seconds
const SHOPIFY_RATE_LIMIT = 2; // calls per second

let isProcessing = false;

async function enrichOrderFromQueue() {
  if (isProcessing) {
    console.log('⏳ Enrichment already running, skipping...');
    return;
  }

  isProcessing = true;

  try {
    // Fetch pending orders from queue
    const pendingResult = await pool.query(
      `SELECT * FROM orders_to_enrich 
       WHERE status = 'pending' 
       ORDER BY created_at ASC 
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (pendingResult.rows.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`📦 Processing ${pendingResult.rows.length} orders from enrichment queue...`);

    const orders = pendingResult.rows;

    // Process each order
    for (const queueEntry of orders) {
      try {
        // Get Shopify order details
        const shopifyToken = process.env.SHOPIFY_ADMIN_TOKEN;
        const shopifyStore = process.env.SHOPIFY_STORE?.replace(/\/$/, '');

        if (!shopifyToken || !shopifyStore) {
          throw new Error('Missing Shopify credentials');
        }

        const orderResponse = await axios.get(
          `https://${shopifyStore}/admin/api/2026-07/orders/${queueEntry.order_id}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
          }
        );

        const order = orderResponse.data.order;

        // Extract delivery date from note_attributes
        let deliveryDate = null;
        let deliveryLocationId = null;
        let deliveryTime = null;

        if (order.note_attributes && Array.isArray(order.note_attributes)) {
          for (const attr of order.note_attributes) {
            if (attr.name === 'Delivery-Date') deliveryDate = attr.value;
            if (attr.name === 'Delivery-Location-Id') deliveryLocationId = attr.value;
            if (attr.name === 'Delivery-Time') deliveryTime = attr.value;
          }
        }

        if (!deliveryDate || !deliveryLocationId) {
          // Not a delivery order, mark as processed
          await pool.query(
            `UPDATE orders_to_enrich SET status = 'skipped', processed_at = NOW() WHERE id = $1`,
            [queueEntry.id]
          );
          console.log(`⏭️  Order #${queueEntry.order_id}: No delivery date (standard order)`);
          continue;
        }

        // Enrich the order (same logic as before)
        const enrichedData = await enrichOrder(order, deliveryDate, deliveryLocationId, deliveryTime);

        if (!enrichedData) {
          throw new Error('Failed to calculate enriched data');
        }

        // Update order with enriched line item properties
        if (order.line_items && order.line_items.length > 0) {
          const updatedLineItems = order.line_items.map(item => ({
            id: item.id,
            properties: {
              'Delivery Date': enrichedData.hds_delivery_date,
              'Pack Date': enrichedData.hds_pack_date,
              'Production Date': enrichedData.hds_production_date,
              'Delivery Time': enrichedData.hds_delivery_time,
              'Location': enrichedData.hds_region,
              'Delivery Day': enrichedData.hds_delivery_day,
              'Schedule ID': enrichedData.hds_schedule_id,
            },
          }));

          await axios.put(
            `https://${shopifyStore}/admin/api/2026-07/orders/${queueEntry.order_id}.json`,
            {
              order: {
                id: queueEntry.order_id,
                line_items: updatedLineItems,
              },
            },
            {
              headers: {
                'X-Shopify-Access-Token': shopifyToken,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Mark as processed
        await pool.query(
          `UPDATE orders_to_enrich SET status = 'completed', processed_at = NOW() WHERE id = $1`,
          [queueEntry.id]
        );

        console.log(`✅ Enriched order #${queueEntry.order_id}`);

        // Rate limit: wait between API calls
        await new Promise(resolve => setTimeout(resolve, 1000 / SHOPIFY_RATE_LIMIT));

      } catch (err) {
        console.error(`❌ Error enriching order #${queueEntry.order_id}:`, err.message);

        // Increment retry count
        const newRetryCount = (queueEntry.retry_count || 0) + 1;
        const status = newRetryCount >= 3 ? 'failed' : 'pending';

        await pool.query(
          `UPDATE orders_to_enrich 
           SET status = $1, retry_count = $2, error_message = $3, processed_at = NOW() 
           WHERE id = $4`,
          [status, newRetryCount, err.message, queueEntry.id]
        );
      }
    }

  } catch (err) {
    console.error('❌ Queue processor error:', err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Enrich order with HDS delivery data
 * (Same logic as webhook enrichment)
 */
async function enrichOrder(order, deliveryDate, deliveryLocationId, deliveryTime) {
  try {
    // Parse delivery date
    const cleanDate = String(deliveryDate).trim();
    if (!cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error(`Invalid date format: ${cleanDate}`);
    }

    const deliveryDateObj = new Date(cleanDate + 'T00:00:00Z');
    if (isNaN(deliveryDateObj.getTime())) {
      throw new Error(`Invalid date value: ${cleanDate}`);
    }

    const deliveryDayNum = deliveryDateObj.getDay();
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const deliveryDayName = dayMap[deliveryDayNum];

    // Find suburb and region by postcode
    const suburbResult = await pool.query(
      `SELECT id, name, region_id FROM suburbs WHERE postcode::text = $1 LIMIT 1`,
      [deliveryLocationId.toString()]
    );

    if (suburbResult.rows.length === 0) {
      throw new Error(`Suburb not found for postcode: ${deliveryLocationId}`);
    }

    const suburb = suburbResult.rows[0];
    const regionId = suburb.region_id;

    // Get region info
    const regionResult = await pool.query(
      `SELECT id, name FROM regions WHERE id = $1`,
      [regionId]
    );

    const region = regionResult.rows[0] || { id: regionId, name: 'Unknown Region' };

    // Find delivery schedule
    const scheduleResult = await pool.query(
      `SELECT * FROM delivery_schedules 
       WHERE region_id = $1 AND delivery_day = $2 AND enabled = true 
       LIMIT 1`,
      [regionId, deliveryDayNum]
    );

    if (scheduleResult.rows.length === 0) {
      throw new Error(`No schedule found for ${deliveryDayName} in ${region.name}`);
    }

    const schedule = scheduleResult.rows[0];
    const packDayNum = typeof schedule.pack_day === 'string' 
      ? parseInt(schedule.pack_day) 
      : schedule.pack_day;

    // Calculate pack and production dates
    const dayDifference = (deliveryDayNum - packDayNum + 7) % 7;
    const packDateObj = new Date(deliveryDateObj);
    packDateObj.setDate(packDateObj.getDate() - dayDifference);

    const productionDateObj = new Date(packDateObj);
    productionDateObj.setDate(productionDateObj.getDate() - 1);

    const formatDate = (date) => date.toISOString().split('T')[0];

    return {
      hds_delivery_date: deliveryDate,
      hds_delivery_formatted: deliveryDateObj.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      hds_delivery_day: deliveryDayName,
      hds_delivery_window: deliveryTime && deliveryTime.includes('12:00 AM') ? 'AM' : 'BUSINESS_HOURS',
      hds_delivery_time: deliveryTime,
      hds_schedule_id: schedule.id.toString(),
      hds_pack_date: formatDate(packDateObj),
      hds_production_date: formatDate(productionDateObj),
      hds_region: region.name,
      hds_suburb: suburb.name,
      hds_postcode: deliveryLocationId,
    };
  } catch (err) {
    console.error('Error enriching order:', err.message);
    return null;
  }
}

// Initialize queue processor
function initQueueProcessor() {
  console.log('⏰ Order enrichment queue processor scheduled (every 10 seconds)');
  setInterval(enrichOrderFromQueue, PROCESS_INTERVAL);
  
  // Run immediately on startup
  enrichOrderFromQueue();
}

module.exports = {
  initQueueProcessor,
  enrichOrderFromQueue,
};
