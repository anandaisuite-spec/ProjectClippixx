'use strict';

/** Validation chains for the (legacy, order-based) reviews module. Unchanged rules. */

const { body } = require('express-validator');

const createReview = [
    body('order_id').isUUID().withMessage('Valid order_id required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('comment').optional().trim().isLength({ max: 2000 }),
];

const updateReview = [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('comment').optional().trim().isLength({ max: 2000 }),
];

const setVisibility = [
    body('is_visible').isBoolean().withMessage('is_visible must be a boolean'),
];

module.exports = { createReview, updateReview, setVisibility };
