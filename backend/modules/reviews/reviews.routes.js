'use strict';

/**
 * Reviews routes (legacy order-based). Mounted at /api/reviews.
 * Chains + declaration order identical to the pre-refactor file.
 */

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');
const validate = require('../../middleware/validate');
const v = require('./reviews.validator');
const c = require('./reviews.controller');

router.post('/', verifyToken, requireRole(['user']), v.createReview, validate, c.createReview);
router.get('/star/:starId', c.getStarReviews);
router.get('/my', verifyToken, requireRole(['user']), c.getMyReviews);
router.put('/:id', verifyToken, requireRole(['user']), v.updateReview, validate, c.updateReview);
router.delete('/:id', verifyToken, requireRole(['user', 'admin']), c.deleteReview);
router.patch('/:id/visibility', verifyToken, requireRole(['admin']), v.setVisibility, validate, c.setVisibility);

module.exports = router;
