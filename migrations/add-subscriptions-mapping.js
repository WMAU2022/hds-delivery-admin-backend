/**
 * Migration: Add subscription ↔ HDS mapping tables
 * Purpose: Store Loop subscription IDs linked to HDS schedules for auto-charge offset calculation
 * Run: Automatically on server startup (or manually via npm run migrate)
 */

const pool = require('../lib/db');

async function createSubscriptionsTables() {
  const client = await pool.connect();

  try {
    console.log('  Creating subscription_hds_mapping table...');

    // Main mapping table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_hds_mapping (
        id SERIAL PRIMARY KEY,
        loop_subscription_id VARCHAR NOT NULL UNIQUE,
        hds_schedule_id INTEGER NOT NULL,
        hds_region_id INTEGER NOT NULL,
        offset_days INTEGER NOT NULL,
        delivery_day VARCHAR NOT NULL,
        pack_day VARCHAR,
        cutoff_day VARCHAR,
        customer_id VARCHAR,
        customer_email VARCHAR,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (hds_schedule_id) REFERENCES delivery_schedules(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_loop_subscription_id 
        ON subscription_hds_mapping(loop_subscription_id);
      CREATE INDEX IF NOT EXISTS idx_customer_id 
        ON subscription_hds_mapping(customer_id);
      CREATE INDEX IF NOT EXISTS idx_active 
        ON subscription_hds_mapping(active);
    `);

    console.log('  Creating subscription_changes_log table...');

    // Audit log for changes
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_changes_log (
        id SERIAL PRIMARY KEY,
        loop_subscription_id VARCHAR NOT NULL,
        change_type VARCHAR NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason VARCHAR,
        triggered_by VARCHAR,
        changed_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (loop_subscription_id) REFERENCES subscription_hds_mapping(loop_subscription_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_subscription_log 
        ON subscription_changes_log(loop_subscription_id);
      CREATE INDEX IF NOT EXISTS idx_change_type 
        ON subscription_changes_log(change_type);
    `);

    console.log('  Creating subscription_auto_charges table...');

    // Log every auto-charge attempt for debugging
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_auto_charges (
        id SERIAL PRIMARY KEY,
        loop_subscription_id VARCHAR NOT NULL,
        loop_order_id VARCHAR,
        shopify_order_id VARCHAR,
        next_delivery_date DATE,
        charge_date DATE,
        offset_days INTEGER,
        status VARCHAR DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        FOREIGN KEY (loop_subscription_id) REFERENCES subscription_hds_mapping(loop_subscription_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_auto_charge_status 
        ON subscription_auto_charges(status);
      CREATE INDEX IF NOT EXISTS idx_auto_charge_sub_id 
        ON subscription_auto_charges(loop_subscription_id);
    `);

    console.log('    ✅ subscription_hds_mapping table ready');
    console.log('    ✅ subscription_changes_log table ready');
    console.log('    ✅ subscription_auto_charges table ready');

  } catch (error) {
    if (error.code === '42P07') {
      // Table already exists, skip
      console.log('    ℹ️  Tables already exist, skipping');
    } else {
      console.error('    ❌ Error creating subscriptions tables:', error.message);
      throw error;
    }
  } finally {
    client.release();
  }
}

module.exports = createSubscriptionsTables;
