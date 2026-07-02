const { Pool } = require('pg');
require('dotenv').config();

// For Railway: Try multiple connection strategies in order
const getDatabaseConfig = () => {
  // Strategy 1: Use DATABASE_URL if explicitly set
  if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL from environment');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }

  // Strategy 2: Use Railway's auto-injected PG* variables
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

  // Strategy 3: Connect to Railway internal Postgres without password (trust mode)
  console.log('⚠️  Attempting Railway internal connection (trust mode, no password)');
  return {
    host: 'postgres.railway.internal',
    port: 5432,
    database: 'railway',
    user: 'postgres',
    password: '',  // Empty password - relies on trust mode
    ssl: { rejectUnauthorized: false }
  };
};

const pool = new Pool(getDatabaseConfig());

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
  process.exit(-1);
});

module.exports = pool;
