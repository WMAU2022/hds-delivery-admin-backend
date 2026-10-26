const { Pool } = require('pg');
require('dotenv').config();

// The ONE database pool for the whole backend. lib/db-auto.js and
// lib/db-no-auth.js re-export this, so every route, job and migration shares
// the same connection settings and the same connections.
//
// Railway: set DATABASE_URL=${{Postgres.DATABASE_URL}} on this service.
// Linking the Postgres service (PG* variables) also works.
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL from environment');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }

  if (process.env.PGHOST) {
    console.log('✅ Using Railway PG* variables');
    return {
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false }
    };
  }

  // No guessing at hosts or passwords: report it plainly so it is fixed in
  // Railway Variables instead of every query failing with a confusing error.
  console.error('❌ No database configured: set DATABASE_URL (Railway: ${{Postgres.DATABASE_URL}})');
  return null;
};

const config = getDatabaseConfig();
const pool = config
  ? new Pool(config)
  : {
      query: async () => {
        throw new Error('Database not configured: set DATABASE_URL on this service');
      },
      connect: async () => {
        throw new Error('Database not configured: set DATABASE_URL on this service');
      },
      on: () => {},
    };

pool.on('connect', () => {
  console.log('✅ Database connected');
});

// An idle client losing its connection (e.g. Postgres restarting) must not take
// the whole server down; pg discards that client and opens a new one next query.
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

module.exports = pool;
