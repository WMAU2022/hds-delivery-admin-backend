const express = require('express');
const router = express.Router();
const suburbsStore = require('../lib/suburbs-sync-store');

/**
 * GET /api/suburbs
 * List all suburbs with pagination, search, and region filter
 */
router.get('/', async (req, res) => {
  try {
    const { search, regionId, page = 1, limit = 50 } = req.query;
    
    // Get all suburbs from store
    let allSuburbs = suburbsStore.getAll();
    
    // Filter by search (suburb name or postcode)
    if (search) {
      const searchLower = search.toLowerCase();
      allSuburbs = allSuburbs.filter(s => 
        s.name.toLowerCase().includes(searchLower) || 
        s.postcode.toString().includes(search)
      );
    }
    
    // Filter by region
    if (regionId) {
      const rid = parseInt(regionId);
      allSuburbs = allSuburbs.filter(s => s.region_id === rid);
    }
    
    // Paginate
    const pageNum = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNum - 1) * pageSize;
    const paginatedSuburbs = allSuburbs.slice(offset, offset + pageSize);
    
    res.json({
      success: true,
      data: paginatedSuburbs,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: allSuburbs.length,
        pages: Math.ceil(allSuburbs.length / pageSize),
      },
    });
  } catch (error) {
    console.error('GET /suburbs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/suburbs/:id
 * Get specific suburb
 */
router.get('/:id', async (req, res) => {
  try {
    const suburbId = parseInt(req.params.id);
    const suburb = suburbsStore.getById(suburbId);
    
    if (!suburb) {
      return res.status(404).json({ error: 'Suburb not found' });
    }
    
    res.json({
      success: true,
      data: suburb,
    });
  } catch (error) {
    console.error('GET /suburbs/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/suburbs/region/:regionId
 * Get all suburbs for a specific region
 */
router.get('/region/:regionId', async (req, res) => {
  try {
    const regionId = parseInt(req.params.regionId);
    const suburbsForRegion = suburbsStore.getByRegion(regionId);
    
    res.json({
      success: true,
      data: suburbsForRegion,
      count: suburbsForRegion.length,
    });
  } catch (error) {
    console.error('GET /suburbs/region/:regionId error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/suburbs
 * Add a new suburb (used during HDS sync)
 */
router.post('/', async (req, res) => {
  try {
    const { name, postcode, state, region_id, hds_zone, hds_zone_code, serviceable } = req.body;
    
    if (!name || !postcode || !state) {
      return res.status(400).json({ error: 'name, postcode, and state required' });
    }
    
    const newSuburb = suburbsStore.create({
      name,
      postcode,
      state,
      region_id: region_id || null,
      hds_zone: hds_zone || null,
      hds_zone_code: hds_zone_code || null,
      serviceable: serviceable !== false,
    });
    
    res.status(201).json({
      success: true,
      data: newSuburb,
    });
  } catch (error) {
    console.error('POST /suburbs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/suburbs/:id
 * Update suburb (e.g., assign to region)
 */
router.put('/:id', async (req, res) => {
  try {
    const suburbId = parseInt(req.params.id);
    const updates = req.body;
    
    const updated = suburbsStore.update(suburbId, updates);
    
    if (!updated) {
      return res.status(404).json({ error: 'Suburb not found' });
    }
    
    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('PUT /suburbs/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/suburbs/:id
 * Delete a suburb
 */
router.delete('/:id', async (req, res) => {
  try {
    const suburbId = parseInt(req.params.id);
    const deleted = suburbsStore.delete(suburbId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Suburb not found' });
    }
    
    res.json({
      success: true,
      message: 'Suburb deleted',
    });
  } catch (error) {
    console.error('DELETE /suburbs/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
