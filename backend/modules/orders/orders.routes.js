'use strict';

/**
 * Orders routes. Mounted at /api/orders.
 * Declaration order preserved EXACTLY (so /incoming, /stats/creator are matched
 * before the /:id param route). Chains identical to the pre-refactor file.
 */

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/role');
const validate = require('../../middleware/validate');
const v = require('./orders.validator');
const c = require('./orders.controller');

router.post('/', verifyToken, requireRole(['user']), v.createOrder, validate, c.createOrder);
router.get('/', verifyToken, requireRole(['user']), c.listMyOrders);
router.get('/incoming', verifyToken, requireRole(['user', 'admin']), c.listIncoming);
router.get('/stats/creator', verifyToken, requireRole(['user', 'admin']), c.creatorStats);
router.get('/:id', verifyToken, requireRole(['user', 'admin']), c.getOrder);
router.patch('/:id/status', verifyToken, requireRole(['user', 'admin']), v.updateStatus, validate, c.updateStatus);
router.patch('/:id/deliver', verifyToken, requireRole(['user', 'admin']), v.deliver, validate, c.deliver);

module.exports = router;
