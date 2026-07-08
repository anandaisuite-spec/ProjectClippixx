'use strict';

/**
 * One-time script: relinks synthetic-email creator accounts that were orphaned
 * when the Firebase project was migrated from "clipixx" to "clippixx2026".
 *
 * Strategy: recreate each orphaned Firebase Auth user with the *same UID* they
 * already have in PostgreSQL — so profiles/stars rows referencing that UID
 * become valid again with zero database changes.
 *
 * Usage: node backend/scripts/relink-orphaned-creators.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const crypto = require('crypto');
const admin  = require('firebase-admin');
const { Pool } = require('pg');

// ─── Firebase init ─────────────────────────────────────────────────────────
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
    console.error('❌  FIREBASE_SERVICE_ACCOUNT_PATH not set in .env');
    process.exit(1);
}
const serviceAccount = require(path.resolve(__dirname, '..', serviceAccountPath));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// ─── PostgreSQL init ───────────────────────────────────────────────────────
const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT, 10),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n━━━ relink-orphaned-creators ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { rows } = await pool.query(
        `SELECT id, email, first_name, last_name
         FROM profiles
         WHERE email LIKE '%@creators.clipixx.local'
         ORDER BY created_at`
    );

    console.log(`Found ${rows.length} synthetic-email creator account(s) to check.\n`);

    const relinked = [];

    for (const row of rows) {
        try {
            await admin.auth().getUser(row.id);
            console.log(`✅  ${row.email} — already exists in new project, skipping.`);
        } catch (err) {
            if (err.code !== 'auth/user-not-found') {
                console.error(`❌  Unexpected error for ${row.email}:`, err.message);
                continue;
            }

            const tempPassword = crypto.randomBytes(12).toString('base64url');
            const displayName  = `${row.first_name || ''} ${row.last_name || ''}`.trim();

            await admin.auth().createUser({
                uid:         row.id,
                email:       row.email,
                password:    tempPassword,
                displayName: displayName || undefined,
            });

            console.log(`🔧  Relinked: ${row.email}  (uid: ${row.id})`);
            console.log(`    Temp password: ${tempPassword}`);
            relinked.push({ email: row.email, uid: row.id, tempPassword });
        }
    }

    if (relinked.length > 0) {
        console.log('\n━━━ Relinked accounts — save these passwords now ━━━━━━━━━━━\n');
        for (const a of relinked) {
            console.log(`  Email    : ${a.email}`);
            console.log(`  UID      : ${a.uid}`);
            console.log(`  Password : ${a.tempPassword}`);
            console.log();
        }
        console.log('Use the Admin Dashboard → Reset Password to change them afterwards.');
    } else {
        console.log('\nAll accounts were already present — nothing to relink.');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
    .then(() => pool.end().then(() => admin.app().delete()))
    .catch((err) => { console.error('❌  Fatal:', err.message); process.exit(1); });
