const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available (Railway), otherwise use individual DB_* variables
const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'hds_delivery_admin',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
  process.exit(-1);
});

module.exports = pool;
