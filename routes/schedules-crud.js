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
 * Get all delivery schedules (using memory store)
 */
router.get('/', (req, res) => {
  res.json({ data: store.getAll() });
});

/**
 * GET /schedules/:id
 * Get a specific schedule
 */
router.get('/:id', (req, res) => {
  const schedule = store.getById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json(schedule);
});

/**
 * POST /schedules
 * Create a new delivery schedule
 * Note: store.create() handles day name -> number conversion
 */
router.post('/', (req, res) => {
  try {
    const { region_id, cutoff_day, pack_day, delivery_day, hours, enabled, is_default } = req.body;

    if (!region_id || cutoff_day === undefined || pack_day === undefined || delivery_day === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const schedule = store.create({
      region_id,
      cutoff_day,
      pack_day,
      delivery_day,
      hours: hours || 'AM',
      enabled,
      is_default,
    });

    res.status(201).json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

/**
 * PUT /schedules/:id
 * Update a delivery schedule
 * Note: store.update() handles day name -> number conversion
 */
router.put('/:id', (req, res) => {
  try {
    const schedule = store.update(req.params.id, req.body);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /schedules/:id/toggle
 * Toggle schedule enabled status
 */
router.put('/:id/toggle', (req, res) => {
  try {
    const current = store.getById(req.params.id);
    if (!current) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    const schedule = store.update(req.params.id, { enabled: !current.enabled });
    res.json(schedule);
  } catch (error) {
    console.error('Error toggling schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /schedules/:regionId/set-default/:scheduleId
 * Set a schedule as default for a region
 */
router.put('/:regionId/set-default/:scheduleId', (req, res) => {
  try {
    // Clear all defaults for this region
    store.getAll()
      .filter(s => s.region_id === parseInt(req.params.regionId))
      .forEach(s => store.update(s.id, { is_default: false }));

    // Set this schedule as default
    const schedule = store.update(req.params.scheduleId, { is_default: true });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error setting default schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /schedules/:id
 * Delete a delivery schedule
 */
router.delete('/:id', (req, res) => {
  try {
    const success = store.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
