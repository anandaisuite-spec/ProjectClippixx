const mfaService = require('../services/mfaService');

/**
 * Step-up auth for sensitive actions. Must run AFTER verifyToken.
 *
 * If the user has MFA enabled, the request must include a valid second factor
 * via the `x-mfa-token` header (TOTP code or backup code). If MFA is NOT
 * enabled for the user, the request passes through (MFA is opt-in).
 *
 * Use on destructive/sensitive routes, e.g. account deletion, role changes.
 */
const requireMfa = async (req, res, next) => {
    try {
        const uid = req.user?.uid;
        if (!uid) {
            return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        }

        const enabled = await mfaService.isEnabled(uid);
        if (!enabled) return next(); // opt-in: nothing to enforce

        const token = req.headers['x-mfa-token'] || req.body?.mfa_token;
        if (!token) {
            return res.status(401).json({
                error: 'MFA required',
                code: 'MFA_REQUIRED',
                message: 'This action requires a second factor. Provide an x-mfa-token header.',
            });
        }

        const result = await mfaService.verifyForUser(uid, token);
        if (!result.ok) {
            return res.status(401).json({
                error: 'Invalid MFA token',
                code: 'MFA_INVALID',
                message: 'The provided MFA token or backup code is invalid.',
            });
        }

        req.mfaVerified = true;
        next();
    } catch (error) {
        console.error('MFA verification failed:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to verify MFA' });
    }
};

module.exports = { requireMfa };
