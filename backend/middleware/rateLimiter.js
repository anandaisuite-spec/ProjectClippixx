const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// ─── Shared limiter factory ───────────────────────────────────────────────────

function make(windowMs, max, message) {
    return rateLimit({
        windowMs,
        max: isDev ? Math.max(max * 20, 200) : max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'rate_limited', message },
    });
}

// ─── General / Admin ──────────────────────────────────────────────────────────

/** Public form submissions: 5 per 15 min */
const publicFormLimiter = make(
    15 * 60 * 1000, 5,
    'Too many submissions. Please try again later.'
);

/**
 * General API: 600 per 15 min (~40/min per IP).
 * This is an SPA — a single page view fires several API calls (the creator
 * dashboard alone makes ~7 on mount), so 100/15min throttled normal browsing.
 * Abuse-sensitive endpoints are NOT covered by this number: login/signup/OTP
 * have their own strict limiters below.
 */
const generalLimiter = make(
    15 * 60 * 1000, 600,
    'Rate limit exceeded. Please try again later.'
);

/** Admin panel: 300 per 15 min (dashboard lists/tabs refetch frequently). */
const adminLimiter = make(
    15 * 60 * 1000, 300,
    'Admin rate limit exceeded. Please slow down.'
);

// ─── Auth-entry limiters (security hardening pass) ────────────────────────────
// IMPORTANT scoping rule: each of these is applied to ONLY its specific route,
// never to a whole route prefix. (The earlier bug leaked an auth limiter onto
// /api/applications and /api/feedback — don't repeat that.)

/**
 * Login attempts: 3 per 15 min per IP.
 * Applied to the login entry route (POST /send-otp — this app's login is OTP-based;
 * there is no separate backend password-login endpoint, password auth runs
 * client-side via Firebase).
 */
const loginLimiter = make(
    15 * 60 * 1000, 3,
    'Too many login attempts. Try again in 15 minutes.'
);

/**
 * Account registration: 1 per hour per IP.
 * Applied to POST /signup/start specifically.
 */
const registerLimiter = make(
    60 * 60 * 1000, 1,
    'Only one account can be registered per hour from this connection.'
);

// ─── OTP send limiter ─────────────────────────────────────────────────────────

/**
 * OTP send: 2 per 10 min per IP. Applied to OTP-sending routes
 * (/send-otp, and the OTP-sending step of /signup/start; /signup/resend keeps it too).
 * Tighter than the old 5/min + 20/hr pair — prevents SMS/email bombing.
 */
const otpLimiter = make(
    10 * 60 * 1000, 2,
    'Too many OTP requests. Try again in 10 minutes.'
);

// ─── OTP verify limiter ───────────────────────────────────────────────────────

/**
 * Verify endpoints: 10 per minute per IP (separate from send).
 * The per-OTP attempt limit (5 tries → 15 min lock) lives in the DB;
 * this IP-level limiter is a secondary defence against distributed brute force.
 */
const otpVerifyLimiter = make(
    60 * 1000, 10,
    'Too many verification attempts. Please wait before trying again.'
);

module.exports = {
    publicFormLimiter,
    generalLimiter,
    adminLimiter,
    loginLimiter,
    registerLimiter,
    otpLimiter,
    otpVerifyLimiter,
};
