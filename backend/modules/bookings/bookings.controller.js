'use strict';

/**
 * Bookings controllers — request/response only. All logic lives in the service.
 * Responses match the pre-refactor shapes exactly (no ApiResponse envelope).
 */

const bookingsService = require('./bookings.service');

// POST /api/bookings
async function createBooking(req, res, next) {
    try {
        const booking = await bookingsService.createBooking(req.user.uid, req.body);
        // Identical to the old handler: 201 + the created booking object.
        res.status(201).json(booking);
    } catch (err) {
        next(err);
    }
}

module.exports = { createBooking };
