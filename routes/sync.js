const express = require('express');
const router = express.Router();
const hdsSuburbsSync = require('../jobs/hds-sync-suburbs');
const suburbsStore = require('../lib/suburbs-sync-store');

/**
 * POST /api/sync/suburbs
 * Manually trigger HDS suburbs sync
 */
router.post('/suburbs', async (req, res) => {
  try {
    console.log('\n🔄 Manual suburbs sync triggered via API...\n');
    
    const startTime = Date.now();
    const resultsBefore = suburbsStore.getStats();
    
    // Run the sync
    await hdsSuburbsSync.syncSuburbsFromHDS();
    
    const resultsAfter = suburbsStore.getStats();
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'HDS suburbs sync completed',
      duration_ms: duration,
      before: resultsBefore,
      after: resultsAfter,
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * GET /api/sync/status
 * Get current sync status and statistics
 */
router.get('/status', (req, res) => {
  try {
    const stats = suburbsStore.getStats();
    
    res.json({
      success: true,
      suburbs: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
