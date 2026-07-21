const express = require('express');
const router = express.Router();
const regionsStore = require('../lib/regions-store');
const pool = require('../lib/db');

const REVERSE_DAY_MAP = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

// ⚠️ BULK ROUTES FIRST - must come before /:id to avoid pattern matching issues

/**
 * POST /api/regions/bulk/toggle
 */
router.post('/bulk/toggle', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const updated = await regionsStore.toggleMultiple(ids);
    res.json({
      success: true,
      data: updated,
      updated: updated.length,
      message: `${updated.length} regions toggled`,
    });
  } catch (error) {
    console.error('POST /regions/bulk/toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/regions/bulk/enable
 */
router.post('/bulk/enable', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const updated = await regionsStore.enableMultiple(ids);
    res.json({
      success: true,
      data: updated,
      updated: updated.length,
      message: `${updated.length} regions enabled`,
    });
  } catch (error) {
    console.error('POST /regions/bulk/enable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/regions/bulk/disable
 */
router.post('/bulk/disable', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const updated = await regionsStore.disableMultiple(ids);
    res.json({
      success: true,
      data: updated,
      updated: updated.length,
      message: `${updated.length} regions disabled`,
    });
  } catch (error) {
    console.error('POST /regions/bulk/disable error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ⚠️ NOW THE DETAIL ROUTES

/**
 * GET /api/regions
 */
router.get('/', async (req, res) => {
  try {
    const allRegions = await regionsStore.getAll();
    
    // Fetch schedules from PostgreSQL for each region
    const regionsWithSchedules = await Promise.all(
      allRegions.map(async (region) => {
        const result = await pool.query(
          'SELECT * FROM delivery_schedules WHERE region_id = $1 ORDER BY id',
          [region.id]
        );
        const schedules = result.rows.map(schedule => {
          const cutoffNum = schedule.cutoff_day != null ? (typeof schedule.cutoff_day === 'string' ? parseInt(schedule.cutoff_day, 10) : schedule.cutoff_day) : null;
          const packNum = schedule.pack_day != null ? (typeof schedule.pack_day === 'string' ? parseInt(schedule.pack_day, 10) : schedule.pack_day) : null;
          const deliveryNum = schedule.delivery_day != null ? (typeof schedule.delivery_day === 'string' ? parseInt(schedule.delivery_day, 10) : schedule.delivery_day) : null;
          return {
            ...schedule,
            cutoff_day_name: cutoffNum != null ? REVERSE_DAY_MAP[cutoffNum] : null,
            pack_day_name: packNum != null ? REVERSE_DAY_MAP[packNum] : null,
            delivery_day_name: deliveryNum != null ? REVERSE_DAY_MAP[deliveryNum] : null,
          };
        });
        return {
          ...region,
          schedules: schedules,
        };
      })
    );
    
    res.json({
      success: true,
      data: regionsWithSchedules,
      count: regionsWithSchedules.length,
    });
  } catch (error) {
    console.error('GET /regions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/regions/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const region = await regionsStore.getById(id);

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    // Fetch schedules from PostgreSQL
    const result = await pool.query(
      'SELECT * FROM delivery_schedules WHERE region_id = $1 ORDER BY id',
      [parseInt(id)]
    );
    const schedules = result.rows.map(schedule => {
      const cutoffNum = schedule.cutoff_day != null ? (typeof schedule.cutoff_day === 'string' ? parseInt(schedule.cutoff_day, 10) : schedule.cutoff_day) : null;
      const packNum = schedule.pack_day != null ? (typeof schedule.pack_day === 'string' ? parseInt(schedule.pack_day, 10) : schedule.pack_day) : null;
      const deliveryNum = schedule.delivery_day != null ? (typeof schedule.delivery_day === 'string' ? parseInt(schedule.delivery_day, 10) : schedule.delivery_day) : null;
      return {
        ...schedule,
        cutoff_day_name: cutoffNum != null ? REVERSE_DAY_MAP[cutoffNum] : null,
        pack_day_name: packNum != null ? REVERSE_DAY_MAP[packNum] : null,
        delivery_day_name: deliveryNum != null ? REVERSE_DAY_MAP[deliveryNum] : null,
      };
    });

    res.json({
      success: true,
      data: {
        ...region,
        schedules: schedules,
      },
    });
  } catch (error) {
    console.error('GET /regions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/regions/:id/schedules
 * Frontend requests this endpoint to get schedules for a region
 * NOW READS FROM POSTGRESQL, NOT IN-MEMORY STORE
 */
router.get('/:id/schedules', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM delivery_schedules WHERE region_id = $1 ORDER BY id',
      [parseInt(id)]
    );
    const schedules = result.rows.map(schedule => {
      const cutoffNum = schedule.cutoff_day != null ? (typeof schedule.cutoff_day === 'string' ? parseInt(schedule.cutoff_day, 10) : schedule.cutoff_day) : null;
      const packNum = schedule.pack_day != null ? (typeof schedule.pack_day === 'string' ? parseInt(schedule.pack_day, 10) : schedule.pack_day) : null;
      const deliveryNum = schedule.delivery_day != null ? (typeof schedule.delivery_day === 'string' ? parseInt(schedule.delivery_day, 10) : schedule.delivery_day) : null;
      return {
        ...schedule,
        cutoff_day_name: cutoffNum != null ? REVERSE_DAY_MAP[cutoffNum] : null,
        pack_day_name: packNum != null ? REVERSE_DAY_MAP[packNum] : null,
        delivery_day_name: deliveryNum != null ? REVERSE_DAY_MAP[deliveryNum] : null,
      };
    });
    res.json({
      success: true,
      data: schedules,
      count: schedules.length,
    });
  } catch (error) {
    console.error('GET /regions/:id/schedules error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/regions/:id/toggle
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const region = await regionsStore.toggle(id);

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    console.log(`✅ Region ${id} toggled to ${region.enabled ? 'enabled' : 'disabled'}`);
    res.json({
      success: true,
      data: region,
      message: `Region ${region.enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('PUT /regions/:id/toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/regions/:id/enable
 */
router.put('/:id/enable', async (req, res) => {
  try {
    const { id } = req.params;
    const region = await regionsStore.enable(id);

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.json({
      success: true,
      data: region,
      message: 'Region enabled',
    });
  } catch (error) {
    console.error('PUT /regions/:id/enable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/regions/:id/disable
 */
router.put('/:id/disable', async (req, res) => {
  try {
    const { id } = req.params;
    const region = await regionsStore.disable(id);

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.json({
      success: true,
      data: region,
      message: 'Region disabled',
    });
  } catch (error) {
    console.error('PUT /regions/:id/disable error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/regions/:id/cutoff-time
 * Update cutoff time for a region (business rule - when orders stop)
 */
/**
 * PUT /api/regions/:id
 * Generic update route for region fields (cutoff_time, location, etc.)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }

    const region = await regionsStore.getById(id);
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    // Update the region with provided fields
    const updated = await regionsStore.update(id, updates);

    console.log(`✅ Region ${id} updated:`, updates);
    res.json({
      success: true,
      data: updated,
      message: 'Region updated successfully',
    });
  } catch (error) {
    console.error('PUT /regions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/cutoff-time', async (req, res) => {
  try {
    const { id } = req.params;
    const { cutoffTime } = req.body;

    if (!cutoffTime) {
      return res.status(400).json({ error: 'cutoffTime is required' });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?(AM|PM|am|pm)?$/;
    if (!timeRegex.test(cutoffTime)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM or HH:MM AM/PM' });
    }

    const region = await regionsStore.getById(id);
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    // Update the region with the new cutoff time
    const updated = await regionsStore.update(id, { cutoff_time: cutoffTime });

    console.log(`✅ Cutoff time for region ${id} updated to ${cutoffTime}`);
    res.json({
      success: true,
      data: updated,
      message: `Cutoff time updated to ${cutoffTime}`,
    });
  } catch (error) {
    console.error('PUT /regions/:id/cutoff-time error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
