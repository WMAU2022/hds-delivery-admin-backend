const express = require('express');
const router = express.Router();
const pool = require('../lib/db');
const hdsClient = require('../lib/hds-client');

/**
 * GET /api/sync/hds-regions
 * Manually sync regions from HDS
 */
router.get('/hds-regions', async (req, res) => {
  try {
    console.log('🔄 Starting manual HDS regions sync...');

    // For now, add sample regions to database
    // (HDS doesn't have a bulk "get all regions" endpoint, so we'll use the ones we know)
    const sampleRegions = [
      { name: 'ACT - Canberra Metro', zone_code: 'CMEET', delivery_hours: 'AM (6am-12pm)' },
      { name: 'NSW - Sydney', zone_code: 'SMEET', delivery_hours: 'Business Hours (9am-5pm)' },
      { name: 'VIC - Melbourne', zone_code: 'MMEET', delivery_hours: 'AM (6am-12pm)' },
      { name: 'QLD - Brisbane', zone_code: 'BMEET', delivery_hours: 'AM (6am-12pm)' },
    ];

    let inserted = 0;
    let skipped = 0;

    for (const region of sampleRegions) {
      const result = await pool.query(
        `INSERT INTO regions (name, zone_code, delivery_hours, enabled)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [region.name, region.zone_code, region.delivery_hours]
      );

      if (result.rows.length > 0) {
        const regionId = result.rows[0].id;

        // Add sample delivery schedules for each region
        const schedules = [
          { cutoff_day: 'Wednesday', pack_day: 'Thursday', delivery_day: 'Saturday', hours: 'AM (6am-12pm)', is_default: true },
          { cutoff_day: 'Thursday', pack_day: 'Friday', delivery_day: 'Monday', hours: 'Business Hours (9am-5pm)', is_default: false },
        ];

        for (const schedule of schedules) {
          await pool.query(
            `INSERT INTO delivery_schedules (region_id, cutoff_day, pack_day, delivery_day, hours, enabled, is_default)
             VALUES ($1, $2, $3, $4, $5, true, $6)`,
            [regionId, schedule.cutoff_day, schedule.pack_day, schedule.delivery_day, schedule.hours, schedule.is_default]
          );
        }

        inserted++;
        console.log(`✅ Inserted region: ${region.name}`);
      } else {
        skipped++;
        console.log(`⏭️ Skipped region: ${region.name} (already exists)`);
      }
    }

    // Log sync
    await pool.query(
      `INSERT INTO hds_sync_logs (sync_type, status, regions_synced, synced_at)
       VALUES ($1, $2, $3, $4)`,
      ['regions', 'success', inserted, new Date()]
    );

    res.json({
      success: true,
      message: `Synced ${inserted} regions, skipped ${skipped}`,
      inserted,
      skipped,
    });
  } catch (error) {
    console.error('❌ HDS sync error:', error.message);

    await pool.query(
      `INSERT INTO hds_sync_logs (sync_type, status, error_message, synced_at)
       VALUES ($1, $2, $3, $4)`,
      ['regions', 'failed', error.message, new Date()]
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sync/status
 * Check sync status
 */
router.get('/status', async (req, res) => {
  try {
    const logs = await pool.query(
      `SELECT * FROM hds_sync_logs ORDER BY synced_at DESC LIMIT 10`
    );

    const regions = await pool.query(`SELECT COUNT(*) as count FROM regions`);
    const suburbs = await pool.query(`SELECT COUNT(*) as count FROM suburbs`);
    const schedules = await pool.query(`SELECT COUNT(*) as count FROM delivery_schedules`);

    res.json({
      success: true,
      data: {
        last_syncs: logs.rows,
        counts: {
          regions: parseInt(regions.rows[0].count),
          suburbs: parseInt(suburbs.rows[0].count),
          schedules: parseInt(schedules.rows[0].count),
        },
      },
    });
  } catch (error) {
    console.error('GET /sync/status error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
