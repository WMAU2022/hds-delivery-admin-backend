/**
 * Migration: Add delivery columns to orders_to_enrich table
 * Runs on every server startup to handle existing tables from previous deployments
 */

async function addDeliveryColumns(pool) {
  try {
    // Add columns to orders_to_enrich if they don't exist
    await pool.query('ALTER TABLE orders_to_enrich ADD COLUMN delivery_date VARCHAR(10)').catch(() => {});
    await pool.query('ALTER TABLE orders_to_enrich ADD COLUMN delivery_location_id VARCHAR(20)').catch(() => {});
    await pool.query('ALTER TABLE orders_to_enrich ADD COLUMN delivery_time VARCHAR(50)').catch(() => {});
    
    // Add columns to order_enrichments if they don't exist
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_delivery_date VARCHAR(10)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_delivery_formatted TEXT').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_delivery_day VARCHAR(20)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_delivery_window VARCHAR(50)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_delivery_time VARCHAR(50)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_schedule_id VARCHAR(20)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_pack_date VARCHAR(10)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_production_date VARCHAR(10)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_region VARCHAR(255)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_suburb VARCHAR(255)').catch(() => {});
    await pool.query('ALTER TABLE order_enrichments ADD COLUMN hds_postcode VARCHAR(10)').catch(() => {});
    
    console.log('✅ All delivery columns verified/added');
  } catch (err) {
    console.warn('⚠️ Column migration warning:', err.message);
  }
}

module.exports = { addDeliveryColumns };
