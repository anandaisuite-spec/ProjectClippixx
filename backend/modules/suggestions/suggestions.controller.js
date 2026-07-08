'use strict';

/**
 * Suggestions controller — request/response only.
 * Response shape matches the pre-refactor handler exactly (no ApiResponse).
 */

const suggestionsService = require('./suggestions.service');

// POST /api/suggestions
async function submitSuggestion(req, res, next) {
    try {
        const { celebrity_name, category, social_links, reason, submitter_email } = req.body;
        const data = await suggestionsService.submitSuggestion({
            celebrity_name, category, social_links, reason, submitter_email,
        });
        res.status(201).json({
            message: 'Star suggestion submitted successfully!',
            data,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = { submitSuggestion };
