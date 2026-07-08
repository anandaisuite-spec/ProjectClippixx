const pool = require('../config/db');

/**
 * Write an audit log entry. Never throws — errors are absorbed.
 * Designed to be fire-and-forget: audit failure must never crash a valid request.
 *
 * @param {object} params
 * @param {string} params.actorId
 * @param {string} params.actorEmail
 * @param {'role_change'|'user_delete'|'admin_create_user'|'profile_update_by_admin'} params.action
 * @param {string} [params.targetId]
 * @param {string} [params.targetEmail]
 * @param {object} [params.metadata]
 */
async function writeAuditLog({ actorId, actorEmail, action, targetId, targetEmail, metadata = {} }) {
    try {
        await pool.query(
            `INSERT INTO audit_logs (actor_id, actor_email, action, target_id, target_email, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [actorId, actorEmail, action, targetId || null, targetEmail || null, JSON.stringify(metadata)]
        );
    } catch (err) {
        console.error('[auditService] Failed to write audit log:', err.message, { action, actorId });
    }
}

module.exports = { writeAuditLog };
