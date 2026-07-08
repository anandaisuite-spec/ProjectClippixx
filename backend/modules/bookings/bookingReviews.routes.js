'use strict';

/**
 * Booking-review routes. Mounted at /api/booking-reviews.
 * Chains identical to the pre-refactor file:
 *   POST /                        : verifyToken → validators → validate → controller
 *   GET  /booking/:bookingId      : verifyToken → controller
 */

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { createReview } = require('./bookingReviews.validator');
const controller = require('./bookingReviews.controller');

router.post('/', verifyToken, createReview, validate, controller.createReview);
router.get('/booking/:bookingId', verifyToken, controller.getMyReview);

module.exports = router;
