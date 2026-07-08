'use strict';

/**
 * Backward-compatibility shim.
 *
 * Users logic moved to modules/users/ (route → controller → service). Kept so
 * server.js's existing `require('./routes/users')` and
 * `app.use('/api/users', ...)` mount stay completely unchanged.
 */

module.exports = require('../modules/users/users.routes');
