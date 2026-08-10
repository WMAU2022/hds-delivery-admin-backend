#!/usr/bin/env node

/**
 * VALIDATION TEST: Problem Statement from Task
 * 
 * Verifies the fix solves the exact issues described:
 * - Wed 12 Aug → should skip to Wed 19 Aug (NOT jumping to Wed 26)
 * - Fri 14 Aug ✅ (correct)
 * - Thu 20 Aug ✅ (correct)  
 * - Wed 26 Aug ❌ (BROKEN: should be Wed 19 - jumps entire week)
 * - Fri 28 Aug ❌ (BROKEN: should be Fri 21 - jumps entire week)
 */

const http = require('http');

function testServiceDays(postcode, regionName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/public/service-days?postcode=${postcode}&weeksToShow=4`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ region: regionName, postcode, data: response.available_dates || [] });
        } catch (e) {
          resolve({ region: regionName, postcode, data: [], error: e.message });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ region: regionName, postcode, data: [], error: e.message });
    });

    req.end();
  });
}

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('PROBLEM STATEMENT VALIDATION TEST');
  console.log('Test Date: Tuesday August 11, 2026 at 00:08');
  console.log('='.repeat(80) + '\n');

  // Test Melbourne (mentioned in problem statement with Wed/Thu/Fri)
  const melbourne = await testServiceDays('3000', 'Melbourne');
  
  console.log('📍 MELBOURNE REGION (postcode 3000)');
  console.log('Schedule: Wed (cutoff Mon), Thu (cutoff Tue), Fri (cutoff Wed)\n');
  
  if (melbourne.error) {
    console.log(`❌ ERROR: ${melbourne.error}`);
  } else {
    console.log(`Returned dates: ${melbourne.data.join(', ')}\n`);
    
    // Parse dates for day-of-week checking
    const dates = melbourne.data.map(d => {
      const date = new Date(d);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return { date: d, day: dayNames[date.getDay()], dayNum: date.getDate() };
    });

    console.log('Expected vs Actual:');
    console.log('---\n');

    // Check for Wed dates
    const weds = dates.filter(d => d.day === 'Wednesday');
    console.log(`Wednesday deliveries: ${weds.map(d => d.date).join(', ') || 'NONE'}`);
    
    if (weds.length === 0) {
      console.log('❌ NO WEDNESDAY DATES - Should show at least Wed 19 and Wed 26');
    } else {
      const firstWed = weds[0].dayNum;
      if (firstWed === 19) {
        console.log('✅ Correct! Wed 19 (skipped Wed 12 because Mon cutoff closed)');
      } else if (firstWed === 12) {
        console.log('❌ WRONG: Shows Wed 12 (should skip to Wed 19)');
      } else if (firstWed === 26) {
        console.log('❌ WRONG: Shows Wed 26 first (original bug!) - should be Wed 19');
      }
    }

    console.log('');
    
    // Check for Thu dates
    const thurs = dates.filter(d => d.day === 'Thursday');
    console.log(`Thursday deliveries: ${thurs.map(d => d.date).join(', ') || 'NONE'}`);
    
    if (thurs.length === 0) {
      console.log('❌ NO THURSDAY DATES - Should show Thu 13, 20, 27...');
    } else {
      const firstThurs = thurs[0].dayNum;
      if (firstThurs === 13) {
        console.log('✅ Correct! Thu 13 (Tue cutoff still open)');
      } else if (firstThurs === 20) {
        console.log('⚠️  Shows Thu 20 first - missing Thu 13');
      }
    }

    console.log('');

    // Check for Fri dates
    const fris = dates.filter(d => d.day === 'Friday');
    console.log(`Friday deliveries: ${fris.map(d => d.date).join(', ') || 'NONE'}`);
    
    if (fris.length === 0) {
      console.log('❌ NO FRIDAY DATES - Should show Fri 14, 21, 28...');
    } else {
      const firstFri = fris[0].dayNum;
      if (firstFri === 14) {
        console.log('✅ Correct! Fri 14 (Wed cutoff still open)');
      } else if (firstFri === 21) {
        console.log('⚠️  Shows Fri 21 first - missing Fri 14');
      } else if (firstFri === 28) {
        console.log('❌ WRONG: Shows Fri 28 first (original bug!) - should be Fri 14');
      }
    }

    console.log('');

    // Summary
    console.log('SEQUENCE:');
    console.log(dates.map((d, i) => `  ${i + 1}. ${d.day} ${d.date}`).join('\n'));
    
    console.log('\n');
    const hasWed19 = dates.some(d => d.dayNum === 19 && d.day === 'Wednesday');
    const hasWed26 = dates.some(d => d.dayNum === 26 && d.day === 'Wednesday');
    const hasFri14 = dates.some(d => d.dayNum === 14 && d.day === 'Friday');
    const hasThu13 = dates.some(d => d.dayNum === 13 && d.day === 'Thursday');

    if (hasWed19 && hasFri14 && hasThu13 && !dates.some(d => d.dayNum === 12 && d.day === 'Wednesday')) {
      console.log('✅✅✅ FIX VERIFIED - All problem statement issues resolved!\n');
      console.log('Original broken behavior:');
      console.log('  - Wed 26 instead of Wed 19 (skipped week)');
      console.log('  - Fri 28 instead of Fri 14 (skipped week)');
      console.log('\nNow fixed:');
      console.log('  - Shows Wed 19 (correct)');
      console.log('  - Shows Fri 14 (correct)');
      console.log('  - Shows Thu 13 (correct)');
      process.exit(0);
    } else {
      console.log('❌ Fix incomplete - still showing wrong dates\n');
      process.exit(1);
    }
  }
}

runTests();
