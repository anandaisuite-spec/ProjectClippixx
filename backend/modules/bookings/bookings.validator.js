'use strict';

/**
 * Validation chains for the bookings module.
 * Identical rules to the pre-refactor routes/bookings.js — no contract change.
 */

const { body } = require('express-validator');

const OCCASIONS = ['Birthday', 'Anniversary', 'Motivation', 'Other'];

// POST /api/bookings
const createBooking = [
    body('creator_id').isUUID().withMessage('Valid creator_id required'),
    body('tier_id').isUUID().withMessage('Valid tier_id required'),
    body('fan_name').trim().notEmpty().withMessage('Your name is required').isLength({ max: 255 }),
    body('video_for').isIn(['myself', 'someone_else']).withMessage('Invalid recipient choice'),
    body('occasion').optional({ values: 'falsy' }).isIn(OCCASIONS).withMessage('Invalid occasion'),
    body('instructions').optional({ nullable: true }).isLength({ max: 500 }).withMessage('Instructions max 500 chars'),
    body('is_gift').optional().isBoolean().withMessage('is_gift must be a boolean').toBoolean(),
    body('gift_recipient_name').optional({ values: 'falsy' }).isLength({ max: 255 }),
    body('gift_recipient_email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid recipient email').isLength({ max: 320 }),
];

module.exports = { createBooking, OCCASIONS };
