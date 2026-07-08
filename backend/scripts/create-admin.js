'use strict';

/**
 * Create (or upgrade) an admin / super_admin account.
 *
 * Creates the Firebase Auth user if it doesn't exist (or sets the password if it
 * does), then upserts a matching row in the `profiles` table with the given role.
 *
 * Usage:
 *   node create-admin.js <email> <password> <role> [firstName] [lastName]
 *   role = admin | super_admin
 *
 * Example:
 *   node create-admin.js hello@clippixx.com "ajs@2026" super_admin Clippixx Admin
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { admin } = require('../config/firebase');
const pool = require('../config/db');

async function createAdmin(email, password, role, firstName, lastName) {
    if (!email || !password || !role) {
        console.error('Usage: node create-admin.js <email> <password> <role> [firstName] [lastName]');
        console.error('  role = admin | super_admin');
        process.exit(1);
    }
    if (!['admin', 'super_admin'].includes(role)) {
        console.error(`❌ Invalid role "${role}". Must be "admin" or "super_admin".`);
        process.exit(1);
    }
    if (password.length < 6) {
        console.error('❌ Password too weak — Firebase requires at least 6 characters.');
        process.exit(1);
    }

    const first = firstName || 'Clippixx';
    const last = lastName || (role === 'super_admin' ? 'SuperAdmin' : 'Admin');

    // 1) Firebase Auth — create the user, or set the password if they already exist.
    let uid;
    try {
        const user = await admin.auth().getUserByEmail(email);
        uid = user.uid;
        await admin.auth().updateUser(uid, { password, emailVerified: true });
        console.log(`ℹ️  Firebase user already existed — password updated. (UID: ${uid})`);
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            const created = await admin.auth().createUser({
                email,
                password,
                emailVerified: true,
                displayName: `${first} ${last}`,
            });
            uid = created.uid;
            console.log(`✅ Firebase user created. (UID: ${uid})`);
        } else {
            throw err;
        }
    }

    // 2) Profiles table — upsert the row carrying the role.
    await pool.query(
        `INSERT INTO profiles (id, account_type, first_name, last_name, email, role)
         VALUES ($1, 'fan', $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET role = EXCLUDED.role,
               email = EXCLUDED.email,
               first_name = COALESCE(NULLIF(profiles.first_name, ''), EXCLUDED.first_name),
               last_name = COALESCE(NULLIF(profiles.last_name, ''), EXCLUDED.last_name)`,
        [uid, first, last, email, role]
    );

    console.log(`✅ Profile upserted with role "${role}" for ${email}.`);
    console.log(`\n   Sign in with:`);
    console.log(`     Email:    ${email}`);
    console.log(`     Password: ${password}`);
    console.log(`     Role:     ${role}  (super_admin has full admin access too)\n`);
}

createAdmin(
    process.argv[2],
    process.argv[3],
    process.argv[4],
    process.argv[5],
    process.argv[6],
)
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (err) => {
        console.error('❌ Failed:', err.message);
        try { await pool.end(); } catch { /* ignore */ }
        process.exit(1);
    });
