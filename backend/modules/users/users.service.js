'use strict';

/**
 * Users business logic + data access.
 *
 * Behavior identical to the pre-refactor routes/users.js: same public-only
 * column set, same WHERE (creator profiles only), same sort whitelist,
 * same pagination math, same search behavior.
 */

const pool = require('../../config/db');

const VALID_SORT = ['created_at', 'first_name'];

/**
 * Public, paginated list of creator profiles. Returns only public fields —
 * email, phone, role are never selected.
 * @returns {{ data: object[], pagination: object }}
 */
async function listCreators({ search, sort, order, page: pageRaw, limit: limitRaw }) {
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw) || 20));
    const offset = (page - 1) * limit;

    const sortCol = VALID_SORT.includes(sort) ? sort : 'created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    let where = `WHERE account_type = 'creator'`;
    const params = [];
    let idx = 1;

    if (search && search.length <= 100) {
        where += ` AND (first_name ILIKE $${idx} OR last_name ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
    }

    const [dataResult, countResult] = await Promise.all([
        pool.query(
            `SELECT id, first_name, last_name, avatar_url, bio, account_type, created_at
             FROM profiles ${where}
             ORDER BY ${sortCol} ${sortDir}
             LIMIT $${idx} OFFSET $${idx + 1}`,
            [...params, limit, offset],
        ),
        pool.query(`SELECT COUNT(*) FROM profiles ${where}`, params),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return {
        data: dataResult.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

module.exports = { listCreators };
