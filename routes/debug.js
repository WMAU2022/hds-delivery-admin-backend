const express = require('express');
const router = express.Router();
const pool = require('../lib/db-auto'); // Use db-auto for proper Railway credentials

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
 * POST /debug/simple-string-update
 * Update using simple string postcode matching (no casting)
 */
router.post('/simple-string-update', async (req, res) => {
  try {
    console.log('🔥 Simple string-based update...');
    
    // List of postcodes as strings
    const postcodes = ['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258'];
    
    // Count before
    const beforeResult = await pool.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE postcode = ANY($1) AND region_id = 1`,
      [postcodes]
    );
    const countBefore = parseInt(beforeResult.rows[0].count || 0);
    console.log(`BEFORE: ${countBefore} suburbs in region 1`);
    
    // Update
    const updateResult = await pool.query(
      `UPDATE suburbs SET region_id = 29 WHERE postcode = ANY($1)`,
      [postcodes]
    );
    const updated = updateResult.rowCount || 0;
    console.log(`UPDATED: ${updated} rows`);
    
    // Count after
    const afterResult = await pool.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE postcode = ANY($1) AND region_id = 29`,
      [postcodes]
    );
    const countAfter = parseInt(afterResult.rows[0].count || 0);
    console.log(`AFTER: ${countAfter} suburbs in region 29`);
    
    res.json({
      success: true,
      message: `Updated ${updated} suburbs`,
      before: countBefore,
      after: countAfter,
      method: 'postcode = ANY(array)'
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

/**
 * POST /debug/atomic-update-and-verify
 * Update AND verify in same transaction - proves if update actually happened
 */
router.post('/atomic-update-and-verify', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting atomic update + verify...');
    await client.query('BEGIN');
    
    // UPDATE
    const updateResult = await client.query(
      `UPDATE suburbs SET region_id = 29 WHERE postcode = ANY($1)`,
      [['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258']]
    );
    console.log(`Updated: ${updateResult.rowCount} rows`);
    
    // VERIFY immediately after in same transaction
    const verifyResult = await client.query(
      `SELECT COUNT(*) as count FROM suburbs WHERE postcode = ANY($1) AND region_id = 29`,
      [['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258']]
    );
    const verifyCount = parseInt(verifyResult.rows[0].count || 0);
    console.log(`Verified: ${verifyCount} in region 29`);
    
    await client.query('COMMIT');
    console.log('✅ Committed');
    
    res.json({
      success: true,
      updated: updateResult.rowCount,
      verified: verifyCount,
      match: updateResult.rowCount === verifyCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /debug/check-central-coast
 * Direct database check - what's actually in region 29?
 */
router.get('/check-central-coast', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT name, postcode, region_id FROM suburbs WHERE postcode IN ('2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258') LIMIT 15`
    );
    
    const region29Count = result.rows.filter(r => r.region_id === 29).length;
    const region1Count = result.rows.filter(r => r.region_id === 1).length;
    
    res.json({
      success: true,
      query: 'SELECT * FROM suburbs WHERE postcode IN (Central Coast postcodes)',
      samplesFound: result.rows.length,
      region29: region29Count,
      region1: region1Count,
      samples: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
