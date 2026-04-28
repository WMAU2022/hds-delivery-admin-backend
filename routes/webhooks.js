const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

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
    const shopifyStore = process.env.SHOPIFY_STORE;

    if (!shopifyToken || !shopifyStore) {
      console.error('Missing Shopify credentials');
      return false;
    }

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
    const updatedLineItems = order.line_items.map(item => ({
      id: item.id,
      properties: {
        'Delivery Date': hdsData.delivery_date,
        'Pack Date': hdsData.pack_date || hdsData.delivery_date,
        'Delivery Time': hdsData.delivery_time,
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
      deliveryTime: hdsData.delivery_time,
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

    // Extract HDS delivery data from order
    const hdsData = extractHDSData(order);

    if (hdsData) {
      console.log('✅ HDS delivery data found in order');
      // Update line items with delivery properties
      await updateLineItemsWithDeliveryData(orderId, hdsData);
    } else {
      console.log('ℹ️ No HDS delivery data in order (standard checkout)');
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
