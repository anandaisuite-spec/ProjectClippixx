const pool = require('./config/db');
const fs = require('fs');

async function debug() {
  try {
    const result = await pool.query('SELECT id, email, role FROM profiles LIMIT 50');
    fs.writeFileSync('debug_users.json', JSON.stringify(result.rows, null, 2));
    console.log(`Saved ${result.rows.length} users to debug_users.json`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
