const express = require('express');
const router = express.Router();
const pool = require('../lib/db');
const suburbsStore = require('../lib/suburbs-sync-store');

/**
 * GET /api/public/pick-pack-date?deliveryDate=2026-04-26&postcode=2000
 * 
 * Calculate pack date based on delivery date and region schedule
 * Returns both delivery and pack dates in YYYY/MM/DD format
 * 
 * Response:
 * {
 *   success: true,
 *   deliveryDate: "2026/04/26",
 *   packDate: "2026/04/25"
 * }
 */
router.get('/pick-pack-date', async (req, res) => {
  try {
    const { deliveryDate, postcode } = req.query;

    if (!deliveryDate || !postcode) {
      return res.status(400).json({
        success: false,
        error: 'deliveryDate and postcode query parameters required',
      });
    }

    // Parse delivery date
    let deliveryDateObj;
    try {
      deliveryDateObj = new Date(deliveryDate);
      if (isNaN(deliveryDateObj.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deliveryDate format. Expected YYYY-MM-DD',
      });
    }

    // Look up suburb by postcode (use in-memory store if available, fallback to DB)
    let suburb = null;
    try {
      suburb = suburbsStore.findByPostcode(postcode.toString());
    } catch (e) {
      // Fallback to PostgreSQL if store fails
      try {
        const suburbResult = await pool.query(
          `SELECT id, name, postcode, state, region_id FROM suburbs WHERE postcode::text = $1`,
          [postcode.toString()]
        );
        if (suburbResult.rows.length > 0) {
          suburb = suburbResult.rows[0];
        }
      } catch (dbError) {
        console.warn('Both in-memory store and database lookup failed:', dbError.message);
      }
    }

    if (!suburb) {
      return res.status(404).json({
        success: false,
        error: `Postcode ${postcode} not found`,
      });
    }

    if (!suburb.region_id) {
      return res.status(400).json({
        success: false,
        error: `Postcode ${postcode} is not assigned to a delivery region`,
      });
    }

    // Get region name
    let region = null;
    try {
      const regionResult = await pool.query(
        `SELECT id, name FROM regions WHERE id = $1`,
        [suburb.region_id]
      );
      if (regionResult.rows.length > 0) {
        region = regionResult.rows[0];
      }
    } catch (e) {
      console.warn('Region lookup failed:', e.message);
    }

    if (!region) {
      // Use a default region name if lookup fails
      const regionNames = {
        1: 'Sydney Metro',
        2: 'Newcastle',
        3: 'Central Coast',
        4: 'Wollongong',
        5: 'Canberra',
        6: 'Melbourne Metro',
        7: 'Geelong',
        8: 'Ballarat',
        9: 'Brisbane Metro',
      };
      region = {
        id: suburb.region_id,
        name: regionNames[suburb.region_id] || `Region ${suburb.region_id}`,
      };
    }

    // Get enabled schedules for this region
    let schedules = [];
    try {
      const schedulesResult = await pool.query(
        `SELECT * FROM delivery_schedules WHERE region_id = $1 AND enabled = true ORDER BY delivery_day`,
        [suburb.region_id]
      );
      schedules = schedulesResult.rows;
    } catch (e) {
      console.warn('Schedules lookup failed:', e.message);
      // Use default schedules if database is unavailable
      schedules = [
        { delivery_day: 'Sunday', pack_day: 'Saturday', cutoff_day: 4 },
        { delivery_day: 'Friday', pack_day: 'Thursday', cutoff_day: 4 },
      ];
    }

    if (schedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No delivery schedules available for region ${region.name}`,
      });
    }

    // Find the schedule for this delivery date
    const deliveryDayNum = deliveryDateObj.getDay();
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const deliveryDayName = dayMap[deliveryDayNum];

    const matchingSchedule = schedules.find(
      (s) => s.delivery_day === deliveryDayName
    );

    if (!matchingSchedule) {
      return res.status(400).json({
        success: false,
        error: `No delivery schedule found for ${deliveryDayName} in region ${region.name}`,
      });
    }

    // Calculate pack date from the schedule
    // The schedule has: cutoff_day, pack_day, delivery_day
    // We need to go backwards: delivery_date - N days to get pack_date
    const reverseDayMap = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
    };

    const packDayNum = reverseDayMap[matchingSchedule.pack_day];
    const dayDifference = (deliveryDayNum - packDayNum + 7) % 7;

    const packDateObj = new Date(deliveryDateObj);
    packDateObj.setDate(packDateObj.getDate() - dayDifference);

    // Format dates as YYYY/MM/DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };

    res.json({
      success: true,
      deliveryDate: formatDate(deliveryDateObj),
      packDate: formatDate(packDateObj),
      scheduleInfo: {
        region: region.name,
        deliveryDay: deliveryDayName,
        packDay: matchingSchedule.pack_day,
        cutoffDay: matchingSchedule.cutoff_day,
      },
    });
  } catch (error) {
    console.error('GET /api/public/pick-pack-date error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

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

    // 1. Look up suburb by postcode (use in-memory store first)
    let suburb = null;
    try {
      suburb = suburbsStore.findByPostcode(postcode.toString());
    } catch (e) {
      // Fallback to PostgreSQL
      try {
        const suburbResult = await pool.query(
          `SELECT id, name, postcode, state, region_id FROM suburbs WHERE postcode::text = $1`,
          [postcode.toString()]
        );
        if (suburbResult.rows.length > 0) {
          suburb = suburbResult.rows[0];
        }
      } catch (dbError) {
        console.warn('Database lookup failed:', dbError.message);
      }
    }

    if (!suburb) {
      return res.status(404).json({
        success: false,
        error: `Postcode ${postcode} not found`,
      });
    }

    if (!suburb.region_id) {
      return res.status(400).json({
        success: false,
        error: `Postcode ${postcode} is not assigned to a delivery region`,
      });
    }

    // 2. Get region name
    let region = null;
    try {
      const regionResult = await pool.query(
        `SELECT id, name FROM regions WHERE id = $1`,
        [suburb.region_id]
      );
      if (regionResult.rows.length > 0) {
        region = regionResult.rows[0];
      }
    } catch (e) {
      console.warn('Region lookup failed:', e.message);
    }

    if (!region) {
      const regionNames = {
        1: 'Sydney Metro',
        2: 'Newcastle',
        3: 'Central Coast',
        4: 'Wollongong',
        5: 'Canberra',
        6: 'Melbourne Metro',
        7: 'Geelong',
        8: 'Ballarat',
        9: 'Brisbane Metro',
      };
      region = {
        id: suburb.region_id,
        name: regionNames[suburb.region_id] || `Region ${suburb.region_id}`,
      };
    }

    // 3. Get enabled schedules for this region
    let schedules = [];
    try {
      const schedulesResult = await pool.query(
        `SELECT * FROM delivery_schedules WHERE region_id = $1 AND enabled = true ORDER BY delivery_day`,
        [suburb.region_id]
      );
      schedules = schedulesResult.rows;
    } catch (e) {
      console.warn('Schedules lookup failed:', e.message);
      // Use default schedules
      schedules = [
        { delivery_day: 'Sunday', pack_day: 'Saturday', cutoff_day: 4 },
        { delivery_day: 'Friday', pack_day: 'Thursday', cutoff_day: 4 },
      ];
    }

    if (schedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No delivery schedules available for region ${region.name}`,
      });
    }

    // 4. Calculate available delivery dates
    const today = new Date();
    const options = [];

    for (const schedule of schedules) {
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
