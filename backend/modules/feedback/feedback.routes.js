'use strict';

/**
 * Feedback routes — endpoint definitions only. Mounted at /api/feedback.
 *
 * Middleware chains are identical to the pre-refactor file:
 *   POST /  : publicFormLimiter → validators → validate → controller
 *   GET  /  : verifyToken → requireRole(['admin','super_admin']) → controller
 */

const express = require('express');
const router = express.Router();

const validate = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');
const { publicFormLimiter } = require('../../middleware/rateLimiter');
const validator = require('./feedback.validator');
const controller = require('./feedback.controller');

// POST /api/feedback — public submit
router.post('/', publicFormLimiter, validator.submitFeedback, validate, controller.submitFeedback);

// GET /api/feedback — admin list
router.get('/', verifyToken, requireRole(['admin', 'super_admin']), controller.listFeedback);

module.exports = router;
