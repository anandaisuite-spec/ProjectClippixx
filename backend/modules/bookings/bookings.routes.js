'use strict';

/**
 * Bookings routes — endpoint definitions only.
 *
 * Mounted at /api/bookings (unchanged). The middleware chain is identical to
 * the pre-refactor file: verifyToken → validation chain → validate → controller.
 */

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const validator = require('./bookings.validator');
const controller = require('./bookings.controller');

// POST /api/bookings
router.post('/', verifyToken, validator.createBooking, validate, controller.createBooking);

module.exports = router;
