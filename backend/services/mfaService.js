const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const pool = require('../config/db');

// Allow a ±1 step (30s) clock-drift window when verifying TOTP tokens.
authenticator.options = { window: 1 };

const ISSUER = process.env.MFA_ISSUER || 'Clippixx';
const BACKUP_CODE_COUNT = 10;

// ─── Backup code helpers ─────────────────────────────────────

/** Hash a backup code with SHA-256 (codes are high-entropy, so a fast hash is fine). */
function hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
}

/** Generate N human-friendly single-use codes, e.g. "a1b2-c3d4". */
function generateBackupCodes(count = BACKUP_CODE_COUNT) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const raw = crypto.randomBytes(4).toString('hex'); // 8 hex chars
        codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
    }
    return codes;
}

// ─── TOTP setup / verification ───────────────────────────────

/**
 * Begin MFA enrollment: generate a secret + otpauth QR data URL.
 * Stored with is_enabled=false until the user confirms a valid token.
 */
async function beginSetup(userId, accountLabel) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(accountLabel, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Upsert a not-yet-enabled secret. Re-running setup resets a pending secret
    // but never silently disables an already-enabled MFA (guarded in route).
    await pool.query(
        `INSERT INTO user_mfa (user_id, secret, is_enabled)
         VALUES ($1, $2, false)
         ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now()`,
        [userId, secret]
    );

    return { secret, otpauth, qrDataUrl };
}

/** Verify a 6-digit TOTP token against the user's stored secret. */
function verifyToken(secret, token) {
    if (!secret || !token) return false;
    try {
        return authenticator.verify({ token: String(token).trim(), secret });
    } catch {
        return false;
    }
}

/**
 * Enable MFA after the user proves they can generate a valid token.
 * Returns the plaintext backup codes ONCE (only hashes are persisted).
 */
async function enable(userId, token) {
    const row = await getRaw(userId);
    if (!row) return { ok: false, reason: 'no_setup' };
    if (row.is_enabled) return { ok: false, reason: 'already_enabled' };
    if (!verifyToken(row.secret, token)) return { ok: false, reason: 'invalid_token' };

    const codes = generateBackupCodes();
    const hashes = codes.map(hashCode);

    await pool.query(
        `UPDATE user_mfa
         SET is_enabled = true, backup_codes = $1, enabled_at = now(), last_used_at = now()
         WHERE user_id = $2`,
        [hashes, userId]
    );

    return { ok: true, backupCodes: codes };
}

/**
 * Verify either a TOTP token or a single-use backup code.
 * Backup codes are consumed (removed) on use.
 */
async function verifyForUser(userId, token) {
    const row = await getRaw(userId);
    if (!row || !row.is_enabled) return { ok: false, reason: 'not_enabled' };

    // 1. Try TOTP
    if (verifyToken(row.secret, token)) {
        await pool.query('UPDATE user_mfa SET last_used_at = now() WHERE user_id = $1', [userId]);
        return { ok: true, method: 'totp' };
    }

    // 2. Try backup code (constant-time compare against stored hashes)
    const candidate = hashCode(String(token).trim());
    const remaining = row.backup_codes || [];
    const idx = remaining.findIndex((h) =>
        h.length === candidate.length &&
        crypto.timingSafeEqual(Buffer.from(h), Buffer.from(candidate))
    );
    if (idx !== -1) {
        const next = remaining.filter((_, i) => i !== idx);
        await pool.query(
            'UPDATE user_mfa SET backup_codes = $1, last_used_at = now() WHERE user_id = $2',
            [next, userId]
        );
        return { ok: true, method: 'backup_code', remaining: next.length };
    }

    return { ok: false, reason: 'invalid_token' };
}

/** Regenerate backup codes (requires a valid TOTP token at the route layer). */
async function regenerateBackupCodes(userId) {
    const codes = generateBackupCodes();
    const hashes = codes.map(hashCode);
    await pool.query(
        'UPDATE user_mfa SET backup_codes = $1 WHERE user_id = $2 AND is_enabled = true',
        [hashes, userId]
    );
    return codes;
}

/** Disable MFA and wipe the secret + codes. */
async function disable(userId) {
    await pool.query('DELETE FROM user_mfa WHERE user_id = $1', [userId]);
}

/** Public-safe status (never leaks the secret or codes). */
async function getStatus(userId) {
    const row = await getRaw(userId);
    if (!row) return { enrolled: false, enabled: false, backupCodesRemaining: 0 };
    return {
        enrolled: true,
        enabled: row.is_enabled,
        backupCodesRemaining: (row.backup_codes || []).length,
        enabledAt: row.enabled_at,
        lastUsedAt: row.last_used_at,
    };
}

/** Internal: raw row including secret. Never return this to clients. */
async function getRaw(userId) {
    const result = await pool.query('SELECT * FROM user_mfa WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
}

async function isEnabled(userId) {
    const result = await pool.query('SELECT is_enabled FROM user_mfa WHERE user_id = $1', [userId]);
    return result.rows.length > 0 && result.rows[0].is_enabled === true;
}

module.exports = {
    beginSetup,
    enable,
    verifyForUser,
    verifyToken,
    regenerateBackupCodes,
    disable,
    getStatus,
    isEnabled,
};
