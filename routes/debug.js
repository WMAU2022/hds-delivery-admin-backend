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
    
    // First, delete any existing record by name
    const deleteResult = await pool.query('DELETE FROM regions WHERE name = $1', ['NSW Central Coast']);
    if (deleteResult.rowCount > 0) {
      console.log(`Deleted ${deleteResult.rowCount} existing Central Coast record(s)`);
    }
    
    // Get the next available ID by finding max + 1
    const maxIdResult = await pool.query('SELECT MAX(id) as max_id FROM regions');
    const nextId = (maxIdResult.rows[0].max_id || 0) + 1;
    console.log(`Next available ID: ${nextId}`);
    
    // Insert NSW Central Coast region with explicit next ID
    const regionResult = await pool.query(
      `INSERT INTO regions (id, name, hds_zone, code, location, cutoff_time, enabled, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [nextId, 'NSW Central Coast', 'NSW Central Coast', 'CC', 'WOM', '23:00', true]
    );
    
    const centralCoastRegionId = regionResult.rows[0].id;
    console.log(`✅ NSW Central Coast region CREATED (ID: ${centralCoastRegionId})`);

    // Update all Central Coast postcodes using string comparison
    const centralCoastPostcodes = ['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258'];
    
    let totalUpdated = 0;
    for (const postcode of centralCoastPostcodes) {
      // Convert postcode to string for comparison
      const result = await pool.query(
        'UPDATE suburbs SET region_id = $1 WHERE CAST(postcode AS TEXT) = $2',
        [centralCoastRegionId, postcode]
      );
      
      totalUpdated += result.rowCount || 0;
      if (result.rowCount > 0) {
        console.log(`Updated ${result.rowCount} suburbs with postcode ${postcode}`);
      }
    }

    // Verify - count suburbs in the Central Coast region with matching postcodes
    const verification = await pool.query(
      `SELECT COUNT(*) as count FROM suburbs 
       WHERE region_id = $1 
       AND CAST(postcode AS TEXT) IN ('2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258')`,
      [centralCoastRegionId]
    );

    const finalCount = parseInt(verification.rows[0].count || 0);
    console.log(`✅ Verification: ${finalCount} Central Coast suburbs mapped to region ${centralCoastRegionId}`);
    
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
