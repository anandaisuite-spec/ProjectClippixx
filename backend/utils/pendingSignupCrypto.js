'use strict';

/**
 * AES-256-GCM reversible encryption for the pending_signups.password_encrypted column.
 *
 * Reversible (not one-way hash) because we need the plaintext later to create
 * the real Firebase Auth user once both OTPs are verified.
 *
 * Key must be a 64-character hex string (32 bytes).
 * Generate once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Store in backend/.env as PENDING_SIGNUP_ENCRYPTION_KEY.
 */

const crypto = require('crypto');

function getKey() {
    const hex = process.env.PENDING_SIGNUP_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            'PENDING_SIGNUP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
            'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
    return Buffer.from(hex, 'hex');
}

function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((b) => b.toString('base64')).join(':');
}

function decrypt(encoded) {
    const key = getKey();
    const parts = encoded.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted payload');
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertextB64, 'base64')),
        decipher.final(),
    ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
