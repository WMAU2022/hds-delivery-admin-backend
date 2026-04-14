const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

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
    if (!hdsData || !hdsData.delivery_date || !hdsData.delivery_time) {
      console.log('⚠️ Incomplete HDS data, skipping line item update');
      return false;
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
    const updatedLineItems = order.line_items.map(item => ({
      id: item.id,
      properties: {
        'Delivery Date': hdsData.delivery_date,
        'Delivery Time Window': hdsData.delivery_time,
        'Pick-Pack Date': hdsData.pick_pack_date || hdsData.delivery_date,
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
      deliveryData: hdsData,
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

module.exports = router;
