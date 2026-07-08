'use strict';

/**
 * Validation chain for the suggestions module.
 * Identical rules to the pre-refactor routes/suggestions.js — no contract change.
 */

const { body } = require('express-validator');

// POST /api/suggestions
const submitSuggestion = [
    body('celebrity_name')
        .trim()
        .notEmpty().withMessage('Celebrity name is required')
        .isLength({ max: 200 }).withMessage('Celebrity name must be under 200 characters'),
    body('category')
        .trim()
        .notEmpty().withMessage('Category is required')
        .isIn(['Actor', 'Athlete', 'Creator', 'Musician', 'Comedian', 'Reality TV', 'Other'])
        .withMessage('Invalid category'),
    body('submitter_email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email')
        .isLength({ max: 320 }).withMessage('Email must be under 320 characters')
        .normalizeEmail(),
    body('social_links')
        .optional()
        .trim()
        .isLength({ max: 2048 }).withMessage('Social links must be under 2048 characters'),
    body('reason')
        .optional()
        .trim()
        .isLength({ max: 2000 }).withMessage('Reason must be under 2000 characters'),
];

module.exports = { submitSuggestion };
