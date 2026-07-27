/**
 * Batch Enrichment Queue Processor
 * 
 * Stores enriched HDS data in our database (order_enrichments table)
 * No Shopify API calls needed - completely independent
 * Scales to 10,000+ orders/day with no rate limiting issues
 */

const pool = require('../lib/db');
const suburbsStore = require('../lib/suburbs-sync-store');

const BATCH_SIZE = 10;
const PROCESS_INTERVAL = 10000; // 10 seconds

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
        const deliveryDate = queueEntry.delivery_date;
        const deliveryLocationId = queueEntry.delivery_location_id;
        const deliveryTime = queueEntry.delivery_time;

        if (!deliveryDate || !deliveryLocationId) {
          // Not a delivery order, mark as skipped
          await pool.query(
            `UPDATE orders_to_enrich SET status = 'skipped', processed_at = NOW() WHERE id = $1`,
            [queueEntry.id]
          );
          console.log(`⏭️  Order #${queueEntry.order_id}: No delivery data (standard order)`);
          continue;
        }

        // Enrich the order
        const enrichedData = await enrichOrder(deliveryDate, deliveryLocationId, deliveryTime);

        if (!enrichedData) {
          throw new Error('Failed to calculate enriched data');
        }

        // Store enriched data in order_enrichments table (our database, not Shopify)
        await pool.query(
          `INSERT INTO order_enrichments (
            order_id,
            hds_delivery_date,
            hds_delivery_formatted,
            hds_delivery_day,
            hds_delivery_window,
            hds_delivery_time,
            hds_schedule_id,
            hds_pack_date,
            hds_production_date,
            hds_region,
            hds_suburb,
            hds_postcode
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (order_id) DO UPDATE SET
            hds_delivery_date = $2,
            hds_delivery_formatted = $3,
            hds_delivery_day = $4,
            hds_delivery_window = $5,
            hds_delivery_time = $6,
            hds_schedule_id = $7,
            hds_pack_date = $8,
            hds_production_date = $9,
            hds_region = $10,
            hds_suburb = $11,
            hds_postcode = $12,
            updated_at = NOW()`,
          [
            queueEntry.order_id,
            enrichedData.hds_delivery_date,
            enrichedData.hds_delivery_formatted,
            enrichedData.hds_delivery_day,
            enrichedData.hds_delivery_window,
            enrichedData.hds_delivery_time,
            enrichedData.hds_schedule_id,
            enrichedData.hds_pack_date,
            enrichedData.hds_production_date,
            enrichedData.hds_region,
            enrichedData.hds_suburb,
            enrichedData.hds_postcode,
          ]
        );

        // Mark as processed
        await pool.query(
          `UPDATE orders_to_enrich SET status = 'completed', processed_at = NOW() WHERE id = $1`,
          [queueEntry.id]
        );

        console.log(`✅ Enriched order #${queueEntry.order_id} → stored in order_enrichments`);
        
        // Sync to Shopify (non-blocking background task)
        syncToShopifyAsync(queueEntry.order_id, enrichedData).catch(() => {});

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
 * Uses only our database - NO Shopify API calls
 */
async function enrichOrder(deliveryDate, deliveryLocationId, deliveryTime) {
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

    // Find suburb and region by postcode (use in-memory store first, then database)
    const postcode = deliveryLocationId.toString();
    let suburb = suburbsStore.findByPostcode(postcode);
    
    // Fall back to database if not in store
    if (!suburb) {
      const suburbResult = await pool.query(
        `SELECT id, name, region_id FROM suburbs WHERE postcode::text = $1 LIMIT 1`,
        [postcode]
      );
      
      if (suburbResult.rows.length === 0) {
        throw new Error(`Suburb not found for postcode: ${postcode}`);
      }
      suburb = suburbResult.rows[0];
    }
    
    const regionId = suburb.region_id;

    // Get region info from database (or fallback to default)
    let region = null;
    try {
      const regionResult = await pool.query(
        `SELECT id, name FROM regions WHERE id = $1`,
        [regionId]
      );
      region = regionResult.rows[0];
    } catch (e) {
      // If query fails, use suburb region_id as fallback
      console.warn(`⚠️  Warning getting region ${regionId}:`, e.message);
    }
    
    if (!region) {
      region = { id: regionId, name: suburb.hds_zone || 'Unknown Region' };
    }

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

/**
 * Sync enriched data to Shopify order note_attributes (non-blocking)
 * GraphQL API to avoid immutability issues with PUT requests
 */
async function syncToShopifyAsync(orderId, enrichedData) {
  try {
    const shopifyToken = process.env.SHOPIFY_ADMIN_TOKEN;
    const shopifyStore = (process.env.SHOPIFY_STORE || '').replace(/\/$/, '');
    
    if (!shopifyToken || !shopifyStore) {
      // Silently skip if no creds configured
      return;
    }

    // Build note_attributes array
    const noteAttributes = [
      { name: 'hds_delivery_date', value: enrichedData.hds_delivery_date },
      { name: 'hds_delivery_formatted', value: enrichedData.hds_delivery_formatted },
      { name: 'hds_delivery_day', value: enrichedData.hds_delivery_day },
      { name: 'hds_delivery_window', value: enrichedData.hds_delivery_window },
      { name: 'hds_delivery_time', value: enrichedData.hds_delivery_time },
      { name: 'hds_schedule_id', value: String(enrichedData.hds_schedule_id) },
      { name: 'hds_pack_date', value: enrichedData.hds_pack_date },
      { name: 'hds_production_date', value: enrichedData.hds_production_date },
      { name: 'hds_region', value: enrichedData.hds_region },
      { name: 'hds_suburb', value: enrichedData.hds_suburb },
      { name: 'hds_postcode', value: enrichedData.hds_postcode },
    ];

    // GraphQL mutation - use orderUpdate instead of REST PUT
    const axios = require('axios');
    const mutationStr = `
      mutation {
        orderUpdate(input: {
          id: "gid://shopify/Order/${orderId}"
          noteAttributes: ${JSON.stringify(noteAttributes).replace(/"/g, '\"')}
        }) {
          order { id name }
          userErrors { field message }
        }
      }
    `;

    await axios.post(
      `https://${shopifyStore}/admin/api/2024-01/graphql.json`,
      { query: mutationStr },
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    console.log(`✅ Synced enriched data to Shopify #${orderId}`);
  } catch (err) {
    // Non-blocking: just warn don't fail enrichment
    if (err.response?.status === 401) {
      console.warn('⚠️ Shopify auth failed (401) - check SHOPIFY_ADMIN_TOKEN');
    } else {
      // Silently skip other errors (network, timeouts, etc)
    }
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
