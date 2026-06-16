const { Pool } = require('pg');
require('dotenv').config();

// Railway automatically injects PG* variables when Postgres is linked
const getDatabaseConfig = () => {
  // First, try to use DATABASE_URL if it exists
  if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL from environment');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }

  // If Railway has auto-injected PG* variables, use those
  if (process.env.PGHOST) {
    console.log('✅ Using Railway auto-injected PG* variables');
    return {
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false }
    };
  }

  // Fallback: use Railway internal endpoint with known credentials
  console.log('⚠️  No PG* variables found, using Railway internal endpoint');
  return {
    host: 'postgres.railway.internal',
    port: 5432,
    database: 'railway',
    user: 'postgres',
    password: 'iCvnJqAHHQnsafVjMHowoMnXUrUZEyg',
    ssl: { rejectUnauthorized: false }
  };
};

const pool = new Pool(getDatabaseConfig());

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
  process.exit(-1);
});

module.exports = pool;
