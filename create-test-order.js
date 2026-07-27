const axios = require('axios');
const fs = require('fs');

async function createTestOrder() {
  const token = JSON.parse(fs.readFileSync('../.shopify-staging-token.json', 'utf8'));
  const store = token.store;
  const accessToken = token.access_token;
  
  const orderData = {
    order: {
      line_items: [
        {
          variant_id: 47882198163773,
          quantity: 1,
          price: "49.99"
        }
      ],
      customer: {
        first_name: "Test",
        last_name: "Auto",
        email: "auto-test@example.com"
      },
      note_attributes: [
        { name: "Delivery-Date", value: "2026-07-30" },
        { name: "Delivery-Location-Id", value: "2170" },
        { name: "Delivery-Time", value: "12:00 AM - 7:00 AM" }
      ],
      financial_status: "paid"
    }
  };

  try {
    console.log('📦 Creating test order on staging store...');
    const response = await axios.post(
      `https://${store}/admin/api/2026-04/orders.json`,
      orderData,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        }
      }
    );

    const order = response.data.order;
    console.log(`\n✅ TEST ORDER CREATED`);
    console.log(`   Order #: ${order.name}`);
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Customer: ${order.customer.first_name} ${order.customer.last_name}`);
    console.log(`   Email: ${order.customer.email}`);
    console.log(`   Note Attributes:`);
    if (order.note_attributes) {
      order.note_attributes.forEach(attr => {
        console.log(`     - ${attr.name}: ${attr.value}`);
      });
    }
    
    console.log(`\n⏳ Webhook firing now...`);
    console.log(`⏳ Enrichment processing...`);
    console.log(`\n⏸️  Waiting 35 seconds for enrichment to complete...\n`);
    
    return order.id;
  } catch (err) {
    console.error('❌ Error creating order:', err.response?.data?.errors || err.message);
    process.exit(1);
  }
}

createTestOrder().catch(console.error);
