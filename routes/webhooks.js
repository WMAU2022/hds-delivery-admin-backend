const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const suburbsStore = require('../lib/suburbs-sync-store');

// Format delivery time slot with hours
function formatDeliveryTime(deliveryTime) {
  if (deliveryTime === 'AM' || deliveryTime === 'am') {
    return '12:00 AM - 7:00 AM';
  } else if (deliveryTime === 'Business Hours' || deliveryTime === 'business hours') {
    return '8:00 AM - 6:00 PM';
  }
  return deliveryTime; // Fallback to original if not recognized
}

// Shopify webhook signature verification
function verifyShopifyWebhook(req, secret) {
  const hmac = req.get('X-Shopify-Hmac-SHA256');
  const body = req.rawBody || '';
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return hash === hmac;
}

// Parse HDS delivery data from order note/attributes
function extractHDSData(order) {
  try {
    // Try to find HDS data in custom attributes
    if (order.note_attributes && Array.isArray(order.note_attributes)) {
      const hdsAttr = order.note_attributes.find(attr => 
        attr.name === 'hds_delivery_data'
      );
      
      if (hdsAttr && hdsAttr.value) {
        return JSON.parse(hdsAttr.value);
      }
    }

    // Fallback: check order note
    if (order.note && order.note.includes('HDS:')) {
      const match = order.note.match(/HDS:\s*({.*})/);
      if (match) {
        return JSON.parse(match[1]);
      }
    }
  } catch (err) {
    console.error('Error parsing HDS data:', err);
  }

  return null;
}

