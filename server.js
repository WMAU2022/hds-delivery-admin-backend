require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./lib/db');
const hdsSync = require('./jobs/hds-sync');
const { allSuburbs } = require('./lib/suburbs-data');
const store = require('./lib/memory-store');
const regionsRouter = require('./routes/regions');
const suburbsRouter = require('./routes/suburbs');
const schedulesRouter = require('./routes/schedules');
const schedulesCrudRouter = require('./routes/schedules-crud');
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

// PUBLIC API - Postcode delivery lookup (for Shopify checkout)
// Production-grade endpoint with comprehensive Sydney & Melbourne suburbs
app.get('/api/public/delivery-options', (req, res) => {
  const { postcode } = req.query;

  if (!postcode) {
    return res.status(400).json({
      success: false,
      error: 'postcode query parameter required',
    });
  }

  // Find suburb by postcode from real data
  const location = allSuburbs.find(s => s.postcode === postcode.toString());

  if (!location) {
    return res.json({
      success: false,
      error: `Postcode ${postcode} not serviceable`,
    });
  }

  // Define schedules by region
  const sydneyNextDeliveryDate = getNextDeliveryDate('Thursday', 'Sunday');
  const melbourneNextDeliveryDate = getNextDeliveryDate('Thursday', 'Friday');
  
  const schedulesByRegion = {
    1: [ // Sydney Metro - Thursday cutoff → Saturday pack → Sunday delivery
      {
        schedule_id: 1,
        delivery_day: 'Sunday',
        delivery_window: 'AM (12:00 AM - 7:00 AM)',
        cutoff_info: 'Thursday 2:00 PM',
        delivery_date: sydneyNextDeliveryDate,
        formatted_date: formatDeliveryDate(sydneyNextDeliveryDate),
      },
      {
        schedule_id: 2,
        delivery_day: 'Sunday',
        delivery_window: 'Business Hours (8:00 AM - 6:00 PM)',
        cutoff_info: 'Thursday 2:00 PM',
        delivery_date: sydneyNextDeliveryDate,
        formatted_date: formatDeliveryDate(sydneyNextDeliveryDate),
      },
    ],
    2: [ // Melbourne Metro - Thursday cutoff → Friday pack → Friday delivery
      {
        schedule_id: 3,
        delivery_day: 'Friday',
        delivery_window: 'AM (12:00 AM - 7:00 AM)',
        cutoff_info: 'Thursday 2:00 PM',
        delivery_date: melbourneNextDeliveryDate,
        formatted_date: formatDeliveryDate(melbourneNextDeliveryDate),
      },
      {
        schedule_id: 4,
        delivery_day: 'Friday',
        delivery_window: 'Business Hours (8:00 AM - 6:00 PM)',
        cutoff_info: 'Thursday 2:00 PM',
        delivery_date: melbourneNextDeliveryDate,
        formatted_date: formatDeliveryDate(melbourneNextDeliveryDate),
      },
    ],
  };

  const region_names = { 1: 'Sydney Metro', 2: 'Melbourne Metro' };
  const options = schedulesByRegion[location.region_id] || [];

  res.json({
    success: true,
    suburb: location.suburb,
    postcode: location.postcode,
    state: location.state,
    region: {
      id: location.region_id,
      name: region_names[location.region_id] || 'Unknown Region',
    },
    delivery_options: options,
    message: `${options.length} delivery option${options.length === 1 ? '' : 's'} available for ${location.suburb}`,
  });
});

// Helper functions
function getNextDeliveryDate(cutoffDayStr, deliveryDayStr) {
  const dayMap = {
    'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
    'Friday': 5, 'Saturday': 6, 'Sunday': 0,
  };

  const today = new Date();
  const todayNum = today.getDay();
  const cutoffNum = dayMap[cutoffDayStr];
  const deliveryNum = dayMap[deliveryDayStr];

  let daysToAdd = 0;
  if (todayNum <= cutoffNum) {
    daysToAdd = deliveryNum - todayNum;
    if (daysToAdd <= 0) daysToAdd += 7;
  } else {
    daysToAdd = 7 - todayNum + deliveryNum;
  }

  const date = new Date(today);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().split('T')[0];
}

function formatDeliveryDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

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
  
  // Hardcoded region data
  const regions = {
    1: { id: 1, name: 'Sydney Metro', code: 'SYD', enabled: true, cutoff_time: '14:00' },
    2: { id: 2, name: 'Melbourne Metro', code: 'MEL', enabled: true, cutoff_time: '14:00' }
  };
  
  if (regions[regionId]) {
    // Get schedules for this region from memory store
    const schedules = store.getByRegion(regionId);
    res.json({ data: { ...regions[regionId], schedules } });
  } else {
    res.status(404).json({ error: 'Region not found' });
  }
});

app.get('/api/suburbs', (req, res) => {
  // Return all suburbs from the real data with auto-incrementing IDs
  // Map 'suburb' field to 'name' for frontend compatibility
  const suburbs = allSuburbs.map((suburb, index) => ({
    id: index + 1,
    name: suburb.suburb,  // Frontend expects 'name', not 'suburb'
    postcode: suburb.postcode,
    state: suburb.state,
    region_id: suburb.region_id
  }));
  
  res.json({
    data: suburbs
  });
});

// Get suburbs for region
app.get('/api/regions/:id/suburbs', (req, res) => {
  const regionId = parseInt(req.params.id);
  // Filter suburbs by region - map 'suburb' field to 'name' for frontend
  const suburbsForRegion = allSuburbs
    .filter(s => s.region_id === regionId)
    .map((suburb, index) => ({
      id: index + 1,
      name: suburb.suburb,  // Frontend expects 'name'
      postcode: suburb.postcode,
      state: suburb.state,
      region_id: suburb.region_id
    }));
  
  res.json({ data: suburbsForRegion });
});

// Get schedules for region - uses memory store
app.get('/api/regions/:id/schedules', (req, res) => {
  try {
    const regionId = parseInt(req.params.id);
    const schedules = store.getByRegion(regionId);
    res.json({ data: schedules });
  } catch (error) {
    console.error('Error fetching region schedules:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schedules is now handled by schedulesCrudRouter above

// Use real CRUD routes for schedules
app.use('/api/schedules', schedulesCrudRouter);

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
    console.log('  Creating regions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('    ✅ regions table ready');
    
    // Create suburbs table
    console.log('  Creating suburbs table...');
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
    console.log('    ✅ suburbs table ready');
    
    // Create delivery_schedules table
    console.log('  Creating delivery_schedules table...');
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
    console.log('    ✅ delivery_schedules table ready');
    
    // Create blackout_dates table
    console.log('  Creating blackout_dates table...');
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
    console.log('    ✅ blackout_dates table ready');
    
    console.log('✅ All migrations completed successfully');
    client.release();
  } catch (error) {
    console.error('❌ Migration error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    client.release();
    throw error;
  }
}

// Seed initial data
async function seedInitialData() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding initial data...');
    
    // Check if regions exist
    const regionsResult = await client.query('SELECT COUNT(*) FROM regions');
    if (parseInt(regionsResult.rows[0].count) === 0) {
      console.log('  Inserting regions...');
      await client.query(`
        INSERT INTO regions (name, code) VALUES
        ('Sydney Metro', 'SYD'),
        ('Melbourne Metro', 'MEL')
      `);
      console.log('    ✅ Regions inserted');
    }
    
    // Check if schedules exist
    const schedulesResult = await client.query('SELECT COUNT(*) FROM delivery_schedules');
    if (parseInt(schedulesResult.rows[0].count) === 0) {
      console.log('  Inserting schedules...');
      await client.query(`
        INSERT INTO delivery_schedules (region_id, cutoff_day, pack_day, delivery_day, hours, enabled, is_default) VALUES
        (1, 4, 6, 0, 'AM', true, true),
        (1, 4, 6, 0, 'Business Hours', true, false),
        (2, 4, 5, 5, 'AM', true, true),
        (2, 4, 5, 5, 'Business Hours', true, false)
      `);
      console.log('    ✅ Schedules inserted');
    }
    
    console.log('✅ Seed data complete');
    client.release();
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    client.release();
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
  
  // Seed initial data
  try {
    await seedInitialData();
  } catch (error) {
    console.error('⚠️  Seed warning:', error.message);
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
