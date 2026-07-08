'use strict';

const exploreService = require('./explore.service');

// GET /api/explore
async function listCreators(req, res, next) {
    try {
        res.json(await exploreService.listCreators(req.query));
    } catch (err) {
        next(err);
    }
}

// GET /api/explore/filters
async function getFilters(req, res, next) {
    try {
        res.json(await exploreService.getFilters());
    } catch (err) {
        next(err);
    }
}

module.exports = { listCreators, getFilters };
