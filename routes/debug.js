const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

/**
 * GET /debug/db-status
 * Check database connection status and environment
 */
router.get('/db-status', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, COUNT(*) as schedule_count FROM delivery_schedules');
    const dbStatus = {
      connected: true,
      currentTime: result.rows[0].current_time,
      scheduleCount: result.rows[0].schedule_count
    };
    res.json({ success: true, data: dbStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /debug/insert-central-coast
 * Manually insert NSW Central Coast region and update suburbs
 */
router.post('/insert-central-coast', async (req, res) => {
  try {
    console.log('🚀 Creating NSW Central Coast region...');
    
    // Delete any existing Central Coast record
    await pool.query('DELETE FROM regions WHERE name = $1', ['NSW Central Coast']);
    
    // Find next available ID
    const maxIdResult = await pool.query('SELECT MAX(id) as max_id FROM regions');
    const nextId = (maxIdResult.rows[0].max_id || 0) + 1;
    
    // Insert region
    const regionResult = await pool.query(
      `INSERT INTO regions (id, name, hds_zone, code, location, cutoff_time, enabled, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [nextId, 'NSW Central Coast', 'NSW Central Coast', 'CC', 'WOM', '23:00', true]
    );
    
    const regionId = regionResult.rows[0].id;
    console.log(`✅ Region created: NSW Central Coast (ID: ${regionId})`);

    // First check: How many suburbs have these postcodes?
    const checkResult = await pool.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE postcode IN ('2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258')`
    );
    const matchingCount = parseInt(checkResult.rows[0].count || 0);
    console.log(`DEBUG: Found ${matchingCount} suburbs with Central Coast postcodes`);
    
    // Update Central Coast postcodes (2250-2258)
    const result = await pool.query(
      `UPDATE suburbs SET region_id = $1 WHERE postcode IN ('2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258')`,
      [regionId]
    );
    
    const updated = result.rowCount || 0;
    console.log(`DEBUG: UPDATE statement updated ${updated} rows`);

    console.log(`✅ Updated ${updated} suburbs (postcodes 2250-2258) to Central Coast region ${regionId}`);

    // Verify final count
    const verification = await pool.query(
      'SELECT COUNT(*) as count FROM suburbs WHERE region_id = $1',
      [regionId]
    );
    
    const verified = parseInt(verification.rows[0].count || 0);
    console.log(`DEBUG: Region ${regionId} now contains ${verified} suburbs total`);
    
    res.json({
      success: true,
      message: `NSW Central Coast ready. Moved ${updated} of ${matchingCount} Central Coast suburbs. Region total: ${verified}`,
      debugInfo: {
        matchingSuburbsFound: matchingCount,
        updateCount: updated,
        totalInRegion: verified
      },
      regionId,
      suburbsUpdated: updated,
      postcodesUpdated: '2250-2258',
      debugMatched: matchingCount,
      centralCoastSuburbsNow: verified,
      updateCount: updated
    });
  } catch (error) {
    console.error('❌ Error:', error.message, error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
