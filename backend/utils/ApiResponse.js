'use strict';

/**
 * ApiResponse — optional helper for NEW endpoints that want a consistent
 * success envelope.
 *
 * ⚠️ IMPORTANT: existing endpoints return their own bespoke shapes (e.g.
 * `{ ...booking }`, `{ data }`, `{ success: true }`). To preserve backward
 * compatibility, DO NOT retrofit this onto existing endpoints — doing so would
 * change response payloads. Use only for brand-new endpoints, opt-in.
 */
class ApiResponse {
    /** @param {number} statusCode @param {*} data @param {string} [message] */
    constructor(statusCode, data, message = 'OK') {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }

    /** Send via Express res, e.g. new ApiResponse(200, x).send(res) */
    send(res) {
        return res.status(this.statusCode).json({
            success: this.success,
            message: this.message,
            data: this.data,
        });
    }
}

module.exports = ApiResponse;
