'use strict';

/** Validation chains for MFA routes — identical to pre-refactor routes/mfa.js. */

const { body } = require('express-validator');

// token-required body (enable / verify / regenerate / disable)
const tokenRequired = [
    body('token').trim().notEmpty().withMessage('Token is required'),
];

module.exports = { tokenRequired };
