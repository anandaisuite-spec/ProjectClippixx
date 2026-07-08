'use strict';

/**
 * Feedback business logic + data access.
 *
 * Behavior identical to the pre-refactor routes/feedback.js: same SQL, same
 * pagination math, same returned fields.
 */

const pool = require('../../config/db');

const VALID_TYPES = ['Bug Report', 'Feature Request', 'General Feedback', 'Other'];

/** Insert a feedback row; returns { id, type, subject, created_at }. */
async function submitFeedback({ type, subject, message, email }) {
    const result = await pool.query(
        `INSERT INTO feedback (type, subject, message, email)
         VALUES ($1, $2, $3, $4)
         RETURNING id, type, subject, created_at`,
        [type, subject, message, email || ''],
    );
    return result.rows[0];
}

/**
 * Paginated feedback list (admin). Mirrors the original query exactly.
 * @returns {{ data: object[], pagination: object }}
 */
async function listFeedback({ typeFilter, page: pageRaw, limit: limitRaw }) {
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw) || 50));
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (typeFilter && VALID_TYPES.includes(typeFilter)) {
        where += ` AND type = $${idx++}`;
        params.push(typeFilter);
    }

    const [dataResult, countResult] = await Promise.all([
        pool.query(
            `SELECT id, type, subject, message, email, created_at
             FROM feedback ${where}
             ORDER BY created_at DESC
             LIMIT $${idx} OFFSET $${idx + 1}`,
            [...params, limit, offset],
        ),
        pool.query(`SELECT COUNT(*) FROM feedback ${where}`, params),
    ]);

    const total = parseInt(countResult.rows[0].count);
    return {
        data: dataResult.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

module.exports = { submitFeedback, listFeedback, VALID_TYPES };
