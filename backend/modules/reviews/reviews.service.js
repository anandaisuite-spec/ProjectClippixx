'use strict';

/**
 * Legacy order-based reviews — business logic + data access.
 *
 * IMPORTANT: this module's HTTP errors use a TWO-field shape
 * `{ error: <category>, message: <text> }` (e.g. { error:'Not Found', message:'Order not found' }),
 * which differs from other modules' bare `{ error }`. To preserve that contract
 * byte-for-byte, the service throws ReviewError(status, category, message) and
 * the controller emits the exact JSON — NOT routed through the generic
 * errorHandler (which would output a different shape).
 */

const pool = require('../../config/db');

class ReviewError extends Error {
    constructor(status, category, message) {
        super(message);
        this.name = 'ReviewError';
        this.status = status;
        this.category = category; // becomes the `error` field
        this.clientMessage = message; // becomes the `message` field
    }
}

const REVIEW_COLUMNS = `
  id, order_id, star_id, author_id, rating, comment, is_visible, created_at, updated_at
`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function createReview(uid, { order_id, rating, comment }) {
    const orderResult = await pool.query(
        'SELECT id, buyer_id, star_id, status FROM orders WHERE id = $1',
        [order_id],
    );
    if (orderResult.rows.length === 0) throw new ReviewError(404, 'Not Found', 'Order not found');

    const order = orderResult.rows[0];
    if (order.buyer_id !== uid) throw new ReviewError(403, 'Forbidden', 'You can only review your own orders');
    if (order.status !== 'completed') throw new ReviewError(409, 'Conflict', 'You can only review completed orders');

    const existing = await pool.query('SELECT id FROM reviews WHERE order_id = $1', [order_id]);
    if (existing.rows.length > 0) throw new ReviewError(409, 'Conflict', 'This order has already been reviewed');

    const result = await pool.query(
        `INSERT INTO reviews (order_id, star_id, author_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${REVIEW_COLUMNS}`,
        [order_id, order.star_id, uid, rating, comment || ''],
    );
    return result.rows[0];
}

async function getStarReviews(starId, pageRaw, limitRaw) {
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw) || 20));
    const offset = (page - 1) * limit;

    if (!UUID_RE.test(starId)) {
        throw new ReviewError(400, 'Invalid star id', 'starId must be a valid UUID');
    }

    const dataQuery = `
        SELECT r.id, r.order_id, r.rating, r.comment AS review_text, r.created_at,
               p.first_name, p.last_name, p.avatar_url
        FROM reviews r
        JOIN profiles p ON p.id = r.author_id
        WHERE r.star_id = $1 AND r.is_visible = true
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
    `;
    const countQuery = 'SELECT COUNT(*) FROM reviews WHERE star_id = $1 AND is_visible = true';
    const breakdownQuery = `
        SELECT rating, COUNT(*)::int AS count
        FROM reviews
        WHERE star_id = $1 AND is_visible = true
        GROUP BY rating
    `;

    const [dataResult, countResult, breakdownResult] = await Promise.all([
        pool.query(dataQuery, [starId, limit, offset]),
        pool.query(countQuery, [starId]),
        pool.query(breakdownQuery, [starId]),
    ]);

    const breakdown = breakdownResult.rows.map((row) => ({ rating: row.rating, count: String(row.count) }));
    const total = parseInt(countResult.rows[0].count);
    return {
        data: dataResult.rows,
        breakdown,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

async function getMyReviews(uid) {
    const result = await pool.query(
        `SELECT r.id, r.order_id, r.star_id, r.rating, r.comment, r.is_visible, r.created_at,
                s.name AS star_name, s.image_url AS star_image_url
         FROM reviews r
         JOIN stars s ON s.id = r.star_id
         WHERE r.author_id = $1
         ORDER BY r.created_at DESC`,
        [uid],
    );
    return result.rows;
}

async function updateReview(uid, id, { rating, comment }) {
    const existing = await pool.query('SELECT author_id FROM reviews WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new ReviewError(404, 'Not Found', 'Review not found');
    if (existing.rows[0].author_id !== uid) throw new ReviewError(403, 'Forbidden', 'You can only edit your own review');

    const result = await pool.query(
        `UPDATE reviews SET rating = $1, comment = $2 WHERE id = $3 RETURNING ${REVIEW_COLUMNS}`,
        [rating, comment || '', id],
    );
    return result.rows[0];
}

async function deleteReview({ uid, role }, id) {
    const existing = await pool.query('SELECT author_id FROM reviews WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new ReviewError(404, 'Not Found', 'Review not found');

    const isAuthor = existing.rows[0].author_id === uid;
    const isAdmin = role === 'admin' || role === 'super_admin';
    if (!isAuthor && !isAdmin) throw new ReviewError(403, 'Forbidden', 'Not allowed to delete this review');

    await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
}

async function setVisibility(id, is_visible) {
    const result = await pool.query(
        `UPDATE reviews SET is_visible = $1 WHERE id = $2 RETURNING ${REVIEW_COLUMNS}`,
        [is_visible, id],
    );
    if (result.rows.length === 0) throw new ReviewError(404, 'Not Found', 'Review not found');
    return result.rows[0];
}

module.exports = {
    ReviewError, createReview, getStarReviews, getMyReviews, updateReview, deleteReview, setVisibility,
};
