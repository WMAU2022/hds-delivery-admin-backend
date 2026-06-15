const express = require('express');
const router = express.Router();
const pool = require('../lib/db');
const store = require('../lib/memory-store');

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
 * Get all delivery schedules (from PostgreSQL)
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM delivery_schedules ORDER BY region_id, id');
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /schedules/:id
 * Get a specific schedule (from PostgreSQL)
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM delivery_schedules WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /schedules
 * Create a new delivery schedule (write to PostgreSQL)
 */
router.post('/', async (req, res) => {
  try {
    const { region_id, cutoff_day, pack_day, delivery_day, hours, enabled, is_default } = req.body;

    if (!region_id || cutoff_day === undefined || pack_day === undefined || delivery_day === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into PostgreSQL
    const dbResult = await pool.query(
      `INSERT INTO delivery_schedules (region_id, cutoff_day, pack_day, delivery_day, hours, enabled, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [region_id, cutoff_day, pack_day, delivery_day, hours || 'AM', enabled !== false, is_default === true]
    );

    const schedule = dbResult.rows[0];

    // Also add to in-memory store for fast access
    store.create({
      id: schedule.id,
      region_id: schedule.region_id,
      cutoff_day: schedule.cutoff_day,
      pack_day: schedule.pack_day,
      delivery_day: schedule.delivery_day,
      hours: schedule.hours,
      enabled: schedule.enabled,
      is_default: schedule.is_default,
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

/**
 * PUT /schedules/:id
 * Update a delivery schedule (write to PostgreSQL)
 */
router.put('/:id', async (req, res) => {
  try {
    const { cutoff_day, pack_day, delivery_day, hours, enabled, is_default, location, has_am, has_business_hours } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (cutoff_day !== undefined) {
      updates.push(`cutoff_day = $${paramCount++}`);
      values.push(cutoff_day);
    }
    if (pack_day !== undefined) {
      updates.push(`pack_day = $${paramCount++}`);
      values.push(pack_day);
    }
    if (delivery_day !== undefined) {
      updates.push(`delivery_day = $${paramCount++}`);
      values.push(delivery_day);
    }
    if (hours !== undefined) {
      updates.push(`hours = $${paramCount++}`);
      values.push(hours);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramCount++}`);
      values.push(enabled);
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramCount++}`);
      values.push(is_default);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (has_am !== undefined) {
      updates.push(`has_am = $${paramCount++}`);
      values.push(has_am);
    }
    if (has_business_hours !== undefined) {
      updates.push(`has_business_hours = $${paramCount++}`);
      values.push(has_business_hours);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const query = `UPDATE delivery_schedules SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const dbResult = await pool.query(query, values);

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = dbResult.rows[0];

    // Also update in-memory store
    store.update(req.params.id, req.body);

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /schedules/:id/toggle
 * Toggle schedule enabled status (write to PostgreSQL)
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    // Get current state
    const result = await pool.query('SELECT enabled FROM delivery_schedules WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const currentEnabled = result.rows[0].enabled;
    const newEnabled = !currentEnabled;

    // Update in PostgreSQL
    const updateResult = await pool.query(
      'UPDATE delivery_schedules SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newEnabled, req.params.id]
    );

    const schedule = updateResult.rows[0];

    // Also update in-memory store
    store.update(req.params.id, { enabled: newEnabled });

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error toggling schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /schedules/:regionId/set-default/:scheduleId
 * Set a schedule as default for a region (write to PostgreSQL)
 */
router.put('/:regionId/set-default/:scheduleId', async (req, res) => {
  try {
    // Clear all defaults for this region in PostgreSQL
    await pool.query(
      'UPDATE delivery_schedules SET is_default = false, updated_at = NOW() WHERE region_id = $1',
      [req.params.regionId]
    );

    // Set this schedule as default
    const result = await pool.query(
      'UPDATE delivery_schedules SET is_default = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.scheduleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = result.rows[0];

    // Also update in-memory store
    store.getAll()
      .filter(s => s.region_id === parseInt(req.params.regionId))
      .forEach(s => store.update(s.id, { is_default: false }));
    store.update(req.params.scheduleId, { is_default: true });

    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error setting default schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /schedules/:id
 * Delete a delivery schedule (write to PostgreSQL)
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM delivery_schedules WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Also remove from in-memory store
    store.delete(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
