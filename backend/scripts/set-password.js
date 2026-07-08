'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { admin } = require('../config/firebase');

async function setPassword(email, newPassword) {
  if (!email || !newPassword) {
    console.error('Usage: node set-password.js <email> <newPassword>');
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    console.log(`✅ Password set for ${email} (UID: ${user.uid})`);
    console.log(`   They can now sign in with email + password AND Google.`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`❌ No account found for ${email}`);
    } else if (err.code === 'auth/invalid-password') {
      console.log(`❌ Password too weak — must be at least 6 characters.`);
    } else {
      console.log(`Error: ${err.message}`);
    }
  }
}

setPassword(process.argv[2], process.argv[3]).then(() => process.exit(0));