// Update line items with delivery properties via Shopify API
async function updateLineItemsWithDeliveryData(orderId, hdsData) {
  try {
    if (!hdsData || !hdsData.delivery_date) {
      console.log('⚠️ Incomplete HDS data (missing delivery_date), skipping line item update');
      return false;
    }

    // Ensure delivery_time is formatted
    if (hdsData.delivery_time && !hdsData.delivery_time.includes(':')) {
      // If not yet formatted, format it now
      hdsData.delivery_time = formatDeliveryTime(hdsData.delivery_time);
    }

    const shopifyToken = process.env.SHOPIFY_ADMIN_TOKEN;
    let shopifyStore = process.env.SHOPIFY_STORE;

    if (!shopifyToken || !shopifyStore) {
      console.error('Missing Shopify credentials');
      return false;
    }

    // Remove trailing slash from SHOPIFY_STORE to prevent double slashes in URL
    shopifyStore = shopifyStore.replace(/\/$/, '');

    // Get order details first
    const getOrderUrl = `https://${shopifyStore}/admin/api/2024-01/orders/${orderId}.json`;
    
    const orderResponse = await axios.get(getOrderUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    });

    const order = orderResponse.data.order;
    
    if (!order.line_items || order.line_items.length === 0) {
      console.log('No line items to update');
      return false;
    }

    // Update each line item with delivery properties
    // hdsData.delivery_time is already formatted (e.g., "8:00 AM - 6:00 PM" or "12:00 AM - 7:00 AM")
    // hdsData.production_date is pack_date - 1 day (calculated on backend)
    // hdsData.location is the region/delivery area
    const updatedLineItems = order.line_items.map(item => ({
      id: item.id,
      properties: {
        'Delivery Date': hdsData.delivery_date,
        'Pack Date': hdsData.pack_date || hdsData.delivery_date,
        'Production Date': hdsData.production_date,
        'Delivery Time': hdsData.delivery_time,
        'Location': hdsData.location,
      },
    }));

    // Call Shopify's line item update endpoint
    const updateUrl = `https://${shopifyStore}/admin/api/2024-01/orders/${orderId}.json`;
    
    const updateResponse = await axios.put(
      updateUrl,
      {
        order: {
          id: orderId,
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

    console.log('✅ Line items updated with delivery data:', {
      orderId,
      lineItemCount: updatedLineItems.length,
      deliveryDate: hdsData.delivery_date,
      packDate: hdsData.pack_date,
      productionDate: hdsData.production_date,
      deliveryTime: hdsData.delivery_time,
      location: hdsData.location,
      note: 'Times formatted as "8:00 AM - 6:00 PM" or "12:00 AM - 7:00 AM"',
    });

    return true;
  } catch (err) {
    console.error('❌ Error updating line items:', {
      error: err.message,
      orderId,
    });
    return false;
  }
}

// Enrich order with HDS delivery data from note_attributes
async function enrichOrderWithHDSData(order) {
  try {
    const pool = require('../lib/db');
    
    // Extract basic delivery info from note_attributes
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
      console.log('⚠️ Missing delivery date or location ID in note_attributes');
      return null;
    }

    // Query suburbs to find region by postcode
    // Try in-memory store first (6942 suburbs from HDS sync)
    let suburb = null;
    
    try {
      if (suburbsStore && typeof suburbsStore.findByPostcode === 'function') {
        suburb = suburbsStore.findByPostcode(deliveryLocationId.toString());
      }
    } catch (e) {
      console.warn(`⚠️ Suburbs store lookup failed: ${e.message}`);
    }
    
    // Fallback to PostgreSQL if not found in memory
    if (!suburb) {
      try {
        const suburbResult = await pool.query(
          `SELECT id, name, region_id FROM suburbs WHERE postcode::text = $1 LIMIT 1`,
          [deliveryLocationId]
        );
        if (suburbResult.rows.length > 0) {
          suburb = suburbResult.rows[0];
        }
      } catch (dbError) {
        console.warn(`⚠️ Database lookup failed: ${dbError.message}`);
      }
    }

    if (!suburb) {
      console.log(`⚠️ Suburb not found for postcode: ${deliveryLocationId}`);
      return null;
    }
    const regionId = suburb.region_id;

    // Get region info
    const regionResult = await pool.query(
      `SELECT id, name FROM regions WHERE id = $1`,
      [regionId]
    );

    const region = regionResult.rows[0] || { id: regionId, name: 'Unknown Region' };

    // Parse delivery date and find matching schedule
    console.log(`📦 DEBUG: deliveryDate value = "${deliveryDate}" (type: ${typeof deliveryDate})`);
    
    // Validate and parse date
    let deliveryDateObj;
    try {
      // Handle different date formats
      const cleanDate = String(deliveryDate).trim();
      if (!cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error(`Invalid date format: ${cleanDate}. Expected YYYY-MM-DD`);
        return null;
      }
      deliveryDateObj = new Date(cleanDate + 'T00:00:00Z');
      console.log(`✅ Parsed deliveryDateObj: ${deliveryDateObj.toISOString()}, time=${deliveryDateObj.getTime()}`);
      
      if (isNaN(deliveryDateObj.getTime())) {
        console.error(`Invalid date value after parsing: ${cleanDate}`);
        return null;
      }
    } catch (dateErr) {
      console.error(`Date parsing error: ${dateErr.message}`);
      return null;
    }
    
    const deliveryDayNum = deliveryDateObj.getDay();
    console.log(`📅 Delivery day number: ${deliveryDayNum}`);
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const deliveryDayName = dayMap[deliveryDayNum];
    
    // Get schedule for this region and delivery day
    const scheduleResult = await pool.query(
      `SELECT * FROM delivery_schedules WHERE region_id = $1 AND delivery_day = $2 AND enabled = true LIMIT 1`,
      [regionId, deliveryDayNum]
    );

    if (scheduleResult.rows.length === 0) {
      console.log(`⚠️ No schedule found for ${deliveryDayName} in region ${region.name}`);
      return null;
    }

    const schedule = scheduleResult.rows[0];
    console.log(`📅 Found schedule: id=${schedule.id}, pack_day=${schedule.pack_day}, pack_day type=${typeof schedule.pack_day}`);

    // Calculate pack date from schedule
    // Note: pack_day is stored in database as a NUMBER (0-6), not a string
    const packDayNum = typeof schedule.pack_day === 'string' 
      ? parseInt(schedule.pack_day) 
      : schedule.pack_day;
    
    const dayDifference = (deliveryDayNum - packDayNum + 7) % 7;
    console.log(`📅 Pack day number: ${packDayNum}, dayDifference=${dayDifference}`);
    
    const packDateObj = new Date(deliveryDateObj);
    console.log(`✅ Created packDateObj copy: ${packDateObj.toISOString()}`);
    
    try {
      packDateObj.setDate(packDateObj.getDate() - dayDifference);
      console.log(`✅ Set pack date: ${packDateObj.toISOString()}`);
    } catch (setErr) {
      console.error(`❌ Error setting pack date: ${setErr.message}`);
      return null;
    }

    // Calculate production date (1 day before pack date)
    const productionDateObj = new Date(packDateObj);
    try {
      productionDateObj.setDate(productionDateObj.getDate() - 1);
      console.log(`✅ Set production date: ${productionDateObj.toISOString()}`);
    } catch (prodErr) {
      console.error(`❌ Error setting production date: ${prodErr.message}`);
      return null;
    }

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
      hds_schedule_id: schedule.id.toString(),
      hds_pack_date: formatDate(packDateObj),
      hds_production_date: formatDate(productionDateObj),
      hds_region: region.name,
      hds_suburb: suburb.name,
      hds_postcode: deliveryLocationId,
    };
  } catch (err) {
    console.error('❌ Error enriching order with HDS data:', err.message);
    return null;
  }
}

