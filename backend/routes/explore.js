'use strict';

/**
 * Backward-compatibility shim — logic moved to modules/explore/.
 * server.js's require('./routes/explore') + /api/explore mount stay unchanged.
 */

module.exports = require('../modules/explore/explore.routes');
