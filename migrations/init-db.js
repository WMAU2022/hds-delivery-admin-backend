const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'postgres', // Connect to default DB first
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function initDatabase() {
  try {
    console.log('🔧 Initializing database...');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME;
    const checkDb = await pool.query(
      `SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkDb.rows.length === 0) {
      await pool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created`);
    } else {
      console.log(`✅ Database "${dbName}" already exists`);
    }

    // Connect to the new database
    const appPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: dbName,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    // Create tables
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        zone_code VARCHAR(50),
        delivery_hours VARCHAR(100),
        enabled BOOLEAN DEFAULT true,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        hds_region_id VARCHAR(100)
      );
    `);
    console.log('✅ Table: regions');

    await appPool.query(`
      CREATE TABLE IF NOT EXISTS delivery_schedules (
        id SERIAL PRIMARY KEY,
        region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
        cutoff_day VARCHAR(20) NOT NULL,
        pack_day VARCHAR(20) NOT NULL,
        delivery_day VARCHAR(20) NOT NULL,
        hours VARCHAR(50),
        enabled BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table: delivery_schedules');

    await appPool.query(`
      CREATE TABLE IF NOT EXISTS suburbs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        postcode INTEGER NOT NULL,
        state VARCHAR(10) NOT NULL,
        region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL,
        serviceable BOOLEAN DEFAULT true,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, postcode, state)
      );
    `);
    console.log('✅ Table: suburbs');

    await appPool.query(`
      CREATE TABLE IF NOT EXISTS hds_sync_logs (
        id SERIAL PRIMARY KEY,
        sync_type VARCHAR(50),
        status VARCHAR(50),
        regions_synced INTEGER,
        suburbs_synced INTEGER,
        error_message TEXT,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table: hds_sync_logs');

    console.log('\n✅ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    process.exit(1);
  }
}

initDatabase();