// Update order note_attributes with HDS enriched data
async function updateOrderNoteAttributes(orderId, hdsData) {
  try {
    const shopifyToken = process.env.SHOPIFY_ADMIN_TOKEN;
    let shopifyStore = process.env.SHOPIFY_STORE;

    if (!shopifyToken || !shopifyStore) {
      console.error('Missing Shopify credentials');
      return false;
    }

    // Remove trailing slash from SHOPIFY_STORE to prevent double slashes in URL
    shopifyStore = shopifyStore.replace(/\/$/, '');

    const getOrderUrl = `https://${shopifyStore}/admin/api/2024-01/orders/${orderId}.json`;
    const orderResponse = await axios.get(getOrderUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    });

    const order = orderResponse.data.order;

    // Merge existing note_attributes with new HDS data
    const updatedAttributes = order.note_attributes ? [...order.note_attributes] : [];

    // Add or update HDS attributes
    for (const [key, value] of Object.entries(hdsData)) {
      const existingIndex = updatedAttributes.findIndex(attr => attr.name === key);
      if (existingIndex >= 0) {
        updatedAttributes[existingIndex].value = value;
      } else {
        updatedAttributes.push({ name: key, value: value });
      }
    }

    // Update order with new note_attributes
    const updateUrl = `https://${shopifyStore}/admin/api/2024-01/orders/${orderId}.json`;
    await axios.put(
      updateUrl,
      {
        order: {
          id: orderId,
          note_attributes: updatedAttributes,
        },
      },
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Order note_attributes updated with HDS data:', {
      orderId,
      hds_delivery_date: hdsData.hds_delivery_date,
      hds_schedule_id: hdsData.hds_schedule_id,
      hds_pack_date: hdsData.hds_pack_date,
      hds_production_date: hdsData.hds_production_date,
    });

    return true;
  } catch (err) {
    console.error('❌ Error updating order note_attributes:', err.message);
    return false;
  }
}

// Main webhook handler for orders/create
router.post('/shopify/orders/create', async (req, res) => {
  try {
    // Verify webhook signature
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (webhookSecret && !verifyShopifyWebhook(req, webhookSecret)) {
      console.warn('⚠️ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const order = req.body;
    const orderId = order.id;

    console.log(`📦 Order created webhook received: #${order.name}`);

    // Check if this is a delivery order (has Delivery-Date in note_attributes)
    const hasDeliveryDate = order.note_attributes && order.note_attributes.some(
      attr => attr.name === 'Delivery-Date'
    );

    if (hasDeliveryDate) {
      console.log('🔍 Detected delivery order - enriching with HDS data...');
      const hdsData = await enrichOrderWithHDSData(order);
      
      if (hdsData) {
        await updateOrderNoteAttributes(orderId, hdsData);
      }
    } else {
      console.log('ℹ️ No delivery date in order (standard checkout)');
    }

    // Always respond with 200 to acknowledge webhook receipt
    res.status(200).json({ success: true, orderId });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(200).json({ success: false, error: err.message });
  }
});

/**
 * POST /webhooks/loop/order-created
 * Webhook from Loop when a subscription auto-charge creates an order
 * Handles offset calculation and HDS delivery data attachment
 */
router.post('/loop/order-created', async (req, res) => {
  const pool = require('../lib/db');
  const { calculateNextDeliveryDate } = require('../lib/offset-calculator');

  // Acknowledge immediately (Loop expects 200 quickly)
  res.status(200).json({ processed: true });

  try {
    const { data } = req.body;
    if (!data || !data.order) return;

    const order = data.order;
    const loopSubscriptionId = order.subscription_id;

    // Skip if not from subscription
    if (!loopSubscriptionId) return;

    // Check idempotency
    const existing = await pool.query(
      'SELECT id FROM subscription_auto_charges WHERE loop_order_id = $1',
      [order.id]
    );
    if (existing.rows.length > 0) return;

    // Get subscription mapping
    const mappingResult = await pool.query(
      `SELECT m.*, d.delivery_day FROM subscription_hds_mapping m
       LEFT JOIN delivery_schedules d ON m.hds_schedule_id = d.id
       WHERE m.loop_subscription_id = $1 AND m.active = true`,
      [loopSubscriptionId]
    );

    if (!mappingResult.rows.length) {
      await pool.query(
        `INSERT INTO subscription_auto_charges (loop_subscription_id, loop_order_id, status, error_message, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [loopSubscriptionId, order.id, 'failed', 'No HDS mapping found']
      );
      return;
    }

    const mapping = mappingResult.rows[0];
    const deliveryDates = calculateNextDeliveryDate(mapping.delivery_day, mapping.offset_days);

    // Log the charge
    await pool.query(
      `INSERT INTO subscription_auto_charges (loop_subscription_id, loop_order_id, shopify_order_id, 
       next_delivery_date, charge_date, offset_days, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        loopSubscriptionId,
        order.id,
        order.shopify_order_id,
        deliveryDates.next_delivery_date,
        deliveryDates.charge_date,
        mapping.offset_days,
        'processed'
      ]
    );

    console.log(`✅ Loop order ${order.id} processed: delivery ${deliveryDates.next_delivery_date}`);

  } catch (error) {
    console.error('❌ Loop webhook error:', error.message);
  }
});

module.exports = router;
