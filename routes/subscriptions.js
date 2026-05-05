const express = require('express');
const router = express.Router();
const pool = require('../lib/db');
const { calculateOffsetFromSchedule, calculateNextDeliveryDate } = require('../lib/offset-calculator');

/**
 * POST /api/subscriptions/create-mapping-from-order
 * Auto-create subscription mapping from first order's HDS delivery data
 * Called after customer completes first order with HDS delivery + Loop subscription
 */
router.post('/create-mapping-from-order', async (req, res) => {
  const { shopify_order_id, loop_subscription_id, customer_id, customer_email } = req.body;

  if (!shopify_order_id || !loop_subscription_id) {
    return res.status(400).json({
      error: 'Missing: shopify_order_id, loop_subscription_id'
    });
  }

  try {
    const axios = require('axios');
    const shopifyToken = process.env.SHOPIFY_ADMIN_TOKEN;
    const shopifyStore = process.env.SHOPIFY_STORE;

    if (!shopifyToken || !shopifyStore) {
      return res.status(500).json({ error: 'Missing Shopify credentials' });
    }

    // 1. Fetch order from Shopify
    const orderResponse = await axios.get(
      `https://${shopifyStore}/admin/api/2024-01/orders/${shopify_order_id}.json`,
      { headers: { 'X-Shopify-Access-Token': shopifyToken } }
    );

    const order = orderResponse.data.order;
    if (!order.note_attributes) {
      return res.status(400).json({
        error: 'Order has no HDS delivery data',
        shopify_order_id
      });
    }

    // 2. Extract HDS data
    let hdsData = {};
    order.note_attributes.forEach(attr => {
      if (attr.name && attr.name.startsWith('hds_')) {
        hdsData[attr.name] = attr.value;
      }
    });

    if (!hdsData.hds_delivery_date || !hdsData.hds_pack_date) {
      return res.status(400).json({
        error: 'Order missing hds_delivery_date or hds_pack_date'
      });
    }

    // 3. Parse dates
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const deliveryDate = new Date(hdsData.hds_delivery_date);
    const packDate = new Date(hdsData.hds_pack_date);
    const deliveryDayName = dayNames[deliveryDate.getDay()];
    const packDayName = dayNames[packDate.getDay()];

    // 4. Find matching schedule
    const scheduleResult = await pool.query(
      `SELECT * FROM delivery_schedules 
       WHERE pack_day = $1 AND delivery_day = $2 AND enabled = true LIMIT 1`,
      [packDayName, deliveryDayName]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(400).json({
        error: `No schedule found for ${packDayName}→${deliveryDayName}`
      });
    }

    const schedule = scheduleResult.rows[0];
    const offsetDays = calculateOffsetFromSchedule(schedule, 'pack_day');

    // 5. Create mapping
    const result = await pool.query(
      `INSERT INTO subscription_hds_mapping 
       (loop_subscription_id, hds_schedule_id, hds_region_id, offset_days, 
        delivery_day, pack_day, cutoff_day, customer_id, customer_email, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
       RETURNING *`,
      [
        loop_subscription_id, schedule.id, schedule.region_id, offsetDays,
        schedule.delivery_day, schedule.pack_day, schedule.cutoff_day,
        customer_id || null, customer_email || null
      ]
    );

    await pool.query(
      `INSERT INTO subscription_changes_log (loop_subscription_id, change_type, new_value, reason, changed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        loop_subscription_id, 'created_from_order',
        JSON.stringify({ hds_schedule_id: schedule.id, offset_days: offsetDays, from_order: shopify_order_id }),
        `Auto-mapped from order (${packDayName}→${deliveryDayName})`
      ]
    );

    res.status(201).json({
      success: true,
      mapping_id: result.rows[0].id,
      loop_subscription_id,
      hds_schedule_id: schedule.id,
      delivery_day: schedule.delivery_day,
      pack_day: schedule.pack_day,
      offset_days: offsetDays,
      message: `Mapped to ${packDayName}→${deliveryDayName} schedule`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/subscriptions/map-to-hds
 * Create mapping between Loop subscription and HDS schedule
 * Called when a new subscription is created in Loop
 */
router.post('/map-to-hds', async (req, res) => {
  const { loop_subscription_id, hds_schedule_id, hds_region_id, customer_id, customer_email } = req.body;

  if (!loop_subscription_id || !hds_schedule_id || !hds_region_id) {
    return res.status(400).json({
      error: 'Missing required fields: loop_subscription_id, hds_schedule_id, hds_region_id'
    });
  }

  try {
    // Get the schedule details
    const scheduleResult = await pool.query(
      'SELECT cutoff_day, pack_day, delivery_day FROM delivery_schedules WHERE id = $1',
      [hds_schedule_id]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = scheduleResult.rows[0];

    // Calculate offset (use pack_day as basis for reliability)
    const offsetDays = calculateOffsetFromSchedule(schedule, 'pack_day');

    // Insert mapping
    const result = await pool.query(
      `INSERT INTO subscription_hds_mapping 
       (loop_subscription_id, hds_schedule_id, hds_region_id, offset_days, 
        delivery_day, pack_day, cutoff_day, customer_id, customer_email, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
       RETURNING *`,
      [
        loop_subscription_id,
        hds_schedule_id,
        hds_region_id,
        offsetDays,
        schedule.delivery_day,
        schedule.pack_day,
        schedule.cutoff_day,
        customer_id || null,
        customer_email || null,
      ]
    );

    // Log the change
    await pool.query(
      `INSERT INTO subscription_changes_log 
       (loop_subscription_id, change_type, new_value, reason, changed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        loop_subscription_id,
        'created',
        JSON.stringify({ hds_schedule_id, offset_days: offsetDays }),
        'Initial subscription mapping'
      ]
    );

    res.status(201).json({
      success: true,
      mapping_id: result.rows[0].id,
      loop_subscription_id,
      hds_schedule_id,
      offset_days: offsetDays,
      delivery_day: schedule.delivery_day,
      pack_day: schedule.pack_day,
      message: `Subscription mapped to schedule ${hds_schedule_id} with ${offsetDays}-day offset`
    });

  } catch (error) {
    console.error('Error creating subscription mapping:', error);
    
    // Check if duplicate subscription ID
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Subscription already mapped',
        loop_subscription_id
      });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/subscriptions/map/:loop_subscription_id
 * Get mapping for a Loop subscription
 * Used by webhook handler to look up HDS details for auto-charge
 */
router.get('/map/:loop_subscription_id', async (req, res) => {
  const { loop_subscription_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM subscription_hds_mapping 
       WHERE loop_subscription_id = $1 AND active = true`,
      [loop_subscription_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Subscription mapping not found',
        loop_subscription_id
      });
    }

    const mapping = result.rows[0];

    res.json({
      success: true,
      mapping_id: mapping.id,
      loop_subscription_id: mapping.loop_subscription_id,
      hds_schedule_id: mapping.hds_schedule_id,
      hds_region_id: mapping.hds_region_id,
      offset_days: mapping.offset_days,
      delivery_day: mapping.delivery_day,
      pack_day: mapping.pack_day,
      cutoff_day: mapping.cutoff_day,
      customer_id: mapping.customer_id,
      customer_email: mapping.customer_email,
      active: mapping.active,
      created_at: mapping.created_at,
      updated_at: mapping.updated_at,
    });

  } catch (error) {
    console.error('Error fetching subscription mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/subscriptions/map/:loop_subscription_id
 * Update mapping (e.g., customer changes delivery day)
 */
router.put('/map/:loop_subscription_id', async (req, res) => {
  const { loop_subscription_id } = req.params;
  const { hds_schedule_id, reason } = req.body;

  if (!hds_schedule_id) {
    return res.status(400).json({ error: 'hds_schedule_id required' });
  }

  try {
    // Get current mapping
    const currentResult = await pool.query(
      'SELECT * FROM subscription_hds_mapping WHERE loop_subscription_id = $1',
      [loop_subscription_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription mapping not found' });
    }

    const current = currentResult.rows[0];

    // Get new schedule details
    const scheduleResult = await pool.query(
      'SELECT cutoff_day, pack_day, delivery_day FROM delivery_schedules WHERE id = $1',
      [hds_schedule_id]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = scheduleResult.rows[0];
    const newOffset = calculateOffsetFromSchedule(schedule, 'pack_day');

    // Update mapping
    const result = await pool.query(
      `UPDATE subscription_hds_mapping
       SET hds_schedule_id = $1, offset_days = $2, delivery_day = $3, 
           pack_day = $4, cutoff_day = $5, updated_at = NOW()
       WHERE loop_subscription_id = $6
       RETURNING *`,
      [
        hds_schedule_id,
        newOffset,
        schedule.delivery_day,
        schedule.pack_day,
        schedule.cutoff_day,
        loop_subscription_id
      ]
    );

    // Log the change
    await pool.query(
      `INSERT INTO subscription_changes_log 
       (loop_subscription_id, change_type, old_value, new_value, reason, changed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        loop_subscription_id,
        'schedule_updated',
        JSON.stringify({ old_schedule: current.hds_schedule_id, old_offset: current.offset_days }),
        JSON.stringify({ new_schedule: hds_schedule_id, new_offset: newOffset }),
        reason || 'Manual update'
      ]
    );

    res.json({
      success: true,
      message: `Subscription updated: ${current.offset_days}-day offset → ${newOffset}-day offset`,
      old_schedule_id: current.hds_schedule_id,
      new_schedule_id: hds_schedule_id,
      old_offset_days: current.offset_days,
      new_offset_days: newOffset,
      updated_at: result.rows[0].updated_at
    });

  } catch (error) {
    console.error('Error updating subscription mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/subscriptions/map/:loop_subscription_id
 * Deactivate subscription mapping (when subscription is cancelled)
 */
router.delete('/map/:loop_subscription_id', async (req, res) => {
  const { loop_subscription_id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE subscription_hds_mapping
       SET active = false, updated_at = NOW()
       WHERE loop_subscription_id = $1
       RETURNING *`,
      [loop_subscription_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription mapping not found' });
    }

    // Log the change
    await pool.query(
      `INSERT INTO subscription_changes_log 
       (loop_subscription_id, change_type, reason, changed_at)
       VALUES ($1, $2, $3, NOW())`,
      [loop_subscription_id, 'deactivated', 'Subscription cancelled or mapping removed']
    );

    res.json({
      success: true,
      message: 'Subscription mapping deactivated',
      loop_subscription_id
    });

  } catch (error) {
    console.error('Error deactivating subscription mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/subscriptions/map/:loop_subscription_id/next-charge
 * Get calculated next charge and delivery dates for a subscription
 * Useful for admin dashboard to verify timing
 */
router.get('/map/:loop_subscription_id/next-charge', async (req, res) => {
  const { loop_subscription_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM subscription_hds_mapping WHERE loop_subscription_id = $1 AND active = true',
      [loop_subscription_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription mapping not found' });
    }

    const mapping = result.rows[0];

    // Calculate next delivery and charge dates
    const dates = calculateNextDeliveryDate(mapping.delivery_day, mapping.offset_days);

    res.json({
      success: true,
      loop_subscription_id,
      hds_schedule_id: mapping.hds_schedule_id,
      schedule: {
        cutoff_day: mapping.cutoff_day,
        pack_day: mapping.pack_day,
        delivery_day: mapping.delivery_day,
      },
      timing: {
        offset_days: mapping.offset_days,
        next_delivery_date: dates.next_delivery_date,
        charge_date: dates.charge_date,
        days_until_delivery: dates.days_until_delivery,
        calculation_timestamp: dates.calculation_timestamp
      }
    });

  } catch (error) {
    console.error('Error calculating next charge:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/subscriptions/logs/:loop_subscription_id
 * Get audit log for a subscription
 */
router.get('/logs/:loop_subscription_id', async (req, res) => {
  const { loop_subscription_id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM subscription_changes_log 
       WHERE loop_subscription_id = $1 
       ORDER BY changed_at DESC 
       LIMIT $2 OFFSET $3`,
      [loop_subscription_id, parseInt(limit), parseInt(offset)]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM subscription_changes_log WHERE loop_subscription_id = $1',
      [loop_subscription_id]
    );

    res.json({
      success: true,
      loop_subscription_id,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching subscription logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/subscriptions/:loop_subscription_id/available-delivery-days
 * Get available delivery days for subscription's region
 * Loop portal uses this to populate day selector
 */
router.get('/:loop_subscription_id/available-delivery-days', async (req, res) => {
  const { loop_subscription_id } = req.params;

  try {
    // Get subscription mapping + region
    const mappingResult = await pool.query(
      `SELECT m.*, r.name as region_name FROM subscription_hds_mapping m
       JOIN regions r ON m.hds_region_id = r.id
       WHERE m.loop_subscription_id = $1 AND m.active = true`,
      [loop_subscription_id]
    );

    if (mappingResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Subscription mapping not found',
        loop_subscription_id
      });
    }

    const mapping = mappingResult.rows[0];

    // Get all enabled schedules for this region
    const schedulesResult = await pool.query(
      `SELECT id, delivery_day, pack_day, cutoff_day, enabled 
       FROM delivery_schedules 
       WHERE region_id = $1 AND enabled = true
       ORDER BY CASE delivery_day
         WHEN 'Sunday' THEN 1 WHEN 'Monday' THEN 2 WHEN 'Tuesday' THEN 3
         WHEN 'Wednesday' THEN 4 WHEN 'Thursday' THEN 5 WHEN 'Friday' THEN 6
         WHEN 'Saturday' THEN 7 END`,
      [mapping.hds_region_id]
    );

    if (schedulesResult.rows.length === 0) {
      return res.status(400).json({
        error: `No schedules available for ${mapping.region_name}`,
        region_id: mapping.hds_region_id
      });
    }

    const availableDays = schedulesResult.rows.map(s => ({
      schedule_id: s.id,
      delivery_day: s.delivery_day,
      pack_day: s.pack_day,
      cutoff_day: s.cutoff_day
    }));

    res.json({
      success: true,
      loop_subscription_id,
      region_id: mapping.hds_region_id,
      region_name: mapping.region_name,
      current_delivery_day: mapping.delivery_day,
      current_pack_day: mapping.pack_day,
      available_days: availableDays,
      message: `${availableDays.length} days available for ${mapping.region_name}`
    });

  } catch (error) {
    console.error('Error fetching available days:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/subscriptions/:loop_subscription_id/update-delivery-day
 * Customer changes delivery day in Loop portal
 * Validates availability, updates subscription mapping
 */
router.put('/:loop_subscription_id/update-delivery-day', async (req, res) => {
  const { loop_subscription_id } = req.params;
  const { new_delivery_day, new_schedule_id } = req.body;

  if (!new_delivery_day || !new_schedule_id) {
    return res.status(400).json({
      error: 'Missing: new_delivery_day, new_schedule_id'
    });
  }

  try {
    // Get current mapping
    const currentResult = await pool.query(
      `SELECT m.*, r.name as region_name FROM subscription_hds_mapping m
       JOIN regions r ON m.hds_region_id = r.id
       WHERE m.loop_subscription_id = $1 AND m.active = true`,
      [loop_subscription_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Subscription mapping not found',
        loop_subscription_id
      });
    }

    const current = currentResult.rows[0];

    // Validate new schedule
    const newScheduleResult = await pool.query(
      `SELECT * FROM delivery_schedules 
       WHERE id = $1 AND region_id = $2 AND enabled = true`,
      [new_schedule_id, current.hds_region_id]
    );

    if (newScheduleResult.rows.length === 0) {
      return res.status(400).json({
        error: `Schedule ${new_schedule_id} not available for ${current.region_name}`
      });
    }

    const newSchedule = newScheduleResult.rows[0];

    // Verify day name matches
    if (newSchedule.delivery_day !== new_delivery_day) {
      return res.status(400).json({
        error: `Day mismatch: requested ${new_delivery_day}, schedule has ${newSchedule.delivery_day}`
      });
    }

    // Calculate offset and update
    const newOffset = calculateOffsetFromSchedule(newSchedule, 'pack_day');

    const result = await pool.query(
      `UPDATE subscription_hds_mapping
       SET hds_schedule_id = $1, offset_days = $2, delivery_day = $3, 
           pack_day = $4, cutoff_day = $5, updated_at = NOW()
       WHERE loop_subscription_id = $6
       RETURNING *`,
      [
        new_schedule_id, newOffset, newSchedule.delivery_day,
        newSchedule.pack_day, newSchedule.cutoff_day, loop_subscription_id
      ]
    );

    // Log change
    await pool.query(
      `INSERT INTO subscription_changes_log 
       (loop_subscription_id, change_type, old_value, new_value, reason, changed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        loop_subscription_id, 'delivery_day_updated',
        JSON.stringify({ old_day: current.delivery_day, old_pack_day: current.pack_day }),
        JSON.stringify({ new_day: newSchedule.delivery_day, new_pack_day: newSchedule.pack_day }),
        'Customer changed via portal'
      ]
    );

    res.json({
      success: true,
      loop_subscription_id,
      old_day: current.delivery_day,
      new_day: newSchedule.delivery_day,
      old_pack_day: current.pack_day,
      new_pack_day: newSchedule.pack_day,
      message: `Updated: ${current.delivery_day} → ${newSchedule.delivery_day}`
    });

  } catch (error) {
    console.error('Error updating day:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
