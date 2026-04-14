const { Pool } = require('pg');

const connectionString = 'postgresql://postgres:iCvnJqAHHQnsafVjMHowoMnXUxrUZEyg@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running database migrations...\n');
    
    // Create regions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created regions table');
    
    // Create suburbs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS suburbs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        postcode VARCHAR(10) NOT NULL,
        state VARCHAR(10),
        region_id INTEGER REFERENCES regions(id),
        serviceable BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, postcode, state)
      )
    `);
    console.log('✅ Created suburbs table');
    
    // Create delivery_schedules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_schedules (
        id SERIAL PRIMARY KEY,
        region_id INTEGER NOT NULL REFERENCES regions(id),
        cutoff_day INTEGER,
        pack_day INTEGER,
        delivery_day INTEGER,
        hours VARCHAR(255),
        enabled BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created delivery_schedules table');
    
    // Create blackout_dates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blackout_dates (
        id SERIAL PRIMARY KEY,
        region_id INTEGER NOT NULL REFERENCES regions(id),
        blackout_date DATE NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(region_id, blackout_date)
      )
    `);
    console.log('✅ Created blackout_dates table');
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
