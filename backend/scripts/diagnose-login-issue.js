'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { admin } = require('../config/firebase');
const pool = require('../config/db');

async function diagnose(email) {
  if (!email) {
    console.error('Usage: node diagnose-login-issue.js <email>');
    process.exit(1);
  }

  console.log(`\nDiagnosing: ${email}\n`);

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Firebase user EXISTS for ${email}`);
    console.log(`   UID:          ${userRecord.uid}`);
    console.log(`   Created:      ${userRecord.metadata.creationTime}`);
    console.log(`   Providers:    ${userRecord.providerData.map(p => p.providerId).join(', ') || 'none'}`);
    console.log(`   Email verified: ${userRecord.emailVerified}`);

    const profileResult = await pool.query('SELECT id, first_name, last_name, role, account_type, created_at FROM profiles WHERE id = $1', [userRecord.uid]);
    if (profileResult.rows.length === 0) {
      console.log(`⚠️  No matching profiles row for UID ${userRecord.uid} — profile was never created`);
    } else {
      const p = profileResult.rows[0];
      console.log(`✅ Profile row exists: ${p.first_name} ${p.last_name} | role=${p.role} | type=${p.account_type}`);
    }

    console.log(`\n→ DIAGNOSIS: Account is real. The password entered doesn't match what Firebase has stored.`);
    console.log(`  Fix: use "Forgot your password?" on the login screen to reset it.`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`❌ No Firebase user found for ${email}`);
      console.log(`\n→ DIAGNOSIS: Signup never completed for this email.`);
      console.log(`  Fix: sign up again through the signup flow.`);
    } else {
      console.log(`Unexpected error: ${err.message}`);
    }
  }
}

diagnose(process.argv[2]).finally(() => pool.end().then(() => process.exit(0)));
