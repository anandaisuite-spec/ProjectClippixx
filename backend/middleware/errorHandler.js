/**
 * Centralized error handler middleware.
 * Must be registered LAST (after all routes).
 */
function errorHandler(err, req, res, next) {
    const timestamp = new Date().toISOString();

    console.error(JSON.stringify({
        level: 'error',
        timestamp,
        method: req.method,
        path: req.path,
        error: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    }));

    const status = err.statusCode || 500;
    res.status(status).json({
        error: status === 500 ? 'Internal Server Error' : err.message,
        // ApiError may carry extra client-safe fields (opt-in; existing errors
        // pass nothing here, so current response shapes are unchanged).
        ...(err.extra && status !== 500 ? err.extra : {}),
        ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
    });
}

module.exports = errorHandler;
