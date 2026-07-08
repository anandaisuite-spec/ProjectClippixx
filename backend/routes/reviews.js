'use strict';

/**
 * Backward-compatibility shim — logic moved to modules/reviews/.
 * server.js's require('./routes/reviews') + /api/reviews mount stay unchanged.
 */

module.exports = require('../modules/reviews/reviews.routes');
