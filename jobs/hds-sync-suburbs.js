const cron = require('node-cron');
const hdsClient = require('../lib/hds-client');
const suburbsStore = require('../lib/suburbs-sync-store');

/**
 * Comprehensive list of Australian suburbs to check for HDS serviceability
 * Organized by region, starting with major cities and expanding
 */
const SUBURBS_TO_CHECK = [
  // Sydney Metro (NSW 2000-2089)
  { name: 'Sydney', postcode: 2000, state: 'NSW' },
  { name: 'Parramatta', postcode: 2150, state: 'NSW' },
  { name: 'Manly', postcode: 2095, state: 'NSW' },
  { name: 'Bondi', postcode: 2026, state: 'NSW' },
  { name: 'Coogee', postcode: 2034, state: 'NSW' },
  { name: 'Randwick', postcode: 2031, state: 'NSW' },
  { name: 'Paddington', postcode: 2021, state: 'NSW' },
  { name: 'Surry Hills', postcode: 2010, state: 'NSW' },
  { name: 'Newtown', postcode: 2042, state: 'NSW' },
  { name: 'Chatswood', postcode: 2067, state: 'NSW' },
  { name: 'Epping', postcode: 2121, state: 'NSW' },
  { name: 'Pennant Hills', postcode: 2120, state: 'NSW' },
  { name: 'Hornsby', postcode: 2077, state: 'NSW' },
  { name: 'North Sydney', postcode: 2060, state: 'NSW' },
  { name: 'Mosman', postcode: 2088, state: 'NSW' },
  { name: 'Marrickville', postcode: 2204, state: 'NSW' },
  { name: 'Leichhardt', postcode: 2040, state: 'NSW' },
  { name: 'Balmain', postcode: 2041, state: 'NSW' },
  { name: 'Glebe', postcode: 2037, state: 'NSW' },
  { name: 'Ultimo', postcode: 2007, state: 'NSW' },
  { name: 'Penrith', postcode: 2750, state: 'NSW' },
  { name: 'Campbelltown', postcode: 2560, state: 'NSW' },
  { name: 'Newcastle', postcode: 2300, state: 'NSW' },
  { name: 'Central Coast', postcode: 2250, state: 'NSW' },

  // Melbourne Metro (VIC 3000-3199)
  { name: 'Melbourne', postcode: 3000, state: 'VIC' },
  { name: 'Fitzroy', postcode: 3065, state: 'VIC' },
  { name: 'Carlton', postcode: 3053, state: 'VIC' },
  { name: 'North Melbourne', postcode: 3051, state: 'VIC' },
  { name: 'Southbank', postcode: 3006, state: 'VIC' },
  { name: 'St Kilda', postcode: 3182, state: 'VIC' },
  { name: 'Collingwood', postcode: 3066, state: 'VIC' },
  { name: 'Footscray', postcode: 3011, state: 'VIC' },
  { name: 'Williamstown', postcode: 3016, state: 'VIC' },
  { name: 'Essendon', postcode: 3040, state: 'VIC' },
  { name: 'Moonee Ponds', postcode: 3039, state: 'VIC' },
  { name: 'Brunswick', postcode: 3056, state: 'VIC' },
  { name: 'Coburg', postcode: 3058, state: 'VIC' },
  { name: 'Thornbury', postcode: 3071, state: 'VIC' },
  { name: 'Preston', postcode: 3072, state: 'VIC' },
  { name: 'Epping', postcode: 3076, state: 'VIC' },
  { name: 'Camberwell', postcode: 3124, state: 'VIC' },
  { name: 'Malvern', postcode: 3144, state: 'VIC' },
  { name: 'South Yarra', postcode: 3141, state: 'VIC' },
  { name: 'Toorak', postcode: 3142, state: 'VIC' },
  { name: 'Caulfield', postcode: 3161, state: 'VIC' },
  { name: 'Bentleigh', postcode: 3204, state: 'VIC' },
  { name: 'Glen Waverley', postcode: 3150, state: 'VIC' },
  { name: 'Geelong', postcode: 3220, state: 'VIC' },

  // Brisbane (QLD 4000-4099)
  { name: 'Brisbane', postcode: 4000, state: 'QLD' },
  { name: 'South Brisbane', postcode: 4101, state: 'QLD' },
  { name: 'Fortitude Valley', postcode: 4006, state: 'QLD' },
  { name: 'Woolloongabba', postcode: 4102, state: 'QLD' },
  { name: 'Paddington', postcode: 4064, state: 'QLD' },
  { name: 'West End', postcode: 4101, state: 'QLD' },
  { name: 'Teneriffe', postcode: 4005, state: 'QLD' },
  { name: 'Ascot', postcode: 4007, state: 'QLD' },
  { name: 'Indooroopilly', postcode: 4068, state: 'QLD' },
  { name: 'Toowong', postcode: 4066, state: 'QLD' },
  { name: 'Milton', postcode: 4064, state: 'QLD' },
  { name: 'New Farm', postcode: 4005, state: 'QLD' },

  // Gold Coast (QLD 4200-4299)
  { name: 'Surfers Paradise', postcode: 4217, state: 'QLD' },
  { name: 'Broadbeach', postcode: 4218, state: 'QLD' },
  { name: 'Southport', postcode: 4215, state: 'QLD' },
  { name: 'Gold Coast', postcode: 4217, state: 'QLD' },
  { name: 'Coolangatta', postcode: 4225, state: 'QLD' },

  // Sunshine Coast (QLD 4500-4599)
  { name: 'Sunshine Coast', postcode: 4551, state: 'QLD' },
  { name: 'Noosa', postcode: 4567, state: 'QLD' },
  { name: 'Mooloolaba', postcode: 4557, state: 'QLD' },

  // Canberra (ACT 2600-2699)
  { name: 'Canberra', postcode: 2600, state: 'ACT' },
  { name: 'Civic', postcode: 2601, state: 'ACT' },
  { name: 'Belconnen', postcode: 2617, state: 'ACT' },
  { name: 'Woden', postcode: 2606, state: 'ACT' },
  { name: 'Gungahlin', postcode: 2912, state: 'ACT' },
];

