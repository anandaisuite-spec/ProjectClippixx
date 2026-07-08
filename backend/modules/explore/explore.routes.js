'use strict';

/**
 * Explore routes — public, no auth/validators. Mounted at /api/explore.
 * Declaration order preserved from the pre-refactor file.
 */

const express = require('express');
const router = express.Router();
const controller = require('./explore.controller');

// GET /api/explore
router.get('/', controller.listCreators);

// GET /api/explore/filters
router.get('/filters', controller.getFilters);

module.exports = router;
