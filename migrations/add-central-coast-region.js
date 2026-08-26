/**
 * Migration: Add NSW Central Coast region
 * Moves Central Coast postcodes from NSW Sydney Metro to NSW Central Coast
 */

async function addCentralCoastRegion(pool) {
  try {
    console.log('🚀 Central Coast migration starting...');
    
    // Step 1: Insert or update NSW Central Coast region
    // Use ON CONFLICT to handle case where it already partially exists
    const regionResult = await pool.query(
      `INSERT INTO regions (name, hds_zone, code, location, cutoff_time, enabled, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET 
         hds_zone = EXCLUDED.hds_zone,
         code = EXCLUDED.code,
         location = EXCLUDED.location,
         cutoff_time = EXCLUDED.cutoff_time,
         updated_at = NOW()
       RETURNING id`,
      ['NSW Central Coast', 'NSW Central Coast', 'CC', 'WOM', '23:00', true]
    );
    
    const centralCoastRegionId = regionResult.rows[0].id;
    console.log(`✅ NSW Central Coast region ready (ID: ${centralCoastRegionId})`);

    // Step 2: Update all Central Coast postcodes to the new region
    const centralCoastPostcodes = ['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258'];
    
    let totalUpdated = 0;
    for (const postcode of centralCoastPostcodes) {
      const result = await pool.query(
        'UPDATE suburbs SET region_id = $1 WHERE postcode = $2',
        [centralCoastRegionId, postcode]
      );
      
      totalUpdated += result.rowCount || 0;
    }

    // Step 3: Verify the update
    const verification = await pool.query(
      'SELECT COUNT(*) as count FROM suburbs WHERE region_id = $1',
      [centralCoastRegionId]
    );

    const finalCount = verification.rows[0].count;
    console.log(`✅ Central Coast migration complete! ${finalCount} suburbs mapped to region ${centralCoastRegionId}`);
  } catch (err) {
    console.error('❌ Error in Central Coast migration:', err.message);
    // Don't throw - let server continue if migration fails
  }
}

module.exports = { addCentralCoastRegion };
