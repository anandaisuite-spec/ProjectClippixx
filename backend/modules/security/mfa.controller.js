'use strict';

/**
 * MFA controllers — request/response only. Business logic stays in the existing
 * services/mfaService.js (unchanged, left in place). Audit logging continues to
 * use the shared services/auditService. Status codes, response shapes, and the
 * reason→message/status mappings are identical to the pre-refactor routes/mfa.js.
 */

const mfaService = require('../../services/mfaService');
const { writeAuditLog } = require('../../services/auditService');

// GET /api/mfa/status
async function status(req, res, next) {
    try {
        const data = await mfaService.getStatus(req.user.uid);
        res.json({ data });
    } catch (error) {
        next(error);
    }
}

// POST /api/mfa/setup
async function setup(req, res, next) {
    try {
        if (await mfaService.isEnabled(req.user.uid)) {
            return res.status(409).json({
                error: 'Already enabled',
                message: 'MFA is already enabled. Disable it first to re-enroll.',
            });
        }
        const label = req.user.email || req.user.uid;
        const { otpauth, qrDataUrl, secret } = await mfaService.beginSetup(req.user.uid, label);
        res.json({ data: { otpauth, qrDataUrl, secret } });
    } catch (error) {
        next(error);
    }
}

// POST /api/mfa/enable
async function enable(req, res, next) {
    try {
        const result = await mfaService.enable(req.user.uid, req.body.token);
        if (!result.ok) {
            const map = {
                no_setup: ['Run /api/mfa/setup first', 400],
                already_enabled: ['MFA already enabled', 409],
                invalid_token: ['Invalid verification code', 401],
            };
            const [message, code] = map[result.reason] || ['Could not enable MFA', 400];
            return res.status(code).json({ error: 'MFA enable failed', message });
        }

        writeAuditLog({
            actorId: req.user.uid,
            actorEmail: req.user.email,
            action: 'mfa_enabled',
            targetId: req.user.uid,
            targetEmail: req.user.email,
        });

        res.json({ message: 'MFA enabled successfully', data: { backupCodes: result.backupCodes } });
    } catch (error) {
        next(error);
    }
}

// POST /api/mfa/verify
async function verify(req, res, next) {
    try {
        const result = await mfaService.verifyForUser(req.user.uid, req.body.token);
        if (!result.ok) {
            return res.status(401).json({ error: 'Invalid token', message: 'Verification failed' });
        }
        res.json({ message: 'Verified', data: { method: result.method, backupCodesRemaining: result.remaining } });
    } catch (error) {
        next(error);
    }
}

// POST /api/mfa/backup-codes/regenerate
async function regenerateBackupCodes(req, res, next) {
    try {
        const check = await mfaService.verifyForUser(req.user.uid, req.body.token);
        if (!check.ok) {
            return res.status(401).json({ error: 'Invalid token', message: 'A valid MFA token is required' });
        }
        const codes = await mfaService.regenerateBackupCodes(req.user.uid);

        writeAuditLog({
            actorId: req.user.uid,
            actorEmail: req.user.email,
            action: 'mfa_backup_regenerated',
            targetId: req.user.uid,
            targetEmail: req.user.email,
        });

        res.json({ message: 'Backup codes regenerated', data: { backupCodes: codes } });
    } catch (error) {
        next(error);
    }
}

// POST /api/mfa/disable
async function disable(req, res, next) {
    try {
        const check = await mfaService.verifyForUser(req.user.uid, req.body.token);
        if (!check.ok) {
            return res.status(401).json({ error: 'Invalid token', message: 'A valid MFA token is required to disable MFA' });
        }
        await mfaService.disable(req.user.uid);

        writeAuditLog({
            actorId: req.user.uid,
            actorEmail: req.user.email,
            action: 'mfa_disabled',
            targetId: req.user.uid,
            targetEmail: req.user.email,
        });

        res.json({ message: 'MFA disabled' });
    } catch (error) {
        next(error);
    }
}

module.exports = { status, setup, enable, verify, regenerateBackupCodes, disable };
