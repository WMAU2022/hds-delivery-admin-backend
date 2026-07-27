// Direct database migration to add missing columns
const pool = require('./lib/db');

async function addMissingColumns() {
  const client = await pool.connect();
  try {
    console.log('🔧 Adding missing columns to orders_to_enrich...');
    
    const deliveryColumns = [
      'delivery_date VARCHAR(10)',
      'delivery_location_id VARCHAR(20)',
      'delivery_time VARCHAR(50)',
    ];
    
    for (const colDef of deliveryColumns) {
      const [colName] = colDef.split(' ');
      try {
        await client.query(`ALTER TABLE orders_to_enrich ADD COLUMN ${colDef}`);
        console.log(`  ✅ Added ${colName}`);
      } catch (e) {
        if (e.code === '42701') {
          console.log(`  ℹ️  ${colName} already exists`);
        } else {
          console.error(`  ❌ Error adding ${colName}:`, e.message);
        }
      }
    }
    
    console.log('🔧 Adding missing columns to order_enrichments...');
    
    const enrichColumns = [
      'hds_delivery_date VARCHAR(10)',
      'hds_delivery_formatted TEXT',
      'hds_delivery_day VARCHAR(20)',
      'hds_delivery_window VARCHAR(50)',
      'hds_delivery_time VARCHAR(50)',
      'hds_schedule_id VARCHAR(20)',
      'hds_pack_date VARCHAR(10)',
      'hds_production_date VARCHAR(10)',
      'hds_region VARCHAR(255)',
      'hds_suburb VARCHAR(255)',
      'hds_postcode VARCHAR(10)',
    ];
    
    for (const colDef of enrichColumns) {
      const colName = colDef.split(' ')[0];
      try {
        await client.query(`ALTER TABLE order_enrichments ADD COLUMN ${colDef}`);
        console.log(`  ✅ Added ${colName}`);
      } catch (e) {
        if (e.code === '42701') {
          console.log(`  ℹ️  ${colName} already exists`);
        } else {
          console.error(`  ❌ Error adding ${colName}:`, e.message);
        }
      }
    }
    
    console.log('✅ Migration complete!');
  } finally {
    client.release();
    pool.end();
  }
}

addMissingColumns().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
