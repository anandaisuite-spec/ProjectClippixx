'use strict';

/**
 * Validation chains for the applications module.
 * Identical rules to the pre-refactor routes/applications.js — no contract change.
 */

const { body } = require('express-validator');

// POST /api/applications
const submitApplication = [
    body('full_name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ max: 200 }).withMessage('Full name must be under 200 characters'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email')
        .isLength({ max: 320 }).withMessage('Email must be under 320 characters')
        .normalizeEmail(),
    body('category')
        .trim()
        .notEmpty().withMessage('Category is required')
        .isIn(['Actor', 'Athlete', 'Creator', 'Musician']).withMessage('Category must be Actor, Athlete, Creator, or Musician'),
    body('social_links')
        .trim()
        .notEmpty().withMessage('Social links are required')
        .isLength({ max: 2048 }).withMessage('Social links must be under 2048 characters'),
    body('bio')
        .trim()
        .notEmpty().withMessage('Bio is required')
        .isLength({ max: 5000 }).withMessage('Bio must be under 5000 characters'),
    body('why_join')
        .trim()
        .notEmpty().withMessage('Reason to join is required')
        .isLength({ max: 5000 }).withMessage('Reason must be under 5000 characters'),
    body('followers_count')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Followers count must be under 50 characters'),
];

// PUT /api/applications/:id/status
const updateStatus = [
    body('status').isIn(['pending', 'reviewing', 'approved', 'rejected']).withMessage('Invalid status'),
];

module.exports = { submitApplication, updateStatus };
