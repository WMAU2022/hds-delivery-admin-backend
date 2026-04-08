const express = require('express');
const router = express.Router();
const pool = require('../lib/db');

/**
 * GET /api/public/delivery-options?postcode=2000
 * 
 * Public API endpoint for Shopify checkout
 * Returns available delivery dates + windows for a given postcode
 * 
 * Response:
 * {
 *   success: true,
 *   region_id: 1,
 *   region_name: "Sydney Metro",
 *   postcode: "2000",
 *   options: [
 *     { id: 1, delivery_day: "Monday", window: "AM", cutoff: "Friday 2 PM", date: "2026-04-13" },
 *     { id: 2, delivery_day: "Wednesday", window: "Business Hours", cutoff: "Monday 2 PM", date: "2026-04-15" }
 *   ]
 * }
 */
router.get('/delivery-options', async (req, res) => {
  try {
    const { postcode } = req.query;

    if (!postcode) {
      return res.status(400).json({
        success: false,
        error: 'postcode query parameter required',
      });
    }

    // 1. Look up suburb by postcode
    const suburbResult = await pool.query(
      `SELECT id, name, postcode, state, region_id FROM suburbs WHERE postcode::text = $1`,
      [postcode.toString()]
    );

    if (suburbResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Postcode ${postcode} not found`,
      });
    }

    const suburb = suburbResult.rows[0];

    if (!suburb.region_id) {
      return res.status(400).json({
        success: false,
        error: `Postcode ${postcode} is not assigned to a delivery region`,
      });
    }

    // 2. Get region name
    const regionResult = await pool.query(
      `SELECT id, name FROM regions WHERE id = $1`,
      [suburb.region_id]
    );

    if (regionResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Region not found',
      });
    }

    const region = regionResult.rows[0];

    // 3. Get enabled schedules for this region
    const schedulesResult = await pool.query(
      `SELECT * FROM delivery_schedules WHERE region_id = $1 AND enabled = true ORDER BY delivery_day`,
      [suburb.region_id]
    );

    if (schedulesResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No delivery schedules available for region ${region.name}`,
      });
    }

    // 4. Calculate available delivery dates
    const today = new Date();
    const options = [];

    for (const schedule of schedulesResult.rows) {
      try {
        // Calculate next delivery date based on schedule
        const nextDeliveryDate = calculateNextDeliveryDate(
          today,
          schedule.cutoff_day,
          schedule.pack_day,
          schedule.delivery_day
        );

        // Skip if date is blackout (check blackout_dates table if needed)
        const isBlackout = await checkBlackoutDate(suburb.region_id, nextDeliveryDate);
        if (isBlackout) continue;

        options.push({
          schedule_id: schedule.id,
          delivery_day: schedule.delivery_day,
          delivery_window: schedule.hours || 'Standard Hours',
          cutoff_info: `${getDayName(schedule.cutoff_day)} 2 PM`,
          delivery_date: nextDeliveryDate.toISOString().split('T')[0],
          formatted_date: nextDeliveryDate.toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        });
      } catch (scheduleError) {
        console.error(`Error processing schedule ${schedule.id}:`, scheduleError);
      }
    }

    if (options.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No available delivery dates found',
      });
    }

    res.json({
      success: true,
      suburb: {
        name: suburb.name,
        postcode: suburb.postcode,
        state: suburb.state,
      },
      region: {
        id: region.id,
        name: region.name,
      },
      delivery_options: options,
      message: `${options.length} delivery options available`,
    });
  } catch (error) {
    console.error('GET /api/public/delivery-options error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Calculate next delivery date based on cutoff_day, pack_day, delivery_day
 * 
 * Example: If today is Tuesday, cutoff is Friday, pack is Saturday, deliver is Monday
 * - This Friday (cutoff passes) → pack Sat → deliver Mon
 * 
 * If today is Friday after 2 PM:
 * - Cutoff has passed, so next option is following Friday (cutoff) → pack Sat → deliver Mon
 */
function calculateNextDeliveryDate(today, cutoffDay, packDay, deliveryDay) {
  const dayMap = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };

  const reverseDayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const cutoffDayNum = reverseDayMap[cutoffDay] || 0;
  const deliveryDayNum = reverseDayMap[deliveryDay] || 0;

  let daysToAdd = 0;
  const todayNum = today.getDay();

  // If cutoff day hasn't happened this week, count days until it
  // Otherwise, count until next week's cutoff
  if (todayNum <= cutoffDayNum) {
    // Cutoff is still coming this week
    daysToAdd = deliveryDayNum - todayNum;
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Next week's delivery
    }
  } else {
    // Cutoff already passed, go to next week
    daysToAdd = 7 - todayNum + deliveryDayNum;
  }

  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

/**
 * Check if a date is blackout for the region
 */
async function checkBlackoutDate(regionId, date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM blackout_dates 
       WHERE region_id = $1 AND blackout_date = $2`,
      [regionId, dateStr]
    );
    return result.rows[0].count > 0;
  } catch (error) {
    console.error('Error checking blackout date:', error);
    return false;
  }
}

/**
 * Get readable day name from day number
 */
function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum] || days[0];
}

module.exports = router;
