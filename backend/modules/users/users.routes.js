'use strict';

/**
 * Users routes — endpoint definitions only. Mounted at /api/users.
 *
 * Public endpoint (no auth, no validator middleware) — identical to the
 * pre-refactor file: GET / → controller.
 */

const express = require('express');
const router = express.Router();

const controller = require('./users.controller');

// GET /api/users — public, paginated list of creator profiles
router.get('/', controller.listCreators);

module.exports = router;
