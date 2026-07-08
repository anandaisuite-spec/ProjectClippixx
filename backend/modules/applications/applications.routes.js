'use strict';

/**
 * Applications routes — endpoint definitions only. Mounted at /api/applications.
 *
 * Middleware chains identical to the pre-refactor file:
 *   POST /            : publicFormLimiter → validators → validate → controller
 *   GET  /            : verifyToken → requireRole(['admin','super_admin']) → controller
 *   PUT  /:id/status  : verifyToken → requireRole(['admin','super_admin']) → validator → validate → controller
 */

const express = require('express');
const router = express.Router();

const validate = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');
const { publicFormLimiter } = require('../../middleware/rateLimiter');
const validator = require('./applications.validator');
const controller = require('./applications.controller');

// POST /api/applications — public submit
router.post('/', publicFormLimiter, validator.submitApplication, validate, controller.submitApplication);

// GET /api/applications — admin list
router.get('/', verifyToken, requireRole(['admin', 'super_admin']), controller.listApplications);

// PUT /api/applications/:id/status — admin status update (+ audit log)
router.put(
    '/:id/status',
    verifyToken,
    requireRole(['admin', 'super_admin']),
    validator.updateStatus,
    validate,
    controller.updateStatus,
);

module.exports = router;
