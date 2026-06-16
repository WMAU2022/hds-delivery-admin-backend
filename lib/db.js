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

  // Fallback: use Railway internal endpoint without password (trust mode)
  console.log('⚠️  Using Railway internal endpoint (trust mode)');
  return {
    host: 'postgres.railway.internal',
    port: 5432,
    database: 'railway',
    user: 'postgres',
    password: '',  // Empty password for trust mode
    ssl: { rejectUnauthorized: false }
  };
};

const pool = new Pool(getDatabaseConfig());

let isConnected = false;

// Test connection and fallback if needed
pool.on('connect', () => {
  isConnected = true;
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
  if (!isConnected) {
    console.error('   Connection failed - check credentials');
  }
});

module.exports = pool;
