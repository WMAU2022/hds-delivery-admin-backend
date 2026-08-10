const express = require('express');
const router = express.Router();
const pool = require('../lib/db');
const suburbsStore = require('../lib/suburbs-sync-store');

/**
 * GET /api/serviceable/service-days?postcode=2000&weeksToShow=4
 * 
 * Calculate available delivery dates based on region schedule + cutoff times
 * Uses hardcoded schedule config for each region matching HDS dashboard
 * 
 * Response:
 * {
 *   serviceable: true,
 *   available_dates: ["2026-08-13", "2026-08-14", "2026-08-15", ...]
 * }
 */
router.get('/service-days', async (req, res) => {
  try {
    const { postcode, weeksToShow = 4 } = req.query;

    if (!postcode) {
      return res.status(400).json({
        serviceable: false,
        error: 'postcode parameter is required',
      });
    }

    // Map postcode to region (hardcoded for known Sydney/Melbourne areas)
    let regionId = determineRegionByPostcode(postcode.toString());

    if (!regionId) {
      return res.status(200).json({
        serviceable: false,
        available_dates: [],
      });
    }

    // Get schedule for region from database
    let schedule = null;
    try {
      const result = await pool.query(
        `SELECT delivery_day, cutoff_day, cutoff_time
         FROM delivery_schedules
         WHERE region_id = $1
         ORDER BY CASE delivery_day
           WHEN 'Sunday' THEN 0
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
         END`,
        [regionId]
      );
      
      if (result.rows.length > 0) {
        // Convert array to object keyed by delivery_day
        schedule = {};
        result.rows.forEach(row => {
          schedule[row.delivery_day] = {
            cutoffDay: row.cutoff_day,
            cutoffTime: row.cutoff_time
          };
        });
      }
    } catch (dbError) {
      console.error('Database schedule lookup failed:', dbError.message);
      // Fallback to hardcoded only if DB fails
      schedule = getRegionSchedule(regionId);
    }
    
    if (!schedule || Object.keys(schedule).length === 0) {
      return res.status(200).json({
        serviceable: false,
        available_dates: [],
      });
    }

    // Calculate available dates based on schedule
    const availableDates = calculateAvailableDates(schedule, parseInt(weeksToShow) || 4);

    return res.json({
      serviceable: true,
      available_dates: availableDates,
    });
  } catch (error) {
    console.error('Service days error:', error.message);
    return res.status(200).json({
      serviceable: false,
      error: error.message,
      available_dates: [],
    });
  }
});

/**
 * Determine region ID by postcode (hardcoded for known areas)
 */
function determineRegionByPostcode(postcode) {
  const postNum = parseInt(postcode);
  
  // Sydney Metro: 2000-2599
  if (postNum >= 2000 && postNum <= 2599) return 1;
  
  // Newcastle: 2300-2399
  if (postNum >= 2300 && postNum <= 2399) return 2;
  
  // Central Coast: 2250-2299
  if (postNum >= 2250 && postNum <= 2299) return 3;
  
  // Melbourne Metro: 3000-3199, 3800-3999
  if ((postNum >= 3000 && postNum <= 3199) || (postNum >= 3800 && postNum <= 3999)) return 6;
  
  return null;
}

/**
 * Hardcoded region schedules matching HDS admin dashboard config
 * Format: { deliveryDay: { cutoffDay, cutoffTime (24h) } }
 */
function getRegionSchedule(regionId) {
  const schedules = {
    1: { // Sydney Metro
      'Thursday': { cutoffDay: 'Monday', cutoffTime: '23:00' },
      'Friday': { cutoffDay: 'Tuesday', cutoffTime: '14:00' },
      'Saturday': { cutoffDay: 'Thursday', cutoffTime: '14:00' },
      'Sunday': { cutoffDay: 'Friday', cutoffTime: '14:00' },
    },
    2: { // Newcastle
      'Thursday': { cutoffDay: 'Monday', cutoffTime: '14:00' },
      'Friday': { cutoffDay: 'Tuesday', cutoffTime: '14:00' },
      'Saturday': { cutoffDay: 'Thursday', cutoffTime: '14:00' },
    },
    6: { // Melbourne Metro
      'Wednesday': { cutoffDay: 'Monday', cutoffTime: '14:00' },
      'Thursday': { cutoffDay: 'Tuesday', cutoffTime: '14:00' },
      'Friday': { cutoffDay: 'Wednesday', cutoffTime: '14:00' },
    },
  };

  return schedules[regionId] || null;
}

