'use strict';

/**
 * Booking-review controllers — request/response only.
 * Preserves the original 23505 unique-violation → 409 mapping at the
 * request/response boundary (identical behavior to routes/bookingReviews.js).
 */

const service = require('./bookingReviews.service');

// POST /api/booking-reviews
async function createReview(req, res, next) {
    try {
        const review = await service.createReview(req.user.uid, req.body);
        res.status(201).json(review);
    } catch (err) {
        if (err && err.code === '23505') { // unique_violation race on booking_id
            return res.status(409).json({ error: 'You have already reviewed this booking' });
        }
        next(err);
    }
}

// GET /api/booking-reviews/booking/:bookingId
async function getMyReview(req, res, next) {
    try {
        const review = await service.getMyReview(req.user.uid, req.params.bookingId);
        res.json({ review });
    } catch (err) {
        next(err);
    }
}

module.exports = { createReview, getMyReview };
