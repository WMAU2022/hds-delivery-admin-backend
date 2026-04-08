const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

/**
 * GET /api/regions
 * List all regions with their delivery schedules
 */
router.get('/', async (req, res) => {
  try {
    const regions = await pool.query(`
      SELECT r.*, 
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ds.id,
            'cutoff_day', ds.cutoff_day,
            'pack_day', ds.pack_day,
            'delivery_day', ds.delivery_day,
            'hours', ds.hours,
            'enabled', ds.enabled,
            'is_default', ds.is_default
          ) ORDER BY ds.id
        ) FILTER (WHERE ds.id IS NOT NULL) as schedules
      FROM regions r
      LEFT JOIN delivery_schedules ds ON r.id = ds.region_id
      GROUP BY r.id
      ORDER BY r.name ASC
    `);

    res.json({
      success: true,
      data: regions.rows,
      count: regions.rows.length,
    });
  } catch (error) {
    console.error('GET /regions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/regions/:id
 * Get single region with all details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const region = await pool.query(
      `SELECT * FROM regions WHERE id = $1`,
      [id]
    );

    if (region.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const schedules = await pool.query(
      `SELECT * FROM delivery_schedules WHERE region_id = $1 ORDER BY id`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...region.rows[0],
        schedules: schedules.rows,
      },
    });
  } catch (error) {
    console.error('GET /regions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/regions/:id/toggle
 * Toggle region enabled/disabled
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE regions SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Region ${result.rows[0].enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('PUT /regions/:id/toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/regions/:id/enable
 * Enable region
 */
router.put('/:id/enable', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE regions SET enabled = true, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Region enabled',
    });
  } catch (error) {
    console.error('PUT /regions/:id/enable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/regions/:id/disable
 * Disable region
 */
router.put('/:id/disable', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE regions SET enabled = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Region disabled',
    });
  } catch (error) {
    console.error('PUT /regions/:id/disable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/regions/bulk/toggle
 * Toggle multiple regions at once
 */
router.post('/bulk/toggle', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const result = await pool.query(
      `UPDATE regions SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($1) RETURNING *`,
      [ids]
    );

    res.json({
      success: true,
      data: result.rows,
      updated: result.rows.length,
      message: `${result.rows.length} regions toggled`,
    });
  } catch (error) {
    console.error('POST /regions/bulk/toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/regions/bulk/enable
 * Enable multiple regions
 */
router.post('/bulk/enable', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const result = await pool.query(
      `UPDATE regions SET enabled = true, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($1) RETURNING *`,
      [ids]
    );

    res.json({
      success: true,
      data: result.rows,
      updated: result.rows.length,
      message: `${result.rows.length} regions enabled`,
    });
  } catch (error) {
    console.error('POST /regions/bulk/enable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/regions/bulk/disable
 * Disable multiple regions
 */
router.post('/bulk/disable', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const result = await pool.query(
      `UPDATE regions SET enabled = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($1) RETURNING *`,
      [ids]
    );

    res.json({
      success: true,
      data: result.rows,
      updated: result.rows.length,
      message: `${result.rows.length} regions disabled`,
    });
  } catch (error) {
    console.error('POST /regions/bulk/disable error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
