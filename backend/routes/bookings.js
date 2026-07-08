'use strict';

/**
 * Backward-compatibility shim.
 *
 * The bookings logic moved to modules/bookings/ (route → controller → service →
 * validator) during the architecture refactor. This file is kept so that
 * server.js's existing `require('./routes/bookings')` and its
 * `app.use('/api/bookings', ...)` mount remain completely unchanged — the URL,
 * mount order, and middleware chain are preserved exactly.
 */

module.exports = require('../modules/bookings/bookings.routes');
