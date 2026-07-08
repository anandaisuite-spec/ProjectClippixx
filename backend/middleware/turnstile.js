'use strict';

/**
 * Cloudflare Turnstile verification middleware.
 *
 * Place on human-facing entry routes (signup start, login OTP send) BEFORE any
 * Firebase/OTP/DB work happens. The frontend renders the Turnstile widget and
 * sends the resulting token; we verify it server-side against Cloudflare.
 *
 * The client must send the token as `turnstileToken` in the JSON body.
 *
 * If TURNSTILE_SECRET_KEY is not configured, verification is skipped (with a
 * warning) so local/dev environments without Turnstile still work.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(req, res, next) {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    // No secret configured → skip (dev/local). Warn once so it's not silent in prod.
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — CAPTCHA verification is DISABLED in production.');
        }
        return next();
    }

    const token = req.body && req.body.turnstileToken;
    if (!token || typeof token !== 'string') {
        return res.status(400).json({
            error: 'captcha_required',
            message: 'Please complete the CAPTCHA challenge.',
        });
    }

    // Client IP — trust proxy is configured on the app, so req.ip is the real client.
    const remoteip =
        (req.headers['cf-connecting-ip']) ||
        req.ip ||
        (req.connection && req.connection.remoteAddress);

    try {
        const form = new URLSearchParams();
        form.append('secret', secret);
        form.append('response', token);
        if (remoteip) form.append('remoteip', remoteip);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        let data;
        try {
            const resp = await fetch(VERIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form,
                signal: controller.signal,
            });
            data = await resp.json();
        } finally {
            clearTimeout(timeout);
        }

        if (!data || data.success !== true) {
            const codes = (data && data['error-codes']) || [];
            console.warn('[turnstile] verification failed:', codes.join(', ') || 'unknown');
            return res.status(403).json({
                error: 'captcha_failed',
                message: 'CAPTCHA verification failed. Please try again.',
            });
        }

        return next();
    } catch (err) {
        console.error('[turnstile] verification error:', err.message);
        // Fail closed — do not let unverified traffic through on infra errors.
        return res.status(503).json({
            error: 'captcha_unavailable',
            message: 'Could not verify the CAPTCHA right now. Please try again.',
        });
    }
}

module.exports = { verifyTurnstile };
