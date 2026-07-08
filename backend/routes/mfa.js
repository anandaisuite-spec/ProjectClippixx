'use strict';

/**
 * Backward-compatibility shim — MFA logic moved to modules/security/.
 * server.js's require('./routes/mfa') + /api/mfa mount stay unchanged.
 * mfaService remains in services/ (unchanged).
 */

module.exports = require('../modules/security/security.routes');
