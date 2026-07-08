'use strict';

/**
 * Orders controllers — request/response only.
 * Maps OrderError → the exact { error, message } JSON the originals produced.
 */

const service = require('./orders.service');
const { OrderError } = service;

function handle(err, res, next) {
    if (err instanceof OrderError) {
        return res.status(err.status).json({ error: err.category, message: err.clientMessage });
    }
    return next(err);
}

// POST /api/orders
async function createOrder(req, res, next) {
    try {
        const { star_id, recipient_name, occasion, instructions } = req.body;
        const data = await service.createOrder(req.user.uid, { star_id, recipient_name, occasion, instructions });
        res.status(201).json({ message: 'Order created successfully', data });
    } catch (err) { handle(err, res, next); }
}

// GET /api/orders
async function listMyOrders(req, res, next) {
    try {
        res.json(await service.listMyOrders(req.user.uid, req.query));
    } catch (err) { handle(err, res, next); }
}

// GET /api/orders/incoming
async function listIncoming(req, res, next) {
    try {
        res.json(await service.listIncoming(req.user.uid, req.query));
    } catch (err) { handle(err, res, next); }
}

// GET /api/orders/stats/creator
async function creatorStats(req, res, next) {
    try {
        res.json({ data: await service.creatorStats(req.user.uid) });
    } catch (err) { handle(err, res, next); }
}

// GET /api/orders/:id
async function getOrder(req, res, next) {
    try {
        const data = await service.getOrder({ uid: req.user.uid, role: req.user.role }, req.params.id);
        res.json({ data });
    } catch (err) { handle(err, res, next); }
}

// PATCH /api/orders/:id/status
async function updateStatus(req, res, next) {
    try {
        const data = await service.updateStatus({ uid: req.user.uid, role: req.user.role }, req.params.id, req.body.status);
        res.json({ message: 'Order status updated', data });
    } catch (err) { handle(err, res, next); }
}

// PATCH /api/orders/:id/deliver
async function deliver(req, res, next) {
    try {
        const data = await service.deliver({ uid: req.user.uid, role: req.user.role }, req.params.id, req.body.video_url);
        res.json({ message: 'Video delivered', data });
    } catch (err) { handle(err, res, next); }
}

module.exports = { createOrder, listMyOrders, listIncoming, creatorStats, getOrder, updateStatus, deliver };
