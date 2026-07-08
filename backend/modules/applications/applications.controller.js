'use strict';

/**
 * Applications controllers — request/response only. Logic lives in the service.
 * Response shapes match the pre-refactor handlers exactly (no ApiResponse).
 */

const applicationsService = require('./applications.service');

// POST /api/applications
async function submitApplication(req, res, next) {
    try {
        const { full_name, email, category, social_links, followers_count, bio, why_join } = req.body;
        const data = await applicationsService.submitApplication({
            full_name, email, category, social_links, followers_count, bio, why_join,
        });
        res.status(201).json({
            message: 'Creator application submitted successfully!',
            data,
        });
    } catch (error) {
        next(error);
    }
}

// GET /api/applications
async function listApplications(req, res, next) {
    try {
        const result = await applicationsService.listApplications({
            statusFilter: req.query.status,
            page: req.query.page,
            limit: req.query.limit,
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
}

// PUT /api/applications/:id/status
async function updateStatus(req, res, next) {
    try {
        const data = await applicationsService.updateStatus(
            req.params.id,
            req.body.status,
            { uid: req.user.uid, email: req.user.email },
        );
        res.json({ message: 'Application status updated', data });
    } catch (error) {
        next(error);
    }
}

module.exports = { submitApplication, listApplications, updateStatus };
