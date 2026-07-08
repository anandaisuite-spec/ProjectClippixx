'use strict';

/** Validation for booking reviews — identical to pre-refactor routes/bookingReviews.js. */

const { body } = require('express-validator');

// POST /api/booking-reviews
const createReview = [
    body('booking_id').isUUID().withMessage('Valid booking_id required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5'),
    body('review_text').optional({ nullable: true }).isLength({ max: 1000 }).withMessage('Review text max 1000 chars'),
];

module.exports = { createReview };
