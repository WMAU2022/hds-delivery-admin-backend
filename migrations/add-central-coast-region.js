/**
 * Migration: Add NSW Central Coast region
 * Moves Central Coast postcodes from NSW Sydney Metro to NSW Central Coast
 */

async function addCentralCoastRegion(pool) {
  try {
    // Step 1: Insert NSW Central Coast region
    const regionCheck = await pool.query(
      'SELECT id FROM regions WHERE name = $1',
      ['NSW Central Coast']
    );

    let centralCoastRegionId;

    if (regionCheck.rows.length === 0) {
      // Region doesn't exist, create it with all required columns
      const insertResult = await pool.query(
        `INSERT INTO regions (name, hds_zone, code, location, cutoff_time, enabled, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id`,
        ['NSW Central Coast', 'NSW Central Coast', 'CC', 'WOM', '23:00', true]
      );
      centralCoastRegionId = insertResult.rows[0].id;
      console.log(`✅ Created region: NSW Central Coast (ID: ${centralCoastRegionId})`);
    } else {
      centralCoastRegionId = regionCheck.rows[0].id;
      console.log(`ℹ️  NSW Central Coast region already exists (ID: ${centralCoastRegionId})`);
    }

    // Step 2: Update all Central Coast postcodes to the new region
    const centralCoastPostcodes = ['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258'];
    
    let totalUpdated = 0;
    for (const postcode of centralCoastPostcodes) {
      const result = await pool.query(
        'UPDATE suburbs SET region_id = $1 WHERE postcode = $2',
        [centralCoastRegionId, postcode]
      );
      
      totalUpdated += result.rowCount || 0;
      if (result.rowCount > 0) {
        console.log(`  ✅ Updated ${result.rowCount} suburbs with postcode ${postcode}`);
      }
    }

    // Step 3: Verify the update
    const verification = await pool.query(
      'SELECT COUNT(*) as count FROM suburbs WHERE region_id = $1',
      [centralCoastRegionId]
    );

    console.log(`\n✅ Migration complete!`);
    console.log(`   - NSW Central Coast region created (ID: ${centralCoastRegionId})`);
    console.log(`   - ${totalUpdated} suburbs updated to Central Coast`);
    console.log(`   - Total verification: ${verification.rows[0].count} suburbs in Central Coast region`);
  } catch (err) {
    console.error('❌ Error adding Central Coast region:', err.message);
    throw err;
  }
}

module.exports = { addCentralCoastRegion };
