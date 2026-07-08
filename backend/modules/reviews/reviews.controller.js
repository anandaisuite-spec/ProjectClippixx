'use strict';

/**
 * Reviews controllers — request/response only.
 * Maps ReviewError → the exact two-field { error, message } JSON the original
 * inline handlers produced. Unexpected errors fall through to next(err).
 */

const service = require('./reviews.service');
const { ReviewError } = service;

function handle(err, res, next) {
    if (err instanceof ReviewError) {
        return res.status(err.status).json({ error: err.category, message: err.clientMessage });
    }
    return next(err);
}

// POST /api/reviews
async function createReview(req, res, next) {
    try {
        const { order_id, rating, comment } = req.body;
        const data = await service.createReview(req.user.uid, { order_id, rating, comment });
        res.status(201).json({ message: 'Review submitted', data });
    } catch (err) { handle(err, res, next); }
}

// GET /api/reviews/star/:starId
async function getStarReviews(req, res, next) {
    try {
        const result = await service.getStarReviews(req.params.starId, req.query.page, req.query.limit);
        res.json(result);
    } catch (err) { handle(err, res, next); }
}

// GET /api/reviews/my
async function getMyReviews(req, res, next) {
    try {
        const data = await service.getMyReviews(req.user.uid);
        res.json({ data });
    } catch (err) { handle(err, res, next); }
}

// PUT /api/reviews/:id
async function updateReview(req, res, next) {
    try {
        const { rating, comment } = req.body;
        const data = await service.updateReview(req.user.uid, req.params.id, { rating, comment });
        res.json({ message: 'Review updated', data });
    } catch (err) { handle(err, res, next); }
}

// DELETE /api/reviews/:id
async function deleteReview(req, res, next) {
    try {
        await service.deleteReview({ uid: req.user.uid, role: req.user.role }, req.params.id);
        res.json({ message: 'Review deleted' });
    } catch (err) { handle(err, res, next); }
}

// PATCH /api/reviews/:id/visibility
async function setVisibility(req, res, next) {
    try {
        const data = await service.setVisibility(req.params.id, req.body.is_visible);
        res.json({ message: 'Review visibility updated', data });
    } catch (err) { handle(err, res, next); }
}

module.exports = { createReview, getStarReviews, getMyReviews, updateReview, deleteReview, setVisibility };
