const { Pool } = require('pg');
require('dotenv').config();

const { addCentralCoastRegion } = require('./add-central-coast-region');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hds_delivery',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function run() {
  try {
    console.log('🚀 Running Central Coast migration...\n');
    await addCentralCoastRegion(pool);
    console.log('\n✅ Migration finished successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