/**
 * Calculate available delivery dates based on schedule and current cutoff times
 * Only returns dates where current time is BEFORE the cutoff deadline
 */
function calculateAvailableDates(schedule, weeksToShow) {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dates = new Set();
  const endDate = new Date(now.getTime() + (weeksToShow * 7 * 24 * 60 * 60 * 1000));

  // Iterate through each day in the range
  for (let d = new Date(now); d <= endDate; d.setDate(d.getDate() + 1)) {
    const deliveryDayName = dayNames[d.getDay()];
    const scheduleEntry = schedule[deliveryDayName];

    if (!scheduleEntry) continue; // No delivery on this day

    // Calculate the cutoff deadline for this delivery date
    const cutoffDeadline = calculateCutoffDeadline(
      d,
      scheduleEntry.cutoffDay,
      scheduleEntry.cutoffTime
    );

    // Only include this delivery date if we're still before the cutoff
    if (now < cutoffDeadline) {
      dates.add(formatDate(d));
    }
  }

  return Array.from(dates).sort();
}

/**
 * Calculate the exact cutoff deadline for a delivery date
 * Example: Thursday delivery with Monday 11pm cutoff
 *   → Find the Monday BEFORE this Thursday
 *   → Add the cutoff time to that Monday
 *   → Return the resulting datetime
 */
function calculateCutoffDeadline(deliveryDate, cutoffDay, cutoffTime) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const cutoffDayIndex = dayNames.indexOf(cutoffDay);
  const deliveryDayIndex = deliveryDate.getDay();

  // Calculate how many days back to go to reach the cutoff day
  let daysBack = deliveryDayIndex - cutoffDayIndex;
  if (daysBack <= 0) daysBack += 7;

  // Create the cutoff date (same day as delivery but cutoffDay of week)
  const cutoffDate = new Date(deliveryDate);
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Parse and apply the cutoff time (format: "HH:MM" in 24h)
  const [hours, minutes] = cutoffTime.split(':').map(Number);
  cutoffDate.setHours(hours, minutes, 0, 0);

  return cutoffDate;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    // CRITICAL: Use Sydney timezone (Australia/Sydney), not server timezone
    // Sydney is UTC+10 (or UTC+11 during daylight savings)
    const utcNow = new Date();
    const sydneyNow = new Date(utcNow.getTime() + (10 * 60 * 60 * 1000)); // Add 10 hours for Sydney
    const today = sydneyNow;
    
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    console.log(`\n=== DELIVERY OPTIONS DEBUG ===`);
    console.log(`UTC Now: ${utcNow.toISOString()}`);
    console.log(`Sydney Now (UTC+10): ${sydneyNow.toISOString()}`);
    console.log(`Day: ${dayMap[today.getDay()]}, Time: ${today.getHours()}:${String(today.getMinutes()).padStart(2, '0')}`);
    console.log(`Postcode: ${postcode}, Suburb: ${suburb}`);
    const options = [];
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
        
        // Get cutoff time from region (default to 23:00 / 11 PM for orders)
        let cutoffTime = '23:00';  // Default cutoff time: 11 PM
        
        // Hardcode cutoff times for known regions since database might not have the column
        const regionCutoffTimes = {
          1: '23:00',  // Sydney Metro: 11 PM
          2: '14:00',  // Newcastle: 2 PM
          3: '14:00',  // Central Coast: 2 PM
          6: '14:00',  // Melbourne: 2 PM
        };
        
        if (regionCutoffTimes[suburbRecord.region_id]) {
          cutoffTime = regionCutoffTimes[suburbRecord.region_id];
        }
        
        console.log(`⏰ Region ${suburbRecord.region_id} cutoff time: ${cutoffTime}`);
        
        // Generate 6 upcoming delivery dates for this schedule
        // Start by calculating the first available date, then add 7 days for each iteration
        let currentDate = new Date(today);
        console.log(`📅 Calculating dates for ${deliveryDayName} (schedule ${schedule.id})`);
        console.log(`   Today: ${today.toISOString()}, Cutoff: ${cutoffDayName} ${cutoffTime}`);
        
        for (let i = 0; i < 6; i++) {
          const deliveryDate = calculateNextDeliveryDate(
            currentDate,
            cutoffDayName,
            packDayName,
            deliveryDayName,
            cutoffTime  // Pass cutoff time for proper cutoff checking
          );
          console.log(`   Iteration ${i}: returned ${deliveryDate.toDateString()}`);
          
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

    // CRITICAL FIX: Sort options chronologically by delivery_date (not by schedule_id/day)
    options.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));

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
 * IMPORTANT: `today` parameter MUST be in Sydney timezone (Australia/Sydney)
 * 
 * Logic:
 * 1. If cutoff day hasn't happened yet this week → use this week's dates
 * 2. If cutoff day is today but time hasn't passed → use this week's dates
 * 3. If cutoff day is today AND time has passed → skip to next week
 * 4. If cutoff day already passed → skip to next week
 */
