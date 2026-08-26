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
 * POST /debug/update-central-coast-suburbs
 * Move Central Coast suburbs (2250-2258) to NSW Central Coast region (ID 29)
 */
router.post('/update-central-coast-suburbs', async (req, res) => {
  try {
    console.log('🚀 Updating Central Coast suburbs to region 29...');
    
    const regionId = 29; // NSW Central Coast
    
    // Check: How many suburbs have Central Coast postcodes?
    const checkResult = await pool.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE CAST(postcode AS INTEGER) >= 2250 AND CAST(postcode AS INTEGER) <= 2258`
    );
    const matchingCount = parseInt(checkResult.rows[0].count || 0);
    console.log(`Found ${matchingCount} suburbs with postcodes 2250-2258`);
    
    // Update Central Coast postcodes to region 29
    const updateResult = await pool.query(
      `UPDATE suburbs SET region_id = $1 WHERE CAST(postcode AS INTEGER) >= 2250 AND CAST(postcode AS INTEGER) <= 2258`,
      [regionId]
    );
    
    const updated = updateResult.rowCount || 0;
    console.log(`✅ Updated ${updated} suburbs to region ${regionId}`);

    // Verify final count in region 29
    const verifyResult = await pool.query(
      'SELECT COUNT(*) as count FROM suburbs WHERE region_id = $1',
      [regionId]
    );
    
    const verified = parseInt(verifyResult.rows[0].count || 0);
    console.log(`✅ Region ${regionId} now contains ${verified} total suburbs`);
    
    // Verify none remain in region 1
    const sydneyCheckResult = await pool.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE region_id = 1 AND CAST(postcode AS INTEGER) >= 2250 AND CAST(postcode AS INTEGER) <= 2258`
    );
    const remainingInSydney = parseInt(sydneyCheckResult.rows[0].count || 0);
    console.log(`✅ Suburbs remaining in Sydney Metro (region 1): ${remainingInSydney}`);
    
    res.json({
      success: true,
      message: `✅ Success! Moved ${updated} Central Coast suburbs to NSW Central Coast region. Remaining in Sydney: ${remainingInSydney}`,
      stats: {
        totalCentralCoastPostcodes: matchingCount,
        suburbsMoved: updated,
        totalInRegion29: verified,
        remainingInSydney: remainingInSydney
      }
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /debug/force-central-coast-update
 * Force update with transaction and detailed logging
 */
router.post('/force-central-coast-update', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🔥 FORCE UPDATE: Starting transaction...');
    
    await client.query('BEGIN');
    
    // Count BEFORE
    const beforeResult = await client.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE CAST(postcode AS INTEGER) >= 2250 AND CAST(postcode AS INTEGER) <= 2258 AND region_id = 1`
    );
    const countInSydney = parseInt(beforeResult.rows[0].count || 0);
    console.log(`BEFORE: ${countInSydney} suburbs in Sydney Metro (region 1) with postcodes 2250-2258`);
    
    // FORCE UPDATE - explicit transaction
    const updateResult = await client.query(
      `UPDATE suburbs SET region_id = 29 WHERE CAST(postcode AS INTEGER) >= 2250 AND CAST(postcode AS INTEGER) <= 2258`,
      []
    );
    
    const updated = updateResult.rowCount || 0;
    console.log(`UPDATED: ${updated} suburbs`);
    
    // Count AFTER
    const afterResult = await client.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE CAST(postcode AS INTEGER) >= 2250 AND CAST(postcode AS INTEGER) <= 2258 AND region_id = 29`
    );
    const countInCC = parseInt(afterResult.rows[0].count || 0);
    console.log(`AFTER: ${countInCC} suburbs in Central Coast (region 29)`);
    
    // Commit
    await client.query('COMMIT');
    console.log('✅ COMMITTED');
    
    res.json({
      success: true,
      message: `Moved ${updated} suburbs from Sydney Metro to Central Coast`,
      before: { sydneyCount: countInSydney },
      after: { centralCoastCount: countInCC },
      updated: updated
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
