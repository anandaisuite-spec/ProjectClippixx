const { validationResult } = require('express-validator');

/**
 * Middleware that checks express-validator results.
 * Place after validation chain arrays in route definitions.
 */
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            error: 'Validation failed',
            details: errors.array().map((e) => ({
                field: e.path,
                message: e.msg,
            })),
        });
    }
    next();
}

module.exports = validate;
