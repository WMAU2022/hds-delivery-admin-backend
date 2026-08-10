#!/usr/bin/env node

/**
 * Test script to verify delivery date calculation logic
 * Test date: Tuesday August 11, 2026 at 00:08 Sydney time
 * Testing MELBOURNE region
 */

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateNextAvailableDeliveryDate(now, deliveryDay, cutoffDay, cutoffTime) {
  const deliveryDayIndex = dayNames.indexOf(deliveryDay);
  const cutoffDayIndex = dayNames.indexOf(cutoffDay);
  const nowDayIndex = now.getDay();

  // Parse cutoff time
  const [cutoffHour, cutoffMin] = cutoffTime.split(':').map(Number);

  // Calculate the cutoff deadline for THIS WEEK's delivery
  let daysBackToCutoff = (nowDayIndex - cutoffDayIndex + 7) % 7;
  const cutoffDateThisWeek = new Date(now);
  cutoffDateThisWeek.setDate(cutoffDateThisWeek.getDate() - daysBackToCutoff);
  cutoffDateThisWeek.setHours(cutoffHour, cutoffMin, 0, 0);

  // Check if this week's cutoff is still open
  const cutoffIsStillOpen = now < cutoffDateThisWeek;

  // Calculate delivery date
  let deliveryDate;
  if (cutoffIsStillOpen) {
    // Cutoff is still open → use THIS WEEK's delivery
    let daysUntilDelivery = (deliveryDayIndex - nowDayIndex + 7) % 7;
    if (daysUntilDelivery === 0) {
      daysUntilDelivery = 0;
    }
    deliveryDate = new Date(now);
    deliveryDate.setDate(deliveryDate.getDate() + daysUntilDelivery);
  } else {
    // Cutoff is closed → use NEXT WEEK's delivery
    let daysUntilDelivery = (deliveryDayIndex - nowDayIndex + 7) % 7;
    if (daysUntilDelivery === 0) {
      daysUntilDelivery = 7;
    } else {
      daysUntilDelivery += 7;
    }
    deliveryDate = new Date(now);
    deliveryDate.setDate(deliveryDate.getDate() + daysUntilDelivery);
  }

  // Set to midnight
  deliveryDate.setHours(0, 0, 0, 0);

  return deliveryDate;
}

// Test case: Tuesday Aug 11, 2026 at 00:08
const testDate = new Date('2026-08-11T00:08:00+10:00');
console.log(`\n📅 TEST DATE: ${dayNames[testDate.getDay()]} ${formatDate(testDate)} at ${testDate.getHours().toString().padStart(2, '0')}:${testDate.getMinutes().toString().padStart(2, '0')}`);
console.log(`🕐 Timezone: Melbourne (Australia/Melbourne - same as Sydney)\n`);

// Melbourne schedule
const melbourneSchedule = {
  'Wednesday': { cutoffDay: 'Monday', cutoffTime: '14:00' },
  'Thursday': { cutoffDay: 'Tuesday', cutoffTime: '14:00' },
  'Friday': { cutoffDay: 'Wednesday', cutoffTime: '14:00' },
};

console.log('🚚 MELBOURNE SCHEDULE:\n');

// Collect all next delivery dates
const results = [];
for (const [deliveryDay, config] of Object.entries(melbourneSchedule)) {
  const nextDate = calculateNextAvailableDeliveryDate(testDate, deliveryDay, config.cutoffDay, config.cutoffTime);
  results.push({
    deliveryDay,
    cutoffDay: config.cutoffDay,
    cutoffTime: config.cutoffTime,
    nextDate: nextDate,
    formatted: formatDate(nextDate),
    dayName: dayNames[nextDate.getDay()]
  });
}

// Sort by date
results.sort((a, b) => a.nextDate - b.nextDate);

// Print results
console.log('Delivery Day\t| Cutoff\t\t| Next Available');
console.log('-------\t\t| -------\t\t| ----');
for (const r of results) {
  const cutoffStr = `${r.cutoffDay} ${r.cutoffTime}`;
  console.log(`${r.deliveryDay.padEnd(16)} | ${cutoffStr.padEnd(16)} | ${r.dayName} ${r.formatted}`);
}

// Show sequence of next 10 delivery dates
console.log('\n📊 SEQUENCE OF NEXT 10 DELIVERY DATES:');
const allDates = new Set();
for (const r of results) {
  let d = new Date(r.nextDate);
  for (let i = 0; i < 4; i++) {
    allDates.add(formatDate(d));
    d.setDate(d.getDate() + 7);
  }
}
const sortedDates = Array.from(allDates).sort();
const first10 = sortedDates.slice(0, 10);
console.log(first10.map((d, i) => {
  const dateObj = new Date(d);
  const dayName = dayNames[dateObj.getDay()];
  return `${i + 1}. ${dayName} ${d}`;
}).join('\n'));

// Expected sequence
console.log('\n✅ EXPECTED (per task):');
console.log('Wed 12, Thu 13, Fri 14, (Sat 15), (Sun 16), (Mon 17), Wed 19, Thu 20, Fri 21, (Sat 22)');

// Detailed breakdown for each schedule
console.log('\n\n📝 DETAILED BREAKDOWN:\n');
for (const r of results) {
  console.log(`\n${r.deliveryDay} Delivery:`);
  console.log(`  - Cutoff: ${r.cutoffDay} at ${r.cutoffTime}`);
  const cutoffIndex = dayNames.indexOf(r.cutoffDay);
  const nowIndex = testDate.getDay();
  let daysBackToCutoff = (nowIndex - cutoffIndex + 7) % 7;
  const cutoffDate = new Date(testDate);
  cutoffDate.setDate(cutoffDate.getDate() - daysBackToCutoff);
  const [h, m] = r.cutoffTime.split(':').map(Number);
  cutoffDate.setHours(h, m, 0, 0);
  console.log(`  - Cutoff deadline this week: ${dayNames[cutoffDate.getDay()]} ${formatDate(cutoffDate)} at ${r.cutoffTime}`);
  console.log(`  - Is cutoff still open? ${testDate < cutoffDate ? 'YES ✅' : 'NO ❌'} (now: ${testDate.toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'})}, deadline: ${cutoffDate.toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'})})`);
  console.log(`  - Next delivery date: ${r.dayName} ${r.formatted}`);
}
