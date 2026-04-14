const express = require('express');
const router = express.Router();
const regionsStore = require('../lib/regions-store');
const scheduleStore = require('../lib/memory-store');

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
    const updated = regionsStore.toggleMultiple(ids);
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
    const updated = regionsStore.enableMultiple(ids);
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
    const updated = regionsStore.disableMultiple(ids);
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
    const allRegions = regionsStore.getAll();
    const regionsWithSchedules = allRegions.map(region => ({
      ...region,
      schedules: scheduleStore.getByRegion(region.id),
    }));
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
    const region = regionsStore.getById(id);

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const schedules = scheduleStore.getByRegion(id);
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
 */
router.get('/:id/schedules', async (req, res) => {
  try {
    const { id } = req.params;
    const schedules = scheduleStore.getByRegion(id);
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
    const region = regionsStore.toggle(id);

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
    const region = regionsStore.enable(id);

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
    const region = regionsStore.disable(id);

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

module.exports = router;
