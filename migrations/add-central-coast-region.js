/**
 * Migration: Add NSW Central Coast region
 * Moves Central Coast postcodes from NSW Sydney Metro to NSW Central Coast
 */

async function addCentralCoastRegion(pool) {
  try {
    // Step 1: Insert NSW Central Coast region (id=29)
    const regionCheck = await pool.query(
      'SELECT id FROM regions WHERE name = $1',
      ['NSW Central Coast']
    );

    if (regionCheck.rows.length === 0) {
      // Region doesn't exist, create it
      await pool.query(
        'INSERT INTO regions (name, hds_zone, enabled, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        ['NSW Central Coast', 'NSW Central Coast', true]
      );
      console.log('✅ Created region: NSW Central Coast');
    } else {
      console.log('ℹ️  NSW Central Coast region already exists');
    }

    // Step 2: Get the region ID (might be different if manually created)
    const region = await pool.query(
      'SELECT id FROM regions WHERE name = $1',
      ['NSW Central Coast']
    );

    if (region.rows.length === 0) {
      console.error('❌ Failed to find NSW Central Coast region after creation');
      return;
    }

    const centralCoastRegionId = region.rows[0].id;
    console.log(`Found NSW Central Coast region with ID: ${centralCoastRegionId}`);

    // Step 3: Update all Central Coast postcodes to the new region
    const centralCoastPostcodes = ['2250', '2251', '2252', '2253', '2254', '2255', '2256', '2257', '2258'];
    
    for (const postcode of centralCoastPostcodes) {
      const result = await pool.query(
        'UPDATE suburbs SET region_id = $1 WHERE postcode = $2',
        [centralCoastRegionId, postcode]
      );
      
      if (result.rowCount > 0) {
        console.log(`  ✅ Updated ${result.rowCount} suburbs with postcode ${postcode}`);
      }
    }

    // Step 4: Verify the update
    const verification = await pool.query(
      'SELECT COUNT(*) as count FROM suburbs WHERE region_id = $1',
      [centralCoastRegionId]
    );

    console.log(`\n✅ Migration complete! Total suburbs assigned to NSW Central Coast: ${verification.rows[0].count}`);
  } catch (err) {
    console.error('❌ Error adding Central Coast region:', err.message);
    throw err;
  }
}

module.exports = { addCentralCoastRegion };
