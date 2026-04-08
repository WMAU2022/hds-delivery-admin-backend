require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./lib/db');
const hdsSync = require('./jobs/hds-sync');
const regionsRouter = require('./routes/regions');
const suburbsRouter = require('./routes/suburbs');
const schedulesRouter = require('./routes/schedules');
const syncRouter = require('./routes/sync');
const blackoutRouter = require('./routes/blackout');
const publicRouter = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test endpoints - return hardcoded data
app.get('/api/regions', (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'Sydney Metro', code: 'SYD' },
      { id: 2, name: 'Melbourne Metro', code: 'MEL' }
    ]
  });
});

// Get single region detail
app.get('/api/regions/:id', (req, res) => {
  const regionId = parseInt(req.params.id);
  const regions = {
    1: { id: 1, name: 'Sydney Metro', code: 'SYD', enabled: true },
    2: { id: 2, name: 'Melbourne Metro', code: 'MEL', enabled: true }
  };
  
  if (regions[regionId]) {
    res.json(regions[regionId]);
  } else {
    res.status(404).json({ error: 'Region not found' });
  }
});

app.get('/api/suburbs', (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'Sydney CBD', postcode: '2000', state: 'NSW', region_id: 1 },
      { id: 2, name: 'Parramatta', postcode: '2150', state: 'NSW', region_id: 1 },
      { id: 3, name: 'Melbourne CBD', postcode: '3000', state: 'VIC', region_id: 2 }
    ]
  });
});

// Get suburbs for region
app.get('/api/regions/:id/suburbs', (req, res) => {
  const regionId = parseInt(req.params.id);
  const suburbs = {
    1: [
      { id: 1, name: 'Sydney CBD', postcode: '2000', state: 'NSW', region_id: 1 },
      { id: 2, name: 'Parramatta', postcode: '2150', state: 'NSW', region_id: 1 }
    ],
    2: [
      { id: 3, name: 'Melbourne CBD', postcode: '3000', state: 'VIC', region_id: 2 }
    ]
  };
  
  res.json({ data: suburbs[regionId] || [] });
});

// Get schedules for region
app.get('/api/regions/:id/schedules', (req, res) => {
  const regionId = parseInt(req.params.id);
  const schedules = {
    1: [
      { id: 1, region_id: 1, delivery_day: 'Monday', hours: 'AM' },
      { id: 2, region_id: 1, delivery_day: 'Wednesday', hours: 'PM' }
    ],
    2: [
      { id: 3, region_id: 2, delivery_day: 'Friday', hours: 'AM' }
    ]
  };
  
  res.json({ data: schedules[regionId] || [] });
});

app.get('/api/schedules', (req, res) => {
  res.json({
    data: [
      { id: 1, region_id: 1, delivery_day: 'Monday', hours: 'AM' },
      { id: 2, region_id: 1, delivery_day: 'Wednesday', hours: 'PM' },
      { id: 3, region_id: 2, delivery_day: 'Friday', hours: 'AM' }
    ]
  });
});

// API Routes
app.use('/api/regions', regionsRouter);
app.use('/api/suburbs', suburbsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/blackout-dates', blackoutRouter);

// Public API Routes (for checkout)
app.use('/api/public', publicRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message,
    status: err.status || 500,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Run migrations on startup
async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running database migrations...');
    
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
    
    console.log('✅ Migrations completed');
    client.release();
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    client.release();
    throw error;
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 HDS Delivery Admin Backend running on port ${PORT}`);
  console.log(`📚 API: http://localhost:${PORT}/api`);
  
  // Run migrations (don't crash if they fail - tables might already exist)
  try {
    await runMigrations();
  } catch (error) {
    console.error('⚠️  Migration warning:', error.message);
    console.log('(Tables might already exist - continuing anyway)');
  }
  
  // Test DB connection
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Database connected`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }

  // Initialize HDS sync job (runs daily at 2 AM)
  hdsSync.initSchedule();
  console.log('⏰ HDS sync scheduled (daily at 2 AM)');
});

module.exports = app;
// Force redeploy Wed Apr  8 15:08:28 AEST 2026
