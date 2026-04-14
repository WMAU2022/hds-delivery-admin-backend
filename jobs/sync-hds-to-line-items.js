/**
 * Sync HDS Delivery Data to Shopify Line Item Properties
 * 
 * This job runs periodically (every 5 minutes) to:
 * 1. Fetch recent orders from Shopify
 * 2. Find orders with HDS data in attributes
 * 3. Update line items with HDS delivery properties
 * 4. Mark orders as processed
 * 
 * This is more reliable than waiting for webhooks
 */

const axios = require('axios');
require('dotenv').config({ path: './hds-delivery-admin-backend/.env' });

const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

// Track processed orders to avoid re-processing
const processedOrders = new Set();

async function getRecentOrders() {
  try {
    if (!SHOPIFY_ADMIN_TOKEN || !SHOPIFY_STORE) {
      console.error('Missing Shopify credentials');
      return [];
    }

    // Get orders from last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&created_at_min=${thirtyMinutesAgo}&limit=50&fields=id,name,line_items,note_attributes,created_at`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
      },
    });

    return response.data.orders || [];
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    return [];
  }
}

function extractHDSData(order) {
  try {
    if (!order.note_attributes) return null;

    const hdsAttr = order.note_attributes.find(attr => attr.name === 'hds_delivery_data');
    if (hdsAttr) {
      return JSON.parse(hdsAttr.value);
    }

    // Also check individual attributes
    const dateAttr = order.note_attributes.find(attr => attr.name === 'hds_delivery_date');
    const timeAttr = order.note_attributes.find(attr => attr.name === 'hds_delivery_time');

    if (dateAttr && timeAttr) {
      return {
        delivery_date: dateAttr.value,
        delivery_time: timeAttr.value,
      };
    }
  } catch (err) {
    console.error('Error parsing HDS data:', err.message);
  }

  return null;
}

async function updateLineItemsWithHDSData(orderId, hdsData) {
  try {
    if (!hdsData || !hdsData.delivery_date) {
      return false;
    }

    const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders/${orderId}.json`;

    const updateResponse = await axios.put(
      url,
      {
        order: {
          line_items: [
            {
              properties: {
                'Delivery Date': hdsData.delivery_date,
                'Delivery Time Window': hdsData.delivery_time || 'TBD',
                'Pick-Pack Date': hdsData.pick_pack_date || hdsData.delivery_date,
              },
            },
          ],
        },
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Updated order #${orderId} with HDS delivery data`);
    return true;
  } catch (error) {
    if (error.response?.status === 422) {
      // Shopify API limitation: can't update individual line item properties via PUT
      // This is a known issue. We need to use a workaround or GraphQL API
      console.warn(`⚠️ Order #${orderId} - REST API can't update line properties directly`);
      return false;
    }
    console.error(`Error updating order #${orderId}:`, error.message);
    return false;
  }
}

async function syncOrders() {
  console.log('\n📦 Checking for orders with HDS delivery data...');

  const orders = await getRecentOrders();
  if (orders.length === 0) {
    console.log('No recent orders found');
    return;
  }

  console.log(`Found ${orders.length} recent orders`);

  let processed = 0;
  let skipped = 0;

  for (const order of orders) {
    const orderId = order.id;

    // Skip if already processed
    if (processedOrders.has(orderId)) {
      skipped++;
      continue;
    }

    const hdsData = extractHDSData(order);

    if (hdsData) {
      console.log(`\n📋 Order #${order.name} has HDS data:`, {
        delivery_date: hdsData.delivery_date,
        delivery_time: hdsData.delivery_time,
      });

      const updated = await updateLineItemsWithHDSData(orderId, hdsData);
      if (updated) {
        processedOrders.add(orderId);
        processed++;
      }
    }
  }

  console.log(`\nSummary: ${processed} updated, ${skipped} skipped, ${orders.length - processed - skipped} no HDS data`);
}

// Run sync immediately and then every 5 minutes
console.log('🚀 HDS Line Items Sync Job Started');
syncOrders();
setInterval(syncOrders, 5 * 60 * 1000);
