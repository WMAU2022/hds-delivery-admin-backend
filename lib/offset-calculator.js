/**
 * Offset Calculator
 * Calculates next delivery date and charge date based on HDS schedule
 * Used by subscription auto-charge handler to determine when order should be delivered
 */

const DAY_MAP = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

/**
 * Calculate next delivery date based on delivery day of week
 * @param {string} deliveryDay - Day name (e.g., "Sunday")
 * @param {number} offsetDays - Days before delivery to charge (e.g., 3)
 * @returns {object} { next_delivery_date, charge_date, days_until_delivery, offset_days }
 */
function calculateNextDeliveryDate(deliveryDay, offsetDays = 0) {
  const deliveryDayNum = DAY_MAP[deliveryDay];
  
  if (deliveryDayNum === undefined) {
    throw new Error(`Invalid delivery day: ${deliveryDay}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to midnight
  const todayDayNum = today.getDay();

  // Calculate days until next delivery
  let daysToAdd = (deliveryDayNum - todayDayNum + 7) % 7;
  
  // If today IS the delivery day, next delivery is next week
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }

  // Calculate next delivery date
  const nextDelivery = new Date(today);
  nextDelivery.setDate(nextDelivery.getDate() + daysToAdd);

  // Calculate charge date (subtract offset from delivery date)
  const chargeDate = new Date(nextDelivery);
  chargeDate.setDate(chargeDate.getDate() - offsetDays);

  return {
    next_delivery_date: nextDelivery.toISOString().split('T')[0],
    charge_date: chargeDate.toISOString().split('T')[0],
    days_until_delivery: daysToAdd,
    offset_days: offsetDays,
    calculation_timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate offset from schedule (delivery_day - cutoff_day)
 * @param {object} schedule - { cutoff_day, pack_day, delivery_day }
 * @param {string} basisDay - "pack_day" or "delivery_day" (default: "pack_day" for reliability)
 * @returns {number} Offset in days
 */
function calculateOffsetFromSchedule(schedule, basisDay = 'pack_day') {
  const cutoffDay = DAY_MAP[schedule.cutoff_day];
  const packDay = DAY_MAP[schedule.pack_day];
  const deliveryDay = DAY_MAP[schedule.delivery_day];

  if (cutoffDay === undefined || deliveryDay === undefined) {
    throw new Error('Invalid schedule days');
  }

  let basisDayNum;
  if (basisDay === 'pack_day') {
    basisDayNum = packDay;
  } else if (basisDay === 'delivery_day') {
    basisDayNum = deliveryDay;
  } else {
    throw new Error(`Invalid basis day: ${basisDay}`);
  }

  // Calculate offset: how many days before delivery do we charge?
  let offset = (basisDayNum - deliveryDay + 7) % 7;

  // If negative or zero, add 7 (we charge before delivery, not after)
  if (offset <= 0) {
    offset += 7;
  }

  return offset;
}

/**
 * Get offset description for human readability
 * @param {object} schedule
 * @param {number} offsetDays
 * @returns {string} Description like "Charge Thursday (3 days before Sunday delivery)"
 */
function getOffsetDescription(schedule, offsetDays) {
  const deliveryDate = new Date();
  const deliveryDayNum = DAY_MAP[schedule.delivery_day];
  const todayDayNum = deliveryDate.getDay();
  
  let daysToDelivery = (deliveryDayNum - todayDayNum + 7) % 7;
  if (daysToDelivery === 0) daysToDelivery = 7;

  const chargeDate = new Date(deliveryDate);
  chargeDate.setDate(chargeDate.getDate() + daysToDelivery - offsetDays);

  const REVERSE_DAY_MAP = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };

  const chargeDay = REVERSE_DAY_MAP[chargeDate.getDay()];

  return `Charge ${chargeDay} (${offsetDays} days before ${schedule.delivery_day} delivery)`;
}

module.exports = {
  DAY_MAP,
  calculateNextDeliveryDate,
  calculateOffsetFromSchedule,
  getOffsetDescription,
};
