/**
 * Migration: Add CASULA (2170) suburb for HDS enrichment
 * Required for order enrichment - order #1044 was failing because 2170 wasn't in suburbs table
 */

async function addCasulaSuburb(pool) {
  try {
    // Check if CASULA 2170 already exists
    const existing = await pool.query('SELECT id FROM suburbs WHERE postcode = $1', ['2170']);
    
    if (existing.rows.length === 0) {
      // Add CASULA 2170 with region_id 1 (NSW Sydney Metro)
      await pool.query(
        'INSERT INTO suburbs (name, postcode, state, region_id, hds_zone, serviceable) VALUES ($1, $2, $3, $4, $5, $6)',
        ['CASULA', '2170', 'NSW', 1, 'NSW Sydney Metro', true]
      );
      console.log('✅ Added CASULA (2170) to suburbs table');
    }
  } catch (err) {
    // If insert fails with unique constraint, it already exists
    if (err.code === '23505') {
      console.log('ℹ️  CASULA (2170) already exists');
    } else {
      console.warn('⚠️  Warning adding CASULA suburb:', err.message);
    }
  }
}

module.exports = { addCasulaSuburb };
