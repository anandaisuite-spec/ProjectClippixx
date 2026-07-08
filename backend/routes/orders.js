'use strict';

/**
 * Backward-compatibility shim — logic moved to modules/orders/.
 * server.js's require('./routes/orders') + /api/orders mount stay unchanged.
 */

module.exports = require('../modules/orders/orders.routes');
