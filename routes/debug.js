const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

/**
 * GET /debug/db-status
 * Check database connection status and environment
 */
router.get('/db-status', async (req, res) => {
  try {
    // Log environment variables (sanitized)
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? '***SET***' : 'NOT SET',
      PGHOST: process.env.PGHOST || 'NOT SET',
      PGPORT: process.env.PGPORT || 'NOT SET',
      PGUSER: process.env.PGUSER || 'NOT SET',
      PGDATABASE: process.env.PGDATABASE || 'NOT SET',
      PGPASSWORD: process.env.PGPASSWORD ? '***SET***' : 'NOT SET',
    };

    console.log('DEBUG: Environment Variables:', envVars);

    // Try to query the database
    const result = await pool.query('SELECT NOW() as current_time, COUNT(*) as schedule_count FROM delivery_schedules');
    
    const dbStatus = {
      connected: true,
      currentTime: result.rows[0].current_time,
      scheduleCount: result.rows[0].schedule_count,
      environment: envVars
    };

    res.json({ success: true, data: dbStatus });
  } catch (error) {
    console.error('DEBUG: Database error:', error.message, error.stack);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL: process.env.DATABASE_URL ? '***SET***' : 'NOT SET',
        PGHOST: process.env.PGHOST || 'NOT SET',
        PGUSER: process.env.PGUSER || 'NOT SET',
      }
    });
  }
});

module.exports = router;
