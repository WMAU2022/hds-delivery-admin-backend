// Database-backed regions store
// Reads from and writes to PostgreSQL, not in-memory

const pool = require('./db');

console.log('🔄 Loading regions-store.js (database-backed)...');

module.exports = {
  async getAll() {
    try {
      const result = await pool.query('SELECT * FROM regions ORDER BY id');
      return result.rows;
    } catch (err) {
      console.error('❌ getAll error:', err.message);
      return [];
    }
  },

  async getById(id) {
    try {
      const result = await pool.query('SELECT * FROM regions WHERE id = $1', [parseInt(id)]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ getById error:', err.message);
      return null;
    }
  },

  async create(data) {
    try {
      const result = await pool.query(
        `INSERT INTO regions (name, zone_code, location, cutoff_time, enabled)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.name, data.zone_code || '', data.location || '', data.cutoff_time || '23:00', data.enabled !== false]
      );
      return result.rows[0];
    } catch (err) {
      console.error('❌ create error:', err.message);
      return null;
    }
  },

  async toggle(id) {
    try {
      const result = await pool.query(
        'UPDATE regions SET enabled = NOT enabled, updated_at = NOW() WHERE id = $1 RETURNING *',
        [parseInt(id)]
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ toggle error:', err.message);
      return null;
    }
  },

  async enable(id) {
    try {
      const result = await pool.query(
        'UPDATE regions SET enabled = true, updated_at = NOW() WHERE id = $1 RETURNING *',
        [parseInt(id)]
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ enable error:', err.message);
      return null;
    }
  },

  async disable(id) {
    try {
      const result = await pool.query(
        'UPDATE regions SET enabled = false, updated_at = NOW() WHERE id = $1 RETURNING *',
        [parseInt(id)]
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ disable error:', err.message);
      return null;
    }
  },

  async toggleMultiple(ids) {
    try {
      const result = await pool.query(
        'UPDATE regions SET enabled = NOT enabled, updated_at = NOW() WHERE id = ANY($1) RETURNING *',
        [ids.map(id => parseInt(id))]
      );
      return result.rows;
    } catch (err) {
      console.error('❌ toggleMultiple error:', err.message);
      return [];
    }
  },

  async enableMultiple(ids) {
    try {
      const result = await pool.query(
        'UPDATE regions SET enabled = true, updated_at = NOW() WHERE id = ANY($1) RETURNING *',
        [ids.map(id => parseInt(id))]
      );
      return result.rows;
    } catch (err) {
      console.error('❌ enableMultiple error:', err.message);
      return [];
    }
  },

  async disableMultiple(ids) {
    try {
      const result = await pool.query(
        'UPDATE regions SET enabled = false, updated_at = NOW() WHERE id = ANY($1) RETURNING *',
        [ids.map(id => parseInt(id))]
      );
      return result.rows;
    } catch (err) {
      console.error('❌ disableMultiple error:', err.message);
      return [];
    }
  },

  async update(id, data) {
    try {
      const updates = [];
      const values = [parseInt(id)];
      let paramCount = 2;

      if (data.name) {
        updates.push(`name = $${paramCount}`);
        values.push(data.name);
        paramCount++;
      }
      if (data.location !== undefined) {
        updates.push(`location = $${paramCount}`);
        values.push(data.location || '');
        paramCount++;
      }
      if (data.cutoff_time !== undefined) {
        updates.push(`cutoff_time = $${paramCount}`);
        values.push(data.cutoff_time);
        paramCount++;
      }
      if (data.enabled !== undefined) {
        updates.push(`enabled = $${paramCount}`);
        values.push(data.enabled);
        paramCount++;
      }

      if (updates.length === 0) {
        const result = await pool.query('SELECT * FROM regions WHERE id = $1', values);
        return result.rows[0] || null;
      }

      updates.push('updated_at = NOW()');
      const query = `UPDATE regions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ update error:', err.message);
      return null;
    }
  },

  async delete(id) {
    try {
      const result = await pool.query('DELETE FROM regions WHERE id = $1 RETURNING id', [parseInt(id)]);
      return result.rows.length > 0;
    } catch (err) {
      console.error('❌ delete error:', err.message);
      return false;
    }
  },
};
