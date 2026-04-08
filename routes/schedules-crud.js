const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

// Day name to number mapping (0 = Sunday, 1 = Monday, etc.)
const DAY_MAP = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

const REVERSE_DAY_MAP = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

// Helper to convert day names to numbers
function convertDayToNumber(dayName) {
  if (typeof dayName === 'number') return dayName; // Already a number
  return DAY_MAP[dayName] !== undefined ? DAY_MAP[dayName] : null;
}

/**
 * GET /schedules
 * Get all delivery schedules
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM delivery_schedules ORDER BY region_id, delivery_day');
    // Convert day numbers back to names for frontend
    const schedules = result.rows.map(s => ({
      ...s,
      cutoff_day_name: REVERSE_DAY_MAP[s.cutoff_day] || 'Unknown',
      pack_day_name: REVERSE_DAY_MAP[s.pack_day] || 'Unknown',
      delivery_day_name: REVERSE_DAY_MAP[s.delivery_day] || 'Unknown'
    }));
    res.json({ data: schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /schedules/:id
 * Get a specific schedule
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM delivery_schedules WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    const s = result.rows[0];
    res.json({
      ...s,
      cutoff_day_name: REVERSE_DAY_MAP[s.cutoff_day] || 'Unknown',
      pack_day_name: REVERSE_DAY_MAP[s.pack_day] || 'Unknown',
      delivery_day_name: REVERSE_DAY_MAP[s.delivery_day] || 'Unknown'
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /schedules
 * Create a new delivery schedule
 */
router.post('/', async (req, res) => {
  try {
    const { region_id, cutoff_day, pack_day, delivery_day, hours, enabled, is_default } = req.body;

    // Convert day names to numbers
    const cutoffNum = convertDayToNumber(cutoff_day);
    const packNum = convertDayToNumber(pack_day);
    const deliveryNum = convertDayToNumber(delivery_day);

    if (cutoffNum === null || packNum === null || deliveryNum === null) {
      return res.status(400).json({ error: 'Invalid day name. Must be: Sunday-Saturday or 0-6' });
    }

    const result = await pool.query(
      `INSERT INTO delivery_schedules (region_id, cutoff_day, pack_day, delivery_day, hours, enabled, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [region_id, cutoffNum, packNum, deliveryNum, hours, enabled !== false, is_default === true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /schedules/:id
 * Update a delivery schedule
 */
router.put('/:id', async (req, res) => {
  try {
    const { cutoff_day, pack_day, delivery_day, hours, enabled, is_default } = req.body;

    // Convert day names to numbers if provided
    let cutoffNum = cutoff_day !== undefined ? convertDayToNumber(cutoff_day) : null;
    let packNum = pack_day !== undefined ? convertDayToNumber(pack_day) : null;
    let deliveryNum = delivery_day !== undefined ? convertDayToNumber(delivery_day) : null;

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
      [cutoffNum, packNum, deliveryNum, hours, enabled, is_default, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /schedules/:id/toggle
 * Toggle schedule enabled status
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE delivery_schedules 
       SET enabled = NOT enabled,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /schedules/:regionId/set-default/:scheduleId
 * Set a schedule as default for a region
 */
router.put('/:regionId/set-default/:scheduleId', async (req, res) => {
  try {
    // Clear all defaults for this region
    await pool.query(
      'UPDATE delivery_schedules SET is_default = false WHERE region_id = $1',
      [req.params.regionId]
    );

    // Set this schedule as default
    const result = await pool.query(
      `UPDATE delivery_schedules 
       SET is_default = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND region_id = $2
       RETURNING *`,
      [req.params.scheduleId, req.params.regionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true, schedule: result.rows[0] });
  } catch (error) {
    console.error('Error setting default schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /schedules/:id
 * Delete a delivery schedule
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM delivery_schedules WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
