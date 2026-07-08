'use strict';

const pool = require('../config/db');

/**
 * Fire-and-forget security audit log.
 * A logging failure must NEVER block or crash an auth response.
 *
 * @param {'otp_sent'|'otp_verified'|'otp_failed'|'otp_locked'|'otp_resend'|'signup_complete'|'login_complete'|'firebase_duplicate_blocked'} action
 * @param {{ email?: string, phone?: string, ip?: string, userAgent?: string, metadata?: object }} ctx
 */
async function securityAudit(action, { email = null, phone = null, ip = null, userAgent = null, metadata = {} } = {}) {
    try {
        await pool.query(
            `INSERT INTO security_audit_logs (email, phone, action, ip, user_agent, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [email ?? null, phone ?? null, action, ip ?? null, userAgent ?? null, JSON.stringify(metadata)]
        );
    } catch (err) {
        console.error('[securityAudit] write failed:', err.message);
    }
}

module.exports = { securityAudit };
