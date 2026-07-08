'use strict';

/**
 * Orders business logic + data access.
 *
 * Uses the same two-field { error, message } HTTP error shape as the original,
 * carried via OrderError(status, category, message) and emitted by the
 * controller (NOT the generic errorHandler) to preserve the contract exactly.
 *
 * All SQL, transition rules, and actor-authorization logic are byte-for-byte
 * the same as the pre-refactor routes/orders.js.
 */

const pool = require('../../config/db');

class OrderError extends Error {
    constructor(status, category, message) {
        super(message);
        this.name = 'OrderError';
        this.status = status;
        this.category = category;
        this.clientMessage = message;
    }
}

const ORDER_COLUMNS = `
  id, buyer_id, star_id, recipient_name, occasion, instructions,
  price, status, video_url, delivered_at, created_at, updated_at
`;

const TRANSITIONS = {
    pending:     ['accepted', 'rejected', 'cancelled'],
    accepted:    ['in_progress', 'cancelled'],
    in_progress: ['delivered'],
    delivered:   ['completed'],
};

async function createOrder(uid, { star_id, recipient_name, occasion, instructions }) {
    const starResult = await pool.query('SELECT id, price FROM stars WHERE id = $1', [star_id]);
    if (starResult.rows.length === 0) throw new OrderError(404, 'Not Found', 'Star not found');

    const result = await pool.query(
        `INSERT INTO orders (buyer_id, star_id, recipient_name, occasion, instructions, price)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${ORDER_COLUMNS}`,
        [uid, star_id, recipient_name, occasion, instructions || '', starResult.rows[0].price],
    );
    return result.rows[0];
}

