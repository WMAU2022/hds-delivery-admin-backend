/**
 * Enrichments API
 * Retrieve order enrichment data from order_enrichments table
 * No Shopify API calls - completely independent data source
 */

const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

/**
 * GET /api/enrichments/:orderId
 * Retrieve enriched HDS data for an order
 */
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT * FROM order_enrichments WHERE order_id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Enrichment not found',
        orderId,
        message: 'Order enrichment data not available yet or order is not a delivery order',
      });
    }

    const enrichment = result.rows[0];

    res.json({
      success: true,
      orderId,
      enrichment: {
        hds_delivery_date: enrichment.hds_delivery_date,
        hds_delivery_formatted: enrichment.hds_delivery_formatted,
        hds_delivery_day: enrichment.hds_delivery_day,
        hds_delivery_window: enrichment.hds_delivery_window,
        hds_delivery_time: enrichment.hds_delivery_time,
        hds_schedule_id: enrichment.hds_schedule_id,
        hds_pack_date: enrichment.hds_pack_date,
        hds_production_date: enrichment.hds_production_date,
        hds_region: enrichment.hds_region,
        hds_suburb: enrichment.hds_suburb,
        hds_postcode: enrichment.hds_postcode,
        created_at: enrichment.created_at,
        updated_at: enrichment.updated_at,
      },
    });
  } catch (err) {
    console.error('Error retrieving enrichment:', err.message);
    res.status(500).json({
      error: 'Failed to retrieve enrichment',
      message: err.message,
    });
  }
});

/**
 * POST /api/enrichments/batch
 * Retrieve enriched data for multiple orders
 */
router.post('/batch', async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'orderIds must be a non-empty array',
      });
    }

    const result = await pool.query(
      `SELECT order_id, hds_delivery_date, hds_delivery_formatted, hds_delivery_day,
              hds_delivery_window, hds_delivery_time, hds_schedule_id, hds_pack_date,
              hds_production_date, hds_region, hds_suburb, hds_postcode
       FROM order_enrichments 
       WHERE order_id = ANY($1)`,
      [orderIds]
    );

    const enrichments = {};
    for (const row of result.rows) {
      enrichments[row.order_id] = {
        hds_delivery_date: row.hds_delivery_date,
        hds_delivery_formatted: row.hds_delivery_formatted,
        hds_delivery_day: row.hds_delivery_day,
        hds_delivery_window: row.hds_delivery_window,
        hds_delivery_time: row.hds_delivery_time,
        hds_schedule_id: row.hds_schedule_id,
        hds_pack_date: row.hds_pack_date,
        hds_production_date: row.hds_production_date,
        hds_region: row.hds_region,
        hds_suburb: row.hds_suburb,
        hds_postcode: row.hds_postcode,
      };
    }

    res.json({
      success: true,
      enrichments,
      found: result.rows.length,
      requested: orderIds.length,
    });
  } catch (err) {
    console.error('Error retrieving batch enrichments:', err.message);
    res.status(500).json({
      error: 'Failed to retrieve enrichments',
      message: err.message,
    });
  }
});

module.exports = router;
