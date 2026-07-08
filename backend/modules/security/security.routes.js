'use strict';

/**
 * Security module routes — currently the MFA endpoints. Mounted at /api/mfa.
 *
 * Identical to the pre-refactor routes/mfa.js:
 *   router.use(verifyToken) applies to ALL routes; token-bearing routes add the
 *   token validator + validate. Status/status-mapping handled in the controller.
 */

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { tokenRequired } = require('./mfa.validator');
const mfa = require('./mfa.controller');

// All MFA routes require an authenticated Firebase user (router-level, as before).
router.use(verifyToken);

router.get('/status', mfa.status);
router.post('/setup', mfa.setup);
router.post('/enable', tokenRequired, validate, mfa.enable);
router.post('/verify', tokenRequired, validate, mfa.verify);
router.post('/backup-codes/regenerate', tokenRequired, validate, mfa.regenerateBackupCodes);
router.post('/disable', tokenRequired, validate, mfa.disable);

module.exports = router;
