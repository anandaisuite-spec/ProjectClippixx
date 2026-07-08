'use strict';

/**
 * Backward-compatibility shim — logic moved to modules/bookings/bookingReviews.*.
 * server.js's require('./routes/bookingReviews') + /api/booking-reviews mount
 * stay unchanged.
 */

module.exports = require('../modules/bookings/bookingReviews.routes');
