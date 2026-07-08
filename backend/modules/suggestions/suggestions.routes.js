'use strict';

/**
 * Suggestions routes — endpoint definitions only. Mounted at /api/suggestions.
 *
 * Middleware chain identical to the pre-refactor file:
 *   POST / : publicFormLimiter → validators → validate → controller
 */

const express = require('express');
const router = express.Router();

const validate = require('../../middleware/validate');
const { publicFormLimiter } = require('../../middleware/rateLimiter');
const validator = require('./suggestions.validator');
const controller = require('./suggestions.controller');

// POST /api/suggestions — public submit
router.post('/', publicFormLimiter, validator.submitSuggestion, validate, controller.submitSuggestion);

module.exports = router;
