'use strict';

/**
 * Applications business logic + data access.
 *
 * Behavior identical to the pre-refactor routes/applications.js: same SQL, same
 * pagination, same 404 rule, same audit-log side effect. The 404 is raised as
 * ApiError(404, 'Application not found') — the existing errorHandler renders it
 * as { error: 'Application not found' } with status 404, byte-identical to the
 * old inline res.status(404).json({ error: ... }).
 *
 * Audit logging continues to use the shared services/auditService (unchanged).
 */

const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { writeAuditLog } = require('../../services/auditService');

const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'rejected'];

/** Insert a creator application; returns { id, full_name, category, status, created_at }. */
async function submitApplication({ full_name, email, category, social_links, followers_count, bio, why_join }) {
    const result = await pool.query(
        `INSERT INTO creator_applications (full_name, email, category, social_links, followers_count, bio, why_join)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, full_name, category, status, created_at`,
        [full_name, email, category, social_links, followers_count || '', bio, why_join],
    );
    return result.rows[0];
}

/** Paginated application list (admin). Mirrors the original query exactly. */
async function listApplications({ statusFilter, page: pageRaw, limit: limitRaw }) {
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw) || 50));
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
        where += ` AND status = $${idx++}`;
        params.push(statusFilter);
    }

    const [dataResult, countResult] = await Promise.all([
        pool.query(
            `SELECT id, full_name, email, category, social_links, followers_count, bio, why_join, status, created_at
             FROM creator_applications ${where}
             ORDER BY created_at DESC
             LIMIT $${idx} OFFSET $${idx + 1}`,
            [...params, limit, offset],
        ),
        pool.query(`SELECT COUNT(*) FROM creator_applications ${where}`, params),
    ]);

    const total = parseInt(countResult.rows[0].count);
    return {
        data: dataResult.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

/**
 * Admin updates an application's status; writes an audit log (fire-and-forget).
 * @param {object} actor  { uid, email } of the acting admin
 * @returns the updated application row
 * @throws ApiError(404) if the application doesn't exist
 */
async function updateStatus(id, status, actor) {
    const before = await pool.query(
        'SELECT full_name, email, status FROM creator_applications WHERE id = $1',
        [id],
    );
    if (before.rows.length === 0) {
        throw new ApiError(404, 'Application not found');
    }

    const result = await pool.query(
        `UPDATE creator_applications SET status = $1, updated_at = now() WHERE id = $2
         RETURNING id, full_name, email, category, status, created_at`,
        [status, id],
    );

    // Fire-and-forget, identical call/shape to the original.
    writeAuditLog({
        actorId:     actor.uid,
        actorEmail:  actor.email,
        action:      'application_status_change',
        targetId:    id,
        targetEmail: before.rows[0].email,
        metadata:    { previousStatus: before.rows[0].status, newStatus: status, applicantName: before.rows[0].full_name },
    });

    return result.rows[0];
}

module.exports = { submitApplication, listApplications, updateStatus, VALID_STATUSES };