function calculateNextDeliveryDate(today, cutoffDay, packDay, deliveryDay, cutoffTime = '14:00') {
  // today should already be in Sydney time
  // If it's UTC, add 10 hours
  if (today.getUTCHours !== undefined && today.getUTCHours() !== today.getHours()) {
    // Looks like UTC, convert to Sydney
    today = new Date(today.getTime() + (10 * 60 * 60 * 1000));
  }
  const reverseDayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const cutoffDayNum = reverseDayMap[cutoffDay] || 0;
  const deliveryDayNum = reverseDayMap[deliveryDay] || 0;
  const todayNum = today.getDay();

  // Parse cutoff time (e.g., "14:00" or "23:00")
  const [cutoffHour, cutoffMin] = cutoffTime.split(':').map(Number);
  const cutoffTimeInMinutes = cutoffHour * 60 + (cutoffMin || 0);
  const nowTimeInMinutes = today.getHours() * 60 + today.getMinutes();

  let useThisWeek = false;

  // CORRECT LOGIC: Check if cutoff day is coming UP (later in the week, or still today)
  // Special case: Sunday (0) is always "later" in the week compared to other days
  // Examples:
  //   Today=Mon(1), Cutoff=Fri(5) → Fri > Mon → cutoff is coming (useThisWeek=true)
  //   Today=Fri(5), Cutoff=Mon(1) → Mon < Fri AND Mon != 0 → cutoff passed (useThisWeek=false)
  //   Today=Sat(6), Cutoff=Sun(0) → Sun==0 (special case) → cutoff coming (useThisWeek=true)
  //   Today=Mon(1), Cutoff=Sun(0) → Sun==0 AND Mon != 0 → cutoff passed (useThisWeek=false)
  
  let cutoffIsComingThisWeek = false;
  if (cutoffDayNum > todayNum) {
    // Cutoff day number is higher → it's coming later this week
    cutoffIsComingThisWeek = true;
  } else if (cutoffDayNum === 0 && todayNum > 0) {
    // Special case: Cutoff is Sunday (0) and today is not Sunday → Sunday is coming soon
    cutoffIsComingThisWeek = true;
  } else if (cutoffDayNum === todayNum) {
    // Cutoff is today → check if time has passed
    cutoffIsComingThisWeek = (nowTimeInMinutes < cutoffTimeInMinutes);
  }
  // else: cutoff day is earlier in the week (Mon-Sat) and not today → already passed
  
  useThisWeek = cutoffIsComingThisWeek;
  
  console.log(`⏰ Cutoff check: today=${dayMap[todayNum]} ${today.getHours()}:${String(today.getMinutes()).padStart(2,'0')}, cutoff=${dayMap[cutoffDayNum]} ${cutoffTime}`);
  console.log(`   Cutoff upcoming this week: ${cutoffIsComingThisWeek}, useThisWeek: ${useThisWeek}`);
  console.log(`   Delivery day needed: ${dayMap[deliveryDayNum]}, delivery_day_num=${deliveryDayNum}`);

  let daysToAdd;
  if (useThisWeek) {
    // Use this week's delivery date
    daysToAdd = deliveryDayNum - todayNum;
    console.log(`   UseThisWeek: delivery(${deliveryDayNum}) - today(${todayNum}) = ${daysToAdd}`);
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Delivery day hasn't occurred yet this week, add 7
      console.log(`   Adjusted (add 7): ${daysToAdd}`);
    }
  } else {
    // Cutoff has passed, need NEXT week's delivery
    // Formula: days until next occurrence of deliveryDay + 7 extra days to skip a week
    const baseDaysToDelivery = (deliveryDayNum - todayNum + 7) % 7;
    daysToAdd = baseDaysToDelivery === 0 ? 7 : baseDaysToDelivery;
    daysToAdd += 7;  // Add 7 more days to skip the current week
    console.log(`   Cutoff passed: baseDays=${baseDaysToDelivery}, final=${daysToAdd}`);
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

/**
 * DEBUG ENDPOINT: Calculate Thursday date manually and show result
 */
let lastDebugOutput = null;

router.get('/debug/thursday-calc', async (req, res) => {
  try {
    // Simulate the exact calculation
    const utcNow = new Date();
    const sydneyNow = new Date(utcNow.getTime() + (10 * 60 * 60 * 1000)); // Add 10 hours for Sydney UTC+10
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const output = {
      timestamp: new Date().toISOString(),
      utc: utcNow.toISOString(),
      sydney: sydneyNow.toISOString(),
      day: dayMap[sydneyNow.getDay()],
      time: `${sydneyNow.getHours()}:${String(sydneyNow.getMinutes()).padStart(2, '0')}`,
      dayNum: sydneyNow.getDay(),
      hours: sydneyNow.getHours(),
      minutes: sydneyNow.getMinutes()
    };
    
    // Calculate Thursday delivery
    const cutoffDay = 1; // Monday
    const deliveryDay = 4; // Thursday
    const cutoffTime = '23:00';
    const [cutoffHour] = cutoffTime.split(':').map(Number);
    
    const todayNum = sydneyNow.getDay();
    const nowTimeInMinutes = sydneyNow.getHours() * 60 + sydneyNow.getMinutes();
    const cutoffTimeInMinutes = cutoffHour * 60;
    
    let cutoffIsComingThisWeek = false;
    if (cutoffDay > todayNum) {
      cutoffIsComingThisWeek = true;
    } else if (cutoffDay === 0 && todayNum > 0) {
      cutoffIsComingThisWeek = true;
    } else if (cutoffDay === todayNum) {
      cutoffIsComingThisWeek = (nowTimeInMinutes < cutoffTimeInMinutes);
    }
    
    output.cutoffDay = cutoffDay;
    output.cutoffDayName = dayMap[cutoffDay];
    output.cutoffTimeInMinutes = cutoffTimeInMinutes;
    output.nowTimeInMinutes = nowTimeInMinutes;
    output.cutoffIsComingThisWeek = cutoffIsComingThisWeek;
    output.cutoffTimePassed = (nowTimeInMinutes >= cutoffTimeInMinutes);
    
    let daysToAdd;
    if (cutoffIsComingThisWeek) {
      daysToAdd = deliveryDay - todayNum;
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      output.logic = `UseThisWeek: delivery(${deliveryDay}) - today(${todayNum}) = ${deliveryDay - todayNum}, adjusted = ${daysToAdd}`;
    } else {
      const baseDaysToDelivery = (deliveryDay - todayNum + 7) % 7;
      daysToAdd = baseDaysToDelivery === 0 ? 7 : baseDaysToDelivery;
      daysToAdd += 7;
      output.logic = `CutoffPassed: base=${baseDaysToDelivery}, plus 7 = ${daysToAdd}`;
    }
    
    const nextDate = new Date(sydneyNow);
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    nextDate.setHours(0, 0, 0, 0);
    
    output.daysToAdd = daysToAdd;
    output.nextThursdayDelivery = nextDate.toISOString().split('T')[0];
    output.nextThursdayDeliveryFormatted = nextDate.toDateString();
    output.expected = '2026-08-13';
    output.matches = (output.nextThursdayDelivery === '2026-08-13');
    
    lastDebugOutput = output;
    return res.json(output);
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
