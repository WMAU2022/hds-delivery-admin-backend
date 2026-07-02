const { Pool } = require('pg');
require('dotenv').config();

// Railway automatically injects these variables when Postgres is linked:
// PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
// We construct DATABASE_URL from these if not explicitly provided

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
    console.log('✅ Constructing connection from Railway PG* variables');
    console.log(`   Host: ${process.env.PGHOST}`);
    console.log(`   Port: ${process.env.PGPORT || 5432}`);
    console.log(`   User: ${process.env.PGUSER}`);
    console.log(`   Database: ${process.env.PGDATABASE}`);
    
    return {
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false }
    };
  }

  // Otherwise, use hardcoded Railway internal endpoint with known credentials
  console.log('⚠️  No PG* variables found, using hardcoded Railway internal endpoint');
  return {
    host: 'postgres.railway.internal',
    port: 5432,
    database: 'railway',
    user: 'postgres',
    password: 'iCvnJqAHHQnsafVjMHowoMnXUrUZEyg',
    ssl: { rejectUnauthorized: false }
  };
};

const config = getDatabaseConfig();
const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('❌ Unexpected pool error:', err.message);
  process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
  }
});

module.exports = pool;
