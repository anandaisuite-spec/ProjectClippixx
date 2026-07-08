'use strict';

/**
 * Feedback controllers — request/response only. Logic lives in the service.
 * Response shapes match the pre-refactor handlers exactly (no ApiResponse).
 */

const feedbackService = require('./feedback.service');

// POST /api/feedback
async function submitFeedback(req, res, next) {
    try {
        const { type, subject, message, email } = req.body;
        const data = await feedbackService.submitFeedback({ type, subject, message, email });
        res.status(201).json({
            message: 'Feedback submitted successfully!',
            data,
        });
    } catch (error) {
        next(error);
    }
}

// GET /api/feedback
async function listFeedback(req, res, next) {
    try {
        const result = await feedbackService.listFeedback({
            typeFilter: req.query.type,
            page: req.query.page,
            limit: req.query.limit,
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = { submitFeedback, listFeedback };
