const cron = require('node-cron');
const pool = require('../lib/db');
const hdsClient = require('../lib/hds-client');

/**
 * Sync regions from HDS API
 * This would be expanded to pull actual region data from HDS
 * For now, we're setting up the job structure
 */
async function syncRegionsFromHDS() {
  console.log('🔄 Starting HDS regions sync...');
  const syncStartTime = new Date();

  try {
    // Authenticate with HDS
    await hdsClient.getBearerToken();

    // TODO: Implement actual HDS API call to fetch regions
    // This would depend on HDS having a "get all regions" endpoint
    // For now, we're ready for when that endpoint is available

    console.log('⏰ Sample suburb check (Canberra 2600):');
    const serviceCheck = await hdsClient.checkSuburbServiceable('Canberra', 2600);
    console.log('✅ Suburb serviceable response:', JSON.stringify(serviceCheck, null, 2));

    // Log sync success
    await pool.query(
      `INSERT INTO hds_sync_logs (sync_type, status, regions_synced, suburbs_synced, synced_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['regions', 'success', 0, 0, new Date()]
    );

    console.log('✅ HDS regions sync completed');
  } catch (error) {
    console.error('❌ HDS sync error:', error.message);

    // Log sync failure
    await pool.query(
      `INSERT INTO hds_sync_logs (sync_type, status, error_message, synced_at)
       VALUES ($1, $2, $3, $4)`,
      ['regions', 'failed', error.message, new Date()]
    );
  }
}

/**
 * Sync suburbs from HDS API
 * (To be implemented when HDS provides bulk suburb endpoint)
 */
async function syncSuburbsFromHDS() {
  console.log('🔄 Starting HDS suburbs sync...');

  try {
    // TODO: Implement actual suburbs sync
    console.log('✅ HDS suburbs sync completed');
  } catch (error) {
    console.error('❌ HDS suburbs sync error:', error.message);
  }
}

/**
 * Initialize cron schedule
 * Runs daily at 2 AM
 */
function initSchedule() {
  // Daily sync at 2:00 AM (cron: "0 2 * * *")
  cron.schedule('0 2 * * *', async () => {
    console.log('\n📅 Scheduled HDS sync triggered (2 AM daily)');
    await syncRegionsFromHDS();
    await syncSuburbsFromHDS();
  });

  console.log('⏰ HDS sync scheduled: Daily at 2:00 AM');
}

/**
 * Manual sync (can be called via API endpoint)
 */
async function manualSync() {
  console.log('\n🔄 Manual HDS sync triggered');
  await syncRegionsFromHDS();
  await syncSuburbsFromHDS();
}

module.exports = {
  initSchedule,
  syncRegionsFromHDS,
  syncSuburbsFromHDS,
  manualSync,
};
