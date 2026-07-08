const { Pool, types } = require('pg');
require('dotenv').config();

// PostgreSQL OID 1700 = NUMERIC/DECIMAL. By default node-pg returns these as
// strings (to avoid float precision loss), which breaks `.toFixed()` and other
// numeric ops on the frontend. Parse them as real numbers globally so every
// NUMERIC column (rating, avg_response_time_hours, etc.) comes through as a number.
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

// ─── Fail-fast environment validation ────────────────────
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required env var: ${key}`);
    process.exit(1);
  }
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL connected successfully'))
  .catch((err) => {
    console.error('❌ PostgreSQL connection error:', err.message);
    process.exit(1);
  });

module.exports = pool;
