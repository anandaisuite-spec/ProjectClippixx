'use strict';

/**
 * Hourly cleanup job (req 23).
 * Calls the three PostgreSQL cleanup functions defined in migration 021.
 * Designed to be started once from server.js — uses setInterval, no external
 * scheduler dependency needed.
 */

const pool = require('../config/db');

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runCleanup() {
    try {
        const [otpResult, pendingResult, auditResult] = await Promise.all([
            pool.query('SELECT cleanup_expired_otps() AS deleted'),
            pool.query('SELECT cleanup_expired_pending_signups() AS deleted'),
            pool.query('SELECT cleanup_old_audit_logs() AS deleted'),
        ]);

        const otpDeleted     = otpResult.rows[0].deleted;
        const pendingDeleted = pendingResult.rows[0].deleted;
        const auditDeleted   = auditResult.rows[0].deleted;

        if (otpDeleted > 0 || pendingDeleted > 0 || auditDeleted > 0) {
            console.log(
                `[otpCleanup] Deleted: ${otpDeleted} OTP rows, ` +
                `${pendingDeleted} pending signups, ` +
                `${auditDeleted} old audit logs`
            );
        }
    } catch (err) {
        // Never crash the process — log and continue
        console.error('[otpCleanup] Error during cleanup:', err.message);
    }
}

/**
 * Start the cleanup job.
 * Runs once immediately on startup, then every hour.
 * Returns the interval handle so callers can clearInterval on graceful shutdown.
 */
function startOtpCleanupJob() {
    // Run once at startup to catch anything leftover
    runCleanup();

    const handle = setInterval(runCleanup, INTERVAL_MS);
    // Don't keep the process alive just for this timer
    if (handle.unref) handle.unref();

    console.log('[otpCleanup] Hourly cleanup job started.');
    return handle;
}

module.exports = { startOtpCleanupJob, runCleanup };
