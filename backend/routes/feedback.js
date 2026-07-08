'use strict';

/**
 * Backward-compatibility shim.
 *
 * Feedback logic moved to modules/feedback/ (route → controller → service →
 * validator). This file is kept so server.js's existing
 * `require('./routes/feedback')` and `app.use('/api/feedback', ...)` mount stay
 * completely unchanged — URL, mount order, and middleware chain preserved.
 */

module.exports = require('../modules/feedback/feedback.routes');
