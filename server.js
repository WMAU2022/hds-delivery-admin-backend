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

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 HDS Delivery Admin Backend running on port ${PORT}`);
  console.log(`📚 API: http://localhost:${PORT}/api`);
  
  // Test DB connection
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Database connected`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('Run: npm run migrate');
  }

  // Initialize HDS sync job (runs daily at 2 AM)
  hdsSync.initSchedule();
  console.log('⏰ HDS sync scheduled (daily at 2 AM)');
});

module.exports = app;
