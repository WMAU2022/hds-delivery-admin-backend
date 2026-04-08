const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

/**
 * GET /api/schedules/:regionId
 * Get all schedules for a region
 */
router.get('/region/:regionId', async (req, res) => {
  try {
    const { regionId } = req.params;

    const schedules = await pool.query(
      `SELECT * FROM delivery_schedules WHERE region_id = $1 ORDER BY id`,
      [regionId]
    );

    res.json({
      success: true,
      data: schedules.rows,
    });
  } catch (error) {
    console.error('GET /schedules/region/:regionId error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/schedules/:id
 * Get single schedule
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await pool.query(
      `SELECT * FROM delivery_schedules WHERE id = $1`,
      [id]
    );

    if (schedule.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({
      success: true,
      data: schedule.rows[0],
    });
  } catch (error) {
    console.error('GET /schedules/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/schedules
 * Create new schedule
 */
router.post('/', async (req, res) => {
  try {
    const { region_id, cutoff_day, pack_day, delivery_day, hours, enabled } = req.body;

    if (!region_id || !cutoff_day || !pack_day || !delivery_day) {
      return res.status(400).json({
        error: 'region_id, cutoff_day, pack_day, delivery_day required',
      });
    }

    const result = await pool.query(
      `INSERT INTO delivery_schedules (region_id, cutoff_day, pack_day, delivery_day, hours, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [region_id, cutoff_day, pack_day, delivery_day, hours || null, enabled !== false]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Schedule created',
    });
  } catch (error) {
    console.error('POST /schedules error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schedules/:id
 * Update schedule
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cutoff_day, pack_day, delivery_day, hours, enabled, is_default } = req.body;

    const result = await pool.query(
      `UPDATE delivery_schedules 
       SET cutoff_day = COALESCE($1, cutoff_day),
           pack_day = COALESCE($2, pack_day),
           delivery_day = COALESCE($3, delivery_day),
           hours = COALESCE($4, hours),
           enabled = COALESCE($5, enabled),
           is_default = COALESCE($6, is_default),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [cutoff_day, pack_day, delivery_day, hours, enabled, is_default, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Schedule updated',
    });
  } catch (error) {
    console.error('PUT /schedules/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schedules/:id/toggle
 * Toggle schedule enabled/disabled
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE delivery_schedules 
       SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Schedule ${result.rows[0].enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('PUT /schedules/:id/toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/schedules/:regionId/set-default/:scheduleId
 * Set a schedule as default for region
 */
router.put('/:regionId/set-default/:scheduleId', async (req, res) => {
  try {
    const { regionId, scheduleId } = req.params;

    // First, clear all is_default flags for this region
    await pool.query(
      `UPDATE delivery_schedules SET is_default = false WHERE region_id = $1`,
      [regionId]
    );

    // Then set the selected one as default
    const result = await pool.query(
      `UPDATE delivery_schedules 
       SET is_default = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND region_id = $2
       RETURNING *`,
      [scheduleId, regionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Default schedule updated',
    });
  } catch (error) {
    console.error('PUT /schedules/:regionId/set-default/:scheduleId error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete schedule
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM delivery_schedules WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({
      success: true,
      message: 'Schedule deleted',
    });
  } catch (error) {
    console.error('DELETE /schedules/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