async function listMyOrders(uid, { status, page: pageRaw, limit: limitRaw }) {
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw) || 20));
    const offset = (page - 1) * limit;

    const params = [uid];
    let whereClause = 'WHERE o.buyer_id = $1';
    if (status) {
        params.push(status);
        whereClause += ` AND o.status = $${params.length}`;
    }

    const dataQuery = `
        SELECT o.id, o.buyer_id, o.star_id, o.recipient_name, o.occasion,
               o.instructions, o.price, o.status, o.video_url, o.delivered_at,
               o.created_at, o.updated_at,
               s.name AS star_name, s.image_url AS star_image_url
        FROM orders o
        JOIN stars s ON s.id = o.star_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countQuery = `SELECT COUNT(*) FROM orders o ${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
        pool.query(dataQuery, [...params, limit, offset]),
        pool.query(countQuery, params),
    ]);
    const total = parseInt(countResult.rows[0].count);
    return { data: dataResult.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function listIncoming(uid, { status, page: pageRaw, limit: limitRaw }) {
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw) || 20));
    const offset = (page - 1) * limit;

    const params = [uid];
    let whereClause = 'WHERE s.owner_id = $1';
    if (status) {
        params.push(status);
        whereClause += ` AND o.status = $${params.length}`;
    }

    const dataQuery = `
        SELECT o.id, o.buyer_id, o.star_id, o.recipient_name, o.occasion,
               o.instructions, o.price, o.status, o.video_url, o.delivered_at,
               o.created_at, o.updated_at,
               s.name AS star_name,
               p.first_name AS buyer_first_name, p.last_name AS buyer_last_name
        FROM orders o
        JOIN stars s ON s.id = o.star_id
        JOIN profiles p ON p.id = o.buyer_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countQuery = `SELECT COUNT(*) FROM orders o JOIN stars s ON s.id = o.star_id ${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
        pool.query(dataQuery, [...params, limit, offset]),
        pool.query(countQuery, params),
    ]);
    const total = parseInt(countResult.rows[0].count);
    return { data: dataResult.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function creatorStats(uid) {
    const result = await pool.query(
        `SELECT
            COUNT(*)::int AS total_orders,
            COUNT(*) FILTER (WHERE o.status = 'pending')::int     AS pending,
            COUNT(*) FILTER (WHERE o.status = 'in_progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE o.status = 'completed')::int   AS completed,
            COALESCE(SUM(o.price) FILTER (WHERE o.status = 'completed'), 0)::int AS total_earnings
         FROM orders o
         JOIN stars s ON s.id = o.star_id
         WHERE s.owner_id = $1`,
        [uid],
    );
    return result.rows[0];
}

async function getOrder({ uid, role }, id) {
    const result = await pool.query(
        `SELECT o.id, o.buyer_id, o.star_id, o.recipient_name, o.occasion,
                o.instructions, o.price, o.status, o.video_url, o.delivered_at,
                o.created_at, o.updated_at,
                s.name AS star_name, s.image_url AS star_image_url, s.owner_id AS star_owner_id
         FROM orders o
         JOIN stars s ON s.id = o.star_id
         WHERE o.id = $1`,
        [id],
    );
    if (result.rows.length === 0) throw new OrderError(404, 'Not Found', 'Order not found');

    const order = result.rows[0];
    const isOwner = order.buyer_id === uid || order.star_owner_id === uid;
    const isAdmin = role === 'admin' || role === 'super_admin';
    if (!isOwner && !isAdmin) throw new OrderError(403, 'Forbidden', 'Not your order');
    return order;
}

async function updateStatus({ uid, role }, id, nextStatus) {
    const result = await pool.query(
        `SELECT o.id, o.buyer_id, o.status, s.owner_id AS star_owner_id
         FROM orders o JOIN stars s ON s.id = o.star_id
         WHERE o.id = $1`,
        [id],
    );
    if (result.rows.length === 0) throw new OrderError(404, 'Not Found', 'Order not found');

    const order = result.rows[0];
    const isBuyer = order.buyer_id === uid;
    const isStarOwner = order.star_owner_id === uid;
    const isSuperAdmin = role === 'super_admin';

    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(nextStatus) && !isSuperAdmin) {
        throw new OrderError(409, 'Invalid transition', `Cannot move order from "${order.status}" to "${nextStatus}"`);
    }

    const buyerActions = ['cancelled', 'completed'];
    const ownerActions = ['accepted', 'rejected', 'in_progress'];
    const permitted =
        isSuperAdmin ||
        (buyerActions.includes(nextStatus) && isBuyer) ||
        (ownerActions.includes(nextStatus) && isStarOwner);
    if (!permitted) throw new OrderError(403, 'Forbidden', 'Not allowed to perform this transition');

    const updated = await pool.query(
        `UPDATE orders SET status = $1 WHERE id = $2 RETURNING ${ORDER_COLUMNS}`,
        [nextStatus, id],
    );
    return updated.rows[0];
}

async function deliver({ uid, role }, id, video_url) {
    const result = await pool.query(
        `SELECT o.id, o.status, s.owner_id AS star_owner_id
         FROM orders o JOIN stars s ON s.id = o.star_id
         WHERE o.id = $1`,
        [id],
    );
    if (result.rows.length === 0) throw new OrderError(404, 'Not Found', 'Order not found');

    const order = result.rows[0];
    const isStarOwner = order.star_owner_id === uid;
    if (!isStarOwner && role !== 'super_admin') throw new OrderError(403, 'Forbidden', 'Not your star');
    if (order.status !== 'in_progress') {
        throw new OrderError(409, 'Invalid transition', `Can only deliver an order that is "in_progress" (current: "${order.status}")`);
    }

    const updated = await pool.query(
        `UPDATE orders
         SET video_url = $1, status = 'delivered', delivered_at = now()
         WHERE id = $2
         RETURNING ${ORDER_COLUMNS}`,
        [video_url, id],
    );
    return updated.rows[0];
}

module.exports = {
    OrderError, createOrder, listMyOrders, listIncoming, creatorStats, getOrder, updateStatus, deliver,
};
