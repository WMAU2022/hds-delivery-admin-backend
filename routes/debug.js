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

/**
 * POST /debug/insert-central-coast
 * TEMPORARY: Manually insert NSW Central Coast region
 */
router.post('/insert-central-coast', async (req, res) => {
  try {
    console.log('🚀 DEBUG: Starting manual Central Coast insert...');
    
    // First, delete any existing partial record
    await pool.query('DELETE FROM regions WHERE name = $1', ['NSW Central Coast']);
    console.log('Cleaned up any existing partial records');
    
    // Insert NSW Central Coast region
    const regionResult = await pool.query(
      `INSERT INTO regions (name, hds_zone, code, location, cutoff_time, enabled, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      ['NSW Central Coast', 'NSW Central Coast', 'CC', 'WOM', '23:00', true]
    );
    
    const centralCoastRegionId = regionResult.rows[0].id;
    console.log(`✅ NSW Central Coast region CREATED (ID: ${centralCoastRegionId})`);

    // Update all Central Coast postcodes
    const centralCoastPostcodes = ['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258'];
    
    let totalUpdated = 0;
    for (const postcode of centralCoastPostcodes) {
      const result = await pool.query(
        'UPDATE suburbs SET region_id = $1 WHERE postcode = $2',
        [centralCoastRegionId, postcode]
      );
      totalUpdated += result.rowCount || 0;
    }

    // Verify
    const verification = await pool.query(
      'SELECT COUNT(*) as count FROM suburbs WHERE region_id = $1',
      [centralCoastRegionId]
    );

    const finalCount = verification.rows[0].count;
    console.log(`✅ Verification: ${finalCount} suburbs in Central Coast region`);
    
    res.json({
      success: true,
      message: 'NSW Central Coast region created/updated successfully',
      regionId: centralCoastRegionId,
      suburbsUpdated: totalUpdated,
      suburbsVerified: finalCount
    });
  } catch (error) {
    console.error('❌ DEBUG: Error inserting Central Coast:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check that database is accessible and regions table exists'
    });
  }
});

module.exports = router;
