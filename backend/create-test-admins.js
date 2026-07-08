'use strict';

/**
 * Creates local Firebase test accounts and ensures matching PostgreSQL profile rows
 * with the correct roles exist.
 *
 * Usage:  node create-test-admins.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const admin = require('firebase-admin');
const { Pool } = require('pg');

// ─── Firebase init ─────────────────────────────────────────────────────────
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('❌  FIREBASE_SERVICE_ACCOUNT_PATH is not set in .env');
  process.exit(1);
}

const serviceAccount = require(path.resolve(__dirname, serviceAccountPath));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// ─── PostgreSQL init ───────────────────────────────────────────────────────
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`❌  Missing required env var: ${key}`);
    process.exit(1);
  }
}

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ─── Test accounts definition ──────────────────────────────────────────────
const TEST_USERS = [
  {
    email:      'admin@test.com',
    password:   'admin123',
    role:       'admin',
    first_name: 'Admin',
    last_name:  'User',
  },
  {
    email:      'superadmin@test.com',
    password:   'super123',
    role:       'super_admin',
    first_name: 'Super',
    last_name:  'Admin',
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Creates a Firebase Auth user or returns the existing one.
 * Returns { uid, created: boolean }
 */
async function ensureFirebaseUser(email, password) {
  try {
    const user = await admin.auth().createUser({ email, password });
    return { uid: user.uid, created: true };
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(email);
      return { uid: existing.uid, created: false };
    }
    throw err;
  }
}

/**
 * Upserts a profiles row and sets the role.
 * INSERT on missing, UPDATE role on existing.
 */
async function upsertProfile(client, uid, { email, first_name, last_name, role }) {
  const sql = `
    INSERT INTO profiles (id, email, first_name, last_name, account_type, role, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 'fan', $5, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
      SET role       = EXCLUDED.role,
          updated_at = NOW()
    RETURNING id, email, role,
              (xmax = 0) AS inserted
  `;
  const { rows } = await client.query(sql, [uid, email, first_name, last_name, role]);
  return rows[0];
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━ create-test-admins ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = await pool.connect();

  try {
    for (const userDef of TEST_USERS) {
      console.log(`▶  Processing ${userDef.email} …`);

      // 1. Firebase user
      const { uid, created } = await ensureFirebaseUser(userDef.email, userDef.password);
      if (created) {
        console.log(`   ✅ Firebase user created  (uid: ${uid})`);
      } else {
        console.log(`   ℹ️  Firebase user already exists  (uid: ${uid})`);
      }

      // 2. PostgreSQL profile row + role
      const row = await upsertProfile(client, uid, userDef);
      const action = row.inserted ? 'inserted' : 'role updated';
      console.log(`   ✅ PostgreSQL profile ${action}  (role: ${row.role})`);
      console.log();
    }
  } finally {
    client.release();
    await pool.end();
    await admin.app().delete();
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('━━━ Test credentials ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  for (const u of TEST_USERS) {
    console.log(`  Email    : ${u.email}`);
    console.log(`  Password : ${u.password}`);
    console.log(`  Role     : ${u.role}`);
    console.log();
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('❌  Fatal error:', err.message);
  process.exit(1);
});
