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

    // Update Central Coast postcodes (2250-2258)
    // postcode is stored as varchar, so use string comparison
    const result = await pool.query(
      `UPDATE suburbs SET region_id = $1 WHERE postcode >= '2250' AND postcode <= '2258'`,
      [regionId]
    );
    
    const updated = result.rowCount || 0;

    console.log(`✅ Updated ${updated} suburbs (postcodes 2250-2258) to Central Coast`);

    // Verify final count
    const verification = await pool.query(
      'SELECT COUNT(*) as count FROM suburbs WHERE region_id = $1',
      [regionId]
    );
    
    const verified = parseInt(verification.rows[0].count || 0);
    
    res.json({
      success: true,
      message: `NSW Central Coast region ready. ${updated} Central Coast suburbs (2250-2258) updated. Total in region: ${verified}`,
      regionId,
      suburbsUpdated: updated,
      postcodesUpdated: '2250-2258',
      centralCoastSuburbsNow: verified
    });
  } catch (error) {
    console.error('❌ Error:', error.message, error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
