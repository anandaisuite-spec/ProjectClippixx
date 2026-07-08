'use strict';

/**
 * ApiError — a typed error carrying an HTTP status + client-safe message.
 *
 * Lets services throw `new ApiError(404, 'Not found')` instead of doing
 * res.status().json() directly, so controllers stay thin. The shape a client
 * sees is decided by the controller/error handler, NOT here — this class does
 * not impose a response format, so existing `{ error: '...' }` contracts are
 * preserved exactly.
 */
class ApiError extends Error {
    /**
     * @param {number} statusCode  HTTP status (e.g. 404, 409, 422)
     * @param {string} message     client-safe message
     * @param {object} [extra]     optional extra fields to merge into the body
     */
    constructor(statusCode, message, extra = undefined) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.expose = true; // marks this as a known, client-safe error
        if (extra && typeof extra === 'object') this.extra = extra;
        Error.captureStackTrace?.(this, ApiError);
    }
}

module.exports = ApiError;
