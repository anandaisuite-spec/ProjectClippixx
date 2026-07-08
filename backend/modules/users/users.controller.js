'use strict';

/**
 * Users controller — request/response only. Logic lives in the service.
 * Response shape matches the pre-refactor handler exactly (no ApiResponse).
 */

const usersService = require('./users.service');

// GET /api/users
async function listCreators(req, res, next) {
    try {
        const { search, sort, order, page, limit } = req.query;
        const result = await usersService.listCreators({ search, sort, order, page, limit });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = { listCreators };
