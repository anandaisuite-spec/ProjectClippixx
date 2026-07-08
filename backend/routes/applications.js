'use strict';

/**
 * Backward-compatibility shim.
 *
 * Applications logic moved to modules/applications/ (route → controller →
 * service → validator). Kept so server.js's existing
 * `require('./routes/applications')` and `app.use('/api/applications', ...)`
 * mount stay completely unchanged.
 */

module.exports = require('../modules/applications/applications.routes');
