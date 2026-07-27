const pool = require('./lib/db');

async function fixMissingColumns() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing missing columns in orders_to_enrich...');
    
    // Add delivery columns to orders_to_enrich
    const deliveryColumns = [
      ['delivery_date', 'VARCHAR(10)'],
      ['delivery_location_id', 'VARCHAR(20)'],
      ['delivery_time', 'VARCHAR(50)'],
    ];
    
    for (const [colName, colType] of deliveryColumns) {
      try {
        await client.query(`ALTER TABLE orders_to_enrich ADD COLUMN ${colName} ${colType}`);
        console.log(`  ✅ Added ${colName} to orders_to_enrich`);
      } catch (e) {
        if (e.code === '42701') {
          console.log(`  ℹ️  ${colName} already exists`);
        } else {
          throw e;
        }
      }
    }
    
    console.log('🔧 Fixing missing columns in order_enrichments...');
    
    // Add enrichment columns to order_enrichments
    const enrichColumns = [
      ['hds_delivery_date', 'VARCHAR(10)'],
      ['hds_delivery_formatted', 'TEXT'],
      ['hds_delivery_day', 'VARCHAR(20)'],
      ['hds_delivery_window', 'VARCHAR(50)'],
      ['hds_delivery_time', 'VARCHAR(50)'],
      ['hds_schedule_id', 'VARCHAR(20)'],
      ['hds_pack_date', 'VARCHAR(10)'],
      ['hds_production_date', 'VARCHAR(10)'],
      ['hds_region', 'VARCHAR(255)'],
      ['hds_suburb', 'VARCHAR(255)'],
      ['hds_postcode', 'VARCHAR(10)'],
    ];
    
    for (const [colName, colType] of enrichColumns) {
      try {
        await client.query(`ALTER TABLE order_enrichments ADD COLUMN ${colName} ${colType}`);
        console.log(`  ✅ Added ${colName} to order_enrichments`);
      } catch (e) {
        if (e.code === '42701') {
          console.log(`  ℹ️  ${colName} already exists`);
        } else {
          throw e;
        }
      }
    }
    
    console.log('✅ All columns fixed!');
  } finally {
    client.release();
    pool.end();
  }
}

fixMissingColumns().catch(console.error);
