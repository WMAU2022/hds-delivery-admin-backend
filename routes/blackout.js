const express = require('express');
const pool = require('../lib/db');

const router = express.Router();

// Get all blackout dates
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM blackout_dates ORDER BY start_date DESC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching blackout dates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get blackout date by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM blackout_dates WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Blackout date not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching blackout date:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create blackout date
router.post('/', async (req, res) => {
  try {
    const { start_date, end_date, reason } = req.body;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required',
      });
    }
    
    const result = await pool.query(
      'INSERT INTO blackout_dates (start_date, end_date, reason, enabled) VALUES ($1, $2, $3, $4) RETURNING *',
      [start_date, end_date, reason || null, true]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating blackout date:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update blackout date
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, reason, enabled } = req.body;
    
    const result = await pool.query(
      'UPDATE blackout_dates SET start_date = COALESCE($1, start_date), end_date = COALESCE($2, end_date), reason = COALESCE($3, reason), enabled = COALESCE($4, enabled), updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [start_date || null, end_date || null, reason || null, enabled !== undefined ? enabled : null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Blackout date not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating blackout date:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Toggle blackout date enabled/disabled
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE blackout_dates SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Blackout date not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error toggling blackout date:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete blackout date
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM blackout_dates WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Blackout date not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Blackout date deleted',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting blackout date:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
