'use strict';

/**
 * Backward-compatibility shim.
 *
 * Suggestions logic moved to modules/suggestions/ (route → controller → service
 * → validator). Kept so server.js's existing `require('./routes/suggestions')`
 * and `app.use('/api/suggestions', ...)` mount stay completely unchanged.
 */

module.exports = require('../modules/suggestions/suggestions.routes');
