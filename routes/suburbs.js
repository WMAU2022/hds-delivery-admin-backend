const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

/**
 * GET /api/suburbs
 * List all suburbs with pagination, search, and region filter
 */
router.get('/', async (req, res) => {
  try {
    const { search, regionId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM suburbs WHERE 1=1';
    let params = [];
    let paramCount = 1;

    // Search by suburb name or postcode
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR postcode::text ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Filter by region
    if (regionId) {
      query += ` AND region_id = $${paramCount}`;
      params.push(parseInt(regionId));
      paramCount++;
    }

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM suburbs WHERE 1=1 ${
        search ? `AND (name ILIKE $1 OR postcode::text ILIKE $1)` : ''
      } ${regionId ? `AND region_id = $${search ? 2 : 1}` : ''}`,
      search ? [params[0], regionId].filter(p => p) : regionId ? [regionId] : []
    );

    // Get paginated results with region join
    query += ` ORDER BY name ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const suburbs = await pool.query(
      `SELECT s.*, r.name as region_name FROM suburbs s
       LEFT JOIN regions r ON s.region_id = r.id
       WHERE 1=1 ${
         search ? `AND (s.name ILIKE $1 OR s.postcode::text ILIKE $1)` : ''
       } ${regionId ? `AND s.region_id = $${search ? 2 : 1}` : ''}
       ORDER BY s.name ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      success: true,
      data: suburbs.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('GET /suburbs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/suburbs/:id
 * Get single suburb
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const suburb = await pool.query(
      `SELECT s.*, r.name as region_name FROM suburbs s
       LEFT JOIN regions r ON s.region_id = r.id
       WHERE s.id = $1`,
      [id]
    );

    if (suburb.rows.length === 0) {
      return res.status(404).json({ error: 'Suburb not found' });
    }

    res.json({
      success: true,
      data: suburb.rows[0],
    });
  } catch (error) {
    console.error('GET /suburbs/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/suburbs
 * Create new suburb
 */
router.post('/', async (req, res) => {
  try {
    const { name, postcode, state, region_id, serviceable } = req.body;

    if (!name || !postcode || !state) {
      return res.status(400).json({ error: 'name, postcode, state required' });
    }

    const result = await pool.query(
      `INSERT INTO suburbs (name, postcode, state, region_id, serviceable)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, postcode, state, region_id || null, serviceable !== false]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Suburb created',
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Suburb already exists' });
    }
    console.error('POST /suburbs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/suburbs/:id
 * Update suburb
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { region_id, serviceable } = req.body;

    const result = await pool.query(
      `UPDATE suburbs SET region_id = $1, serviceable = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [region_id || null, serviceable !== false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suburb not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Suburb updated',
    });
  } catch (error) {
    console.error('PUT /suburbs/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/suburbs/:id
 * Delete suburb
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM suburbs WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
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

/**
 * POST /api/suburbs/bulk/assign-region
 * Assign multiple suburbs to a region
 */
router.post('/bulk/assign-region', async (req, res) => {
  try {
    const { ids, region_id } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const result = await pool.query(
      `UPDATE suburbs SET region_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($2) RETURNING *`,
      [region_id || null, ids]
    );

    res.json({
      success: true,
      data: result.rows,
      updated: result.rows.length,
      message: `${result.rows.length} suburb(s) assigned to region`,
    });
  } catch (error) {
    console.error('POST /suburbs/bulk/assign-region error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/suburbs/import
 * Bulk import suburbs from array
 * Body: { suburbs: [{ name, postcode, state, region_id }, ...] }
 */
router.post('/import', async (req, res) => {
  try {
    const { suburbs } = req.body;

    if (!Array.isArray(suburbs) || suburbs.length === 0) {
      return res.status(400).json({ error: 'suburbs array required' });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const suburb of suburbs) {
      try {
        const { name, postcode, state, region_id } = suburb;

        if (!name || !postcode || !state) {
          skipped++;
          continue;
        }

        await pool.query(
          `INSERT INTO suburbs (name, postcode, state, region_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (name, postcode, state) DO NOTHING`,
          [name, postcode, state, region_id || null]
        );

        inserted++;
      } catch (err) {
        skipped++;
        errors.push(`${suburb.name}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      inserted,
      skipped,
      total: suburbs.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Imported ${inserted} suburbs, skipped ${skipped}`,
    });
  } catch (error) {
    console.error('POST /suburbs/import error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
