'use strict';

/**
 * Validation chains for the feedback module.
 * Identical rules to the pre-refactor routes/feedback.js — no contract change.
 */

const { body } = require('express-validator');

// POST /api/feedback
const submitFeedback = [
    body('type')
        .trim()
        .notEmpty().withMessage('Feedback type is required')
        .isIn(['Bug Report', 'Feature Request', 'General Feedback', 'Other']).withMessage('Invalid feedback type'),
    body('subject')
        .trim()
        .notEmpty().withMessage('Subject is required')
        .isLength({ max: 300 }).withMessage('Subject must be under 300 characters'),
    body('message')
        .trim()
        .notEmpty().withMessage('Message is required')
        .isLength({ max: 10000 }).withMessage('Message must be under 10000 characters'),
    body('email')
        .optional({ values: 'falsy' })
        .trim()
        .isEmail().withMessage('Must be a valid email')
        .isLength({ max: 320 }).withMessage('Email must be under 320 characters')
        .normalizeEmail(),
];

module.exports = { submitFeedback };
