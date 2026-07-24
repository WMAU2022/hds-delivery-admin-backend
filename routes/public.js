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

    // Calculate production date (1 day before pack date)
    const productionDateObj = new Date(packDateObj);
    productionDateObj.setDate(productionDateObj.getDate() - 1);

    res.json({
      success: true,
      deliveryDate: formatDate(deliveryDateObj),
      packDate: formatDate(packDateObj),
      productionDate: formatDate(productionDateObj),
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
    const { postcode, suburb } = req.query;

    // REQUIRE BOTH suburb and postcode
    if (!postcode || !suburb) {
      return res.status(400).json({
        success: false,
        error: 'suburb and postcode are required query parameters',
      });
    }

    // 1. Look up the EXACT suburb + postcode combination
    // TRY IN-MEMORY STORE FIRST (has all HDS data), then fall back to PostgreSQL
    let suburbRecord = null;
    
    // Try in-memory store first
    try {
      if (suburbsStore && typeof suburbsStore.getAll === 'function') {
        const allSuburbs = suburbsStore.getAll();
        suburbRecord = allSuburbs.find(s => 
          s.postcode === postcode.toString() && 
          s.name.toUpperCase() === suburb.toString().toUpperCase()
        );
      }
    } catch (e) {
      console.warn('In-memory store lookup failed:', e.message);
    }
    
    // Fallback to PostgreSQL if not found in store
    if (!suburbRecord) {
      try {
        const suburbResult = await pool.query(
          `SELECT id, name, postcode, state, region_id FROM suburbs 
           WHERE postcode::text = $1 AND UPPER(name) = UPPER($2)`,
          [postcode.toString(), suburb.toString()]
        );
        if (suburbResult.rows.length > 0) {
          suburbRecord = suburbResult.rows[0];
        }
      } catch (dbError) {
        console.warn('Database lookup failed:', dbError.message);
      }
    }

    // Return error if suburb not found or doesn't belong to postcode
    if (!suburbRecord) {
      return res.status(200).json({
        success: false,
        serviceable: false,
        error: `${suburb} (${postcode}) is not available for delivery`,
      });
    }

    // Reject placeholder/depot suburbs
    const placeholderPatterns = [
      /DELIVERY CENTRE/i,
      /DEPOT/i,
      /MAIL CENTRE/i,
      /PARCEL FACILITY/i,
    ];
    
    if (placeholderPatterns.some(pattern => pattern.test(suburbRecord.name))) {
      return res.status(200).json({
        success: false,
        serviceable: false,
        error: `${suburbRecord.name} (${postcode}) is a logistics facility, not a residential area`,
      });
    }

    if (!suburbRecord.region_id) {
      return res.status(400).json({
        success: false,
        error: `${suburbRecord.name} (${postcode}) is not assigned to a delivery region`,
      });
    }

    // 2. Get region name
    let region = null;
    try {
      const regionResult = await pool.query(
        `SELECT id, name FROM regions WHERE id = $1`,
        [suburbRecord.region_id]
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
        id: suburbRecord.region_id,
        name: regionNames[suburbRecord.region_id] || `Region ${suburbRecord.region_id}`,
      };
    }

    // 3. Get enabled schedules for this region
    let schedules = [];
    let dbError = false;
    try {
      const schedulesResult = await pool.query(
        `SELECT * FROM delivery_schedules WHERE region_id = $1 AND enabled = true ORDER BY delivery_day`,
        [suburbRecord.region_id]
      );
      schedules = schedulesResult.rows;
    } catch (e) {
      console.warn('Schedules lookup failed:', e.message);
      dbError = true;
    }

    // If no schedules found and no database error, location is not serviceable
    if (schedules.length === 0 && !dbError) {
      return res.status(404).json({
        success: false,
        error: `Location ${suburb.name} (${postcode}) is not available for delivery. No schedules configured.`,
        serviceable: false,
      });
    }

    // If database error AND no schedules, return error (can't determine availability)
    if (schedules.length === 0 && dbError) {
      return res.status(400).json({
        success: false,
        error: `No delivery schedules available for region ${region.name}`,
      });
    }

    // 4. Calculate available delivery dates + pack dates
    const today = new Date();
    const options = [];
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const reverseDayMap = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
    };

    for (const schedule of schedules) {
      try {
        // Convert numeric day values to day names
        const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const cutoffDayName = typeof schedule.cutoff_day === 'number' ? dayMap[schedule.cutoff_day] : schedule.cutoff_day;
        const packDayName = typeof schedule.pack_day === 'number' ? dayMap[schedule.pack_day] : schedule.pack_day;
        const deliveryDayName = typeof schedule.delivery_day === 'number' ? dayMap[schedule.delivery_day] : schedule.delivery_day;
        console.log(`📅 Processing schedule ${schedule.id}: cutoff=${cutoffDayName}, pack=${packDayName}, delivery=${deliveryDayName}`);
        
        // Get cutoff time from region (default to 23:00 / 11 PM for orders, shown as 2 PM display fallback)
        let cutoffTime = '23:00';  // Default cutoff time: 11 PM
        try {
          const regionCutoffResult = await pool.query(
            `SELECT cutoff_time FROM regions WHERE id = $1`,
            [suburbRecord.region_id]
          );
          if (regionCutoffResult.rows.length > 0) {
            const dbCutoffTime = regionCutoffResult.rows[0].cutoff_time;
            if (dbCutoffTime && dbCutoffTime.trim() !== '') {
              cutoffTime = dbCutoffTime;
            }
          }
        } catch (e) {
          console.warn('Could not fetch cutoff time from region:', e.message);
        }
        console.log(`⏰ Region cutoff time: ${cutoffTime}`);
        
        // Generate 6 upcoming delivery dates for this schedule
        // Start by calculating the first available date, then add 7 days for each iteration
        let currentDate = new Date(today);
        for (let i = 0; i < 6; i++) {
          const deliveryDate = calculateNextDeliveryDate(
            currentDate,
            cutoffDayName,
            packDayName,
            deliveryDayName,
            cutoffTime  // Pass cutoff time for proper cutoff checking
          );
          // Move to the next week for the next iteration
          currentDate = new Date(deliveryDate);
          currentDate.setDate(currentDate.getDate() + 7);

          // Skip if date is blackout
          const isBlackout = await checkBlackoutDate(suburb.region_id, deliveryDate);
          if (isBlackout) continue;

          // Calculate pack date from delivery date and pack day
          const deliveryDayNum = deliveryDate.getDay();
          const packDayNum = reverseDayMap[packDayName];
          const dayDifference = (deliveryDayNum - packDayNum + 7) % 7;
          const packDateObj = new Date(deliveryDate);
          packDateObj.setDate(packDateObj.getDate() - dayDifference);
          const packDateStr = packDateObj.toISOString().split('T')[0];

          // Calculate production date (1 day before pack date)
          const productionDateObj = new Date(packDateObj);
          productionDateObj.setDate(productionDateObj.getDate() - 1);
          const productionDateStr = productionDateObj.toISOString().split('T')[0];

          // Format cutoff time for display (e.g., "23:00" → "11 PM", "14:00" → "2 PM")
          const displayCutoffTime = formatCutoffTime(cutoffTime);

          options.push({
            schedule_id: schedule.id,
            delivery_day: deliveryDayName,
            delivery_window: schedule.hours || 'Standard Hours',
            cutoff_info: `${cutoffDayName} ${displayCutoffTime}`,
            delivery_date: deliveryDate.toISOString().split('T')[0],
            pack_date: packDateStr,
            pack_day: packDayName,
            production_date: productionDateStr,
            formatted_date: deliveryDate.toLocaleDateString('en-AU', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            formatted_pack_date: packDateObj.toLocaleDateString('en-AU', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
            formatted_production_date: productionDateObj.toLocaleDateString('en-AU', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
          });
        }
      } catch (scheduleError) {
        console.error(`Error processing schedule ${schedule.id}:`, scheduleError);
      }
    }

    if (options.length === 0) {
      console.log(`⚠️  No delivery dates calculated. Schedules found: ${schedules.length}, Options generated: ${options.length}`);
      return res.status(400).json({
        success: false,
        error: 'No available delivery dates found',
        debug: {
          postcode: postcode,
          region: region,
          schedules_count: schedules.length,
          options_count: options.length,
        },
      });
    }

    res.json({
      success: true,
      suburb: {
        name: suburbRecord.name,
        postcode: suburbRecord.postcode,
        state: suburbRecord.state,
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
 * Calculate next delivery date based on cutoff_day, pack_day, delivery_day, and cutoff_time
 * 
 * Logic:
 * 1. If cutoff day hasn't happened yet this week → use this week's dates
 * 2. If cutoff day is today but time hasn't passed → use this week's dates
 * 3. If cutoff day is today AND time has passed → skip to next week
 * 4. If cutoff day already passed → skip to next week
 */
function calculateNextDeliveryDate(today, cutoffDay, packDay, deliveryDay, cutoffTime = '14:00') {
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
  const todayNum = today.getDay();

  // Parse cutoff time (e.g., "14:00" or "23:00")
  const [cutoffHour, cutoffMin] = cutoffTime.split(':').map(Number);
  const cutoffTimeInMinutes = cutoffHour * 60 + (cutoffMin || 0);
  const nowTimeInMinutes = today.getHours() * 60 + today.getMinutes();

  let useThisWeek = false;

  if (todayNum < cutoffDayNum) {
    // Cutoff day hasn't happened yet this week → this week's delivery available
    useThisWeek = true;
  } else if (todayNum === cutoffDayNum && nowTimeInMinutes < cutoffTimeInMinutes) {
    // Cutoff is TODAY but hasn't passed yet → this week's delivery still available
    useThisWeek = true;
  }
  // else: cutoff day has passed or is today but time passed → skip to next week

  let daysToAdd;
  if (useThisWeek) {
    // Use this week's delivery date
    daysToAdd = deliveryDayNum - todayNum;
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Delivery day hasn't occurred yet this week, add 7
    }
  } else {
    // Cutoff has passed, need NEXT week's delivery
    // Formula: days until next occurrence of deliveryDay + 7 extra days to skip a week
    const baseDaysToDelivery = (deliveryDayNum - todayNum + 7) % 7;
    daysToAdd = baseDaysToDelivery === 0 ? 7 : baseDaysToDelivery;
    daysToAdd += 7;  // Add 7 more days to skip the current week
  }

  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

/**
 * Check if a date is blackout for the region (checks date ranges)
 * Gracefully handles missing columns in older database schemas
 */
async function checkBlackoutDate(regionId, date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    
    // First, check if the table even exists and has the right columns
    // Try the new schema (start_date, end_date)
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM blackout_dates 
         WHERE region_id = $1 AND start_date <= $2 AND end_date >= $2 AND enabled = true`,
        [regionId, dateStr]
      );
      return result.rows[0].count > 0;
    } catch (schemaError) {
      // If the columns don't exist, the table probably uses a different schema
      // For now, just return false (no blackout)
      if (schemaError.message && schemaError.message.includes('does not exist')) {
        console.warn('⚠️ Blackout dates table schema outdated, skipping blackout checks');
        return false;
      }
      throw schemaError;
    }
  } catch (error) {
    console.error('Error checking blackout date:', error.message);
    return false;
  }
}

/**
 * Format cutoff time for display
 * "23:00" → "11 PM"
 * "14:00" → "2 PM"
 */
function formatCutoffTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '2 PM'; // Default fallback
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr || '0', 10);
  
  if (isNaN(hour)) return '2 PM'; // Fallback
  
  const isPM = hour >= 12;
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  const displayMin = min > 0 ? `:${String(min).padStart(2, '0')}` : '';
  const period = isPM ? 'PM' : 'AM';
  
  return `${displayHour}${displayMin} ${period}`;
}

/**
 * Get readable day name from day number
 */
function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum] || days[0];
}

module.exports = router;
