'use strict';

/** Validation chains for the orders module — identical to pre-refactor routes/orders.js. */

const { body } = require('express-validator');

const createOrder = [
    body('star_id').isUUID().withMessage('Valid star_id required'),
    body('recipient_name').trim().notEmpty().withMessage('Recipient name is required').isLength({ max: 200 }),
    body('occasion').trim().notEmpty().withMessage('Occasion is required').isLength({ max: 200 }),
    body('instructions').optional().trim().isLength({ max: 2000 }),
];

const updateStatus = [
    body('status').isIn(['accepted', 'in_progress', 'rejected', 'cancelled', 'completed'])
        .withMessage('Invalid status'),
];

const deliver = [
    body('video_url').trim().notEmpty().isURL().withMessage('Valid video URL required').isLength({ max: 2048 }),
];

module.exports = { createOrder, updateStatus, deliver };
