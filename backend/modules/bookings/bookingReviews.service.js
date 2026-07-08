'use strict';

/**
 * Booking-review business logic + data access.
 * Behavior identical to pre-refactor routes/bookingReviews.js. Errors raised as
 * ApiError(status, message) render as { error: message } via errorHandler.
 *
 * The 23505 unique-violation race is re-thrown as-is so the controller can map
 * it to the same 409 the original inline handler produced.
 */

const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');

async function createReview(uid, { booking_id, rating, review_text }) {
    // Fan-only (account_type != 'creator').
    const prof = await pool.query('SELECT account_type FROM profiles WHERE id = $1', [uid]);
    if (prof.rows.length === 0) throw new ApiError(404, 'Profile not found');
    if (prof.rows[0].account_type === 'creator') throw new ApiError(403, 'Only fans can leave reviews');

    const bk = await pool.query(
        'SELECT id, creator_id, fan_id, status FROM bookings WHERE id = $1',
        [booking_id],
    );
    if (bk.rows.length === 0) throw new ApiError(404, 'Booking not found');
    const booking = bk.rows[0];
    if (booking.fan_id !== uid) throw new ApiError(403, 'Not your booking');
    if (booking.status !== 'delivered') throw new ApiError(409, 'You can only review a delivered booking');

    const dupe = await pool.query('SELECT 1 FROM booking_reviews WHERE booking_id = $1', [booking_id]);
    if (dupe.rows.length > 0) throw new ApiError(409, 'You have already reviewed this booking');

    const inserted = await pool.query(
        `INSERT INTO booking_reviews (booking_id, creator_id, fan_id, rating, review_text)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, booking_id, rating, review_text, created_at`,
        [booking_id, booking.creator_id, uid, rating, review_text || null],
    );
    return inserted.rows[0];
}

/** Returns the caller's own review for a booking, or null (never another user's). */
async function getMyReview(uid, bookingId) {
    const r = await pool.query(
        'SELECT id, booking_id, rating, review_text, created_at, fan_id FROM booking_reviews WHERE booking_id = $1',
        [bookingId],
    );
    if (r.rows.length === 0) return null;
    const review = r.rows[0];
    if (review.fan_id !== uid) return null;
    delete review.fan_id;
    return review;
}

module.exports = { createReview, getMyReview };