/**
 * Sync suburbs from HDS API
 * Checks each suburb for serviceability and updates the suburbs store
 */
async function syncSuburbsFromHDS() {
  console.log('\n🔄 Starting HDS suburbs sync...');
  const syncStartTime = new Date();

  const results = {
    total_checked: 0,
    serviceable: 0,
    not_serviceable: 0,
    new_suburbs: [],
    updated_suburbs: [],
    failed_checks: [],
    zone_changes: [],
  };

  try {
    // Authenticate with HDS
    await hdsClient.getBearerToken();

    console.log(`📍 Checking ${SUBURBS_TO_CHECK.length} suburbs for serviceability...`);

    // Process suburbs with a small delay between requests to avoid rate limiting
    for (let i = 0; i < SUBURBS_TO_CHECK.length; i++) {
      const suburb = SUBURBS_TO_CHECK[i];

      try {
        // Check serviceability
        const serviceCheck = await hdsClient.checkSuburbServiceable(suburb.name, suburb.postcode);

        // Handle response
        if (serviceCheck && serviceCheck.is_serviceable !== undefined) {
          const result = suburbsStore.upsertFromHDS({
            name: suburb.name,
            postcode: suburb.postcode.toString(),
            state: suburb.state,
            is_serviceable: serviceCheck.is_serviceable,
            hds_zone: serviceCheck.zone || null,
            hds_zone_code: serviceCheck.zoneCode || null,
            depot: serviceCheck.depot || null,
            depot_state: serviceCheck.depotState || null,
          });

          results.total_checked += 1;
          if (serviceCheck.is_serviceable) results.serviceable += 1;
          else results.not_serviceable += 1;

          // Track changes
          if (result.isNew) {
            results.new_suburbs.push({
              name: suburb.name,
              postcode: suburb.postcode,
              zone: serviceCheck.zone,
              serviceable: serviceCheck.is_serviceable,
            });
            console.log(`✨ NEW: ${suburb.name} (${suburb.postcode}) - Zone: ${serviceCheck.zone}`);
          } else if (result.changes) {
            results.updated_suburbs.push({
              name: suburb.name,
              postcode: suburb.postcode,
              changes: result.changes,
            });

            if (result.changes.hds_zone) {
              results.zone_changes.push({
                name: suburb.name,
                postcode: suburb.postcode,
                old_zone: result.changes.hds_zone.old,
                new_zone: result.changes.hds_zone.new,
              });
              console.log(`🔄 ZONE CHANGE: ${suburb.name} (${suburb.postcode}) - ${result.changes.hds_zone.old} → ${result.changes.hds_zone.new}`);
            } else if (result.changes.serviceable) {
              console.log(`📍 UPDATED: ${suburb.name} (${suburb.postcode}) - Serviceable: ${result.changes.serviceable.new}`);
            }
          }
        } else {
          results.failed_checks.push({
            name: suburb.name,
            postcode: suburb.postcode,
            error: 'Invalid response format',
          });
          console.log(`❌ Invalid response for ${suburb.name} (${suburb.postcode})`);
        }

        // Small delay to avoid rate limiting (100ms between requests)
        if (i < SUBURBS_TO_CHECK.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        results.failed_checks.push({
          name: suburb.name,
          postcode: suburb.postcode,
          error: error.message,
        });
        console.error(`❌ Error checking ${suburb.name} (${suburb.postcode}): ${error.message}`);
      }
    }

    // Generate summary
    const stats = suburbsStore.getStats();
    const syncDuration = ((new Date() - syncStartTime) / 1000).toFixed(2);

    console.log('\n✅ HDS suburbs sync completed');
    console.log(`\n📊 Sync Summary:`);
    console.log(`  Total checked: ${results.total_checked}`);
    console.log(`  Serviceable: ${results.serviceable}`);
    console.log(`  Not serviceable: ${results.not_serviceable}`);
    console.log(`  New suburbs found: ${results.new_suburbs.length}`);
    console.log(`  Updated suburbs: ${results.updated_suburbs.length}`);
    console.log(`  Zone changes: ${results.zone_changes.length}`);
    console.log(`  Failed checks: ${results.failed_checks.length}`);
    console.log(`  Duration: ${syncDuration}s`);

    console.log(`\n📈 Current Store Stats:`);
    console.log(`  Total suburbs: ${stats.total}`);
    console.log(`  Serviceable: ${stats.serviceable}`);
    console.log(`  Not serviceable: ${stats.notServiceable}`);
    Object.entries(stats.byRegion).forEach(([regionId, regionStats]) => {
      console.log(`  ${regionStats.name}: ${regionStats.serviceable}/${regionStats.total} serviceable`);
    });

    // Log detailed changes if any
    if (results.new_suburbs.length > 0) {
      console.log(`\n✨ New Suburbs (${results.new_suburbs.length}):`);
      results.new_suburbs.slice(0, 5).forEach(s => {
        console.log(`  - ${s.name} (${s.postcode}) [${s.zone}]`);
      });
      if (results.new_suburbs.length > 5) {
        console.log(`  ... and ${results.new_suburbs.length - 5} more`);
      }
    }

    if (results.zone_changes.length > 0) {
      console.log(`\n🔄 Zone Changes (${results.zone_changes.length}):`);
      results.zone_changes.forEach(z => {
        console.log(`  - ${z.name}: ${z.old_zone} → ${z.new_zone}`);
      });
    }

    if (results.failed_checks.length > 0) {
      console.log(`\n❌ Failed Checks (${results.failed_checks.length}):`);
      results.failed_checks.slice(0, 5).forEach(f => {
        console.log(`  - ${f.name} (${f.postcode}): ${f.error}`);
      });
      if (results.failed_checks.length > 5) {
        console.log(`  ... and ${results.failed_checks.length - 5} more`);
      }
    }

    return results;
  } catch (error) {
    console.error('❌ HDS suburbs sync error:', error.message);
    throw error;
  }
}

/**
 * Initialize daily cron schedule for suburbs sync
 * Runs at 3:00 AM daily (03:00 in 24-hour format)
 * Cron format: minute hour day month dayOfWeek
 * 0 3 * * * = Every day at 3:00 AM
 */
function initSchedule() {
  // Daily sync at 3:00 AM (cron: "0 3 * * *")
  const job = cron.schedule('0 3 * * *', async () => {
    console.log('\n📅 [CRON] Scheduled HDS suburbs sync triggered (3 AM daily)');
    try {
      await syncSuburbsFromHDS();
    } catch (error) {
      console.error('🚨 [CRON] Scheduled sync failed:', error.message);
    }
  });

  console.log('⏰ HDS suburbs sync scheduled: Daily at 3:00 AM AEST');
  return job;
}

/**
 * Manual sync (can be called via API endpoint for testing)
 */
async function manualSync() {
  console.log('\n🔄 [MANUAL] HDS suburbs sync triggered');
  try {
    return await syncSuburbsFromHDS();
  } catch (error) {
    console.error('🚨 [MANUAL] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Get current suburbs stats
 */
function getStats() {
  return suburbsStore.getStats();
}

module.exports = {
  initSchedule,
  syncSuburbsFromHDS,
  manualSync,
  getStats,
};
