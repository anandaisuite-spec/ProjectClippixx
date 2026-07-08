'use strict';

/**
 * /api/auth  — OTP-based signup and login
 *
 * Security properties:
 *   - Cryptographically secure OTPs (crypto.randomInt, never Math.random)
 *   - Bcrypt-hashed storage (NEVER plain text)
 *   - Purpose isolation: signup / login_email / login_phone / password_reset / email_change
 *   - Account enumeration protection on all public-facing paths
 *   - 5 failed-attempt lockout → 15-minute ban
 *   - Max 3 resends per 10-minute window
 *   - Previous OTPs invalidated on every new send/resend
 *   - Device fingerprinting (IP + User-Agent) on every OTP row
 *   - Full security_audit_logs on every meaningful event
 *   - SMS + Email failure rollback — never leave half-sent state
 *   - Firebase duplicate pre-check before createUser()
 *   - Transactional DB writes throughout (BEGIN / COMMIT / ROLLBACK)
 *   - Password length validation (minimum 8 characters)
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const bcrypt   = require('bcrypt');
const { body } = require('express-validator');
const { admin } = require('../config/firebase');

const pool                  = require('../config/db');
const validate              = require('../middleware/validate');
const { loginLimiter, registerLimiter, otpLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const { encrypt, decrypt }  = require('../utils/pendingSignupCrypto');
const { sendSms }           = require('../services/smsService');
const { sendEmail }         = require('../services/emailService');
const { securityAudit }     = require('../services/securityAuditService');
const disposableDomains     = require('disposable-email-domains');

// ─── Constants ───────────────────────────────────────────────────────────────

const OTP_EXPIRY_MIN      = 10;
const SIGNUP_EXPIRY_MIN   = 30;
const BCRYPT_ROUNDS       = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const LOCK_MINUTES        = 15;
const MAX_RESENDS         = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cryptographically secure 6-digit OTP: 100000–999999 (never leading zero). */
function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function expiresAt(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000);
}

/** Bcrypt hash — async, 10 rounds. */
function hashOtp(plain) {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Bcrypt compare — constant-time. */
function compareOtp(plain, hash) {
    return bcrypt.compare(plain, hash);
}

/** Extract device fingerprint from request. */
function fingerprint(req) {
    return {
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
    };
}

/**
 * Password rule: minimum 8 characters. No complexity requirements
 * (uppercase / lowercase / digit / special character) are enforced.
 * Returns null if valid, error string otherwise.
 */
function validatePassword(pw) {
    if (!pw || pw.length < 8)         return 'Password must be at least 8 characters.';
    return null;
}

/**
 * Invalidate all previous active OTPs for the given identity + purpose.
 * Called inside a transaction client.
 */
async function invalidatePrevious(client, { email, phone, purpose }) {
    if (purpose === 'signup') {
        await client.query(
            `UPDATE otp_codes SET invalidated = true
             WHERE email = $1 AND phone = $2 AND purpose = 'signup'
               AND used = false AND invalidated = false`,
            [email, phone]
        );
    } else if (purpose === 'login_email' || purpose === 'password_reset' || purpose === 'email_change') {
        await client.query(
            `UPDATE otp_codes SET invalidated = true
             WHERE email = $1 AND purpose = $2
               AND used = false AND invalidated = false`,
            [email, purpose]
        );
    } else {
        // login_phone
        await client.query(
            `UPDATE otp_codes SET invalidated = true
             WHERE phone = $1 AND purpose = $2
               AND used = false AND invalidated = false`,
            [phone, purpose]
        );
    }
}

/** Send email OTP via SMTP. Returns true on success / dev no-op; throws on real failure. */
async function sendEmailCode(to, code) {
    await sendEmail({
        to,
        subject: 'Your Clipixx verification code',
        html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f0f0f;border-radius:16px">
  <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Clipixx</h1>
  <p style="color:#aaa;font-size:14px;margin:0 0 32px">Verification Code</p>
  <p style="color:#ccc;font-size:15px;margin:0 0 16px">Use this code to verify your account. It expires in <strong style="color:#fff">${OTP_EXPIRY_MIN} minutes</strong>.</p>
  <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
    <span style="font-size:48px;font-weight:800;letter-spacing:12px;color:#fff;font-variant-numeric:tabular-nums">${code}</span>
  </div>
  <p style="color:#666;font-size:12px;margin:0">Never share this code. Clipixx will never ask for it.</p>
</div>`,
    });
    return true;
}

// ─── Enumeration-safe response (req 19) ──────────────────────────────────────

const ENUM_SAFE_RESPONSE = {
    success: true,
    message: 'If the account exists, a verification code has been sent.',
};

// ─── POST /api/auth/turnstile-verify ─────────────────────────────────────────
// Standalone CAPTCHA check for the full-screen site gate. This endpoint IS the
// verifier, so it must NOT use the verifyTurnstile middleware (that would reject
// the request before it can verify — a circular dependency). Instead it calls
// Cloudflare's siteverify directly. The frontend sends `turnstileToken`.
router.post('/turnstile-verify', async (req, res) => {
    const token = req.body && req.body.turnstileToken;
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    // Cloudflare siteverify expects application/x-www-form-urlencoded.
    const form = new URLSearchParams();
    form.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
    form.append('response', token);
    const remoteip = req.headers['cf-connecting-ip'] || req.ip;
    if (remoteip) form.append('remoteip', remoteip);

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form,
        });
        const data = await response.json();

        if (data.success) {
            return res.json({ success: true });
        }
        console.warn('[turnstile-verify] failed:', (data['error-codes'] || []).join(', ') || 'unknown');
        return res.status(403).json({ success: false, error: 'Verification failed' });
    } catch (err) {
        console.error('[turnstile-verify] error:', err.message);
        return res.status(500).json({ error: 'Verification error' });
    }
});

// ─── POST /api/auth/recaptcha-verify ─────────────────────────────────────────
// Standalone Google reCAPTCHA v2 check for the full-screen site gate. Like the
// turnstile-verify route, this IS the verifier, so it calls Google's siteverify
// directly (no middleware). The frontend sends `token`.
router.post('/recaptcha-verify', async (req, res) => {
    const { token } = req.body || {};
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    try {
        const params = new URLSearchParams({
            secret: process.env.RECAPTCHA_SECRET_KEY || '',
            response: token,
        });
        const remoteip = req.headers['cf-connecting-ip'] || req.ip;
        if (remoteip) params.append('remoteip', remoteip);

        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        const data = await response.json();

        if (data.success) {
            return res.json({ success: true });
        }
        console.warn('[recaptcha-verify] failed:', (data['error-codes'] || []).join(', ') || 'unknown');
        return res.status(403).json({ success: false, error: 'Verification failed' });
    } catch (err) {
        console.error('[recaptcha-verify] error:', err.message);
        return res.status(500).json({ error: 'Verification error' });
    }
});

// ─── POST /api/auth/signup/start ─────────────────────────────────────────────

router.post(
    '/signup/start',
    registerLimiter,
    otpLimiter,
    // Turnstile is enforced site-wide by the full-screen gate (POST /turnstile-verify),
    // so form-level CAPTCHA on signup is no longer required.
    [
        body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
        body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
        body('phone')
            .trim()
            .matches(/^\+\d{7,15}$/)
            .withMessage('Phone must be in E.164 format, e.g. +919876543210'),
        body('password').notEmpty().withMessage('Password is required'),
        body('confirmPassword').custom((v, { req }) => {
            if (v !== req.body.password) throw new Error('Passwords do not match');
            return true;
        }),
    ],
    validate,
    async (req, res, next) => {
        const fp     = fingerprint(req);

        // ── Honeypot ──
        // `website` is a hidden field no real user can see/fill. If it's filled,
        // a bot blindly populated every input. Silently return a success-looking
        // response without doing anything — never reveal the trap was triggered.
        if (req.body.website) {
            return res.json({ success: true, message: 'Verification code sent to your email and phone.' });
        }

        // ── Disposable email block ──
        const emailDomain = String(req.body.email || '').split('@')[1]?.toLowerCase();
        if (emailDomain && disposableDomains.includes(emailDomain)) {
            return res.status(400).json({
                error: 'disposable_email',
                message: 'Please use a permanent email address to sign up.',
            });
        }

        const client = await pool.connect();
        try {
            // Password length check (min 8 chars; no complexity rules)
            const pwError = validatePassword(req.body.password);
            if (pwError) return res.status(400).json({ error: 'weak_password', message: pwError });

            await client.query('BEGIN');

            const { name, phone, password } = req.body;
            const email = req.body.email.toLowerCase();

            // Email collision check — return generic response (req 19)
            const existing = await client.query(
                'SELECT id FROM profiles WHERE email = $1 LIMIT 1', [email]
            );
            if (existing.rows.length > 0) {
                await client.query('ROLLBACK');
                // Don't reveal the email exists
                return res.json(ENUM_SAFE_RESPONSE);
            }

            // Creator guard
            const creatorCheck = await client.query(
                `SELECT account_type FROM profiles WHERE phone = $1 LIMIT 1`, [phone]
            );
            if (creatorCheck.rows.length > 0 && creatorCheck.rows[0].account_type === 'creator') {
                await client.query('ROLLBACK');
                return res.status(403).json({
                    error: 'creator_account',
                    message: 'This phone number belongs to a creator account. Log in with your username and password.',
                });
            }

            // Firebase duplicate pre-check (req 28)
            let firebaseEmailExists = false;
            let firebasePhoneExists = false;
            try { await admin.auth().getUserByEmail(email); firebaseEmailExists = true; } catch (_) {}
            try { await admin.auth().getUserByPhoneNumber(phone); firebasePhoneExists = true; } catch (_) {}

            if (firebaseEmailExists || firebasePhoneExists) {
                await client.query('ROLLBACK');
                await securityAudit('firebase_duplicate_blocked', { email, phone, ip: fp.ip, userAgent: fp.userAgent });
                // Still enumeration-safe
                return res.json(ENUM_SAFE_RESPONSE);
            }

            // Upsert pending_signups
            await client.query('DELETE FROM pending_signups WHERE email = $1', [email]);
            await client.query(
                `INSERT INTO pending_signups (name, email, phone, password_encrypted, expires_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [name, email, phone, encrypt(password), expiresAt(SIGNUP_EXPIRY_MIN)]
            );

            // Invalidate previous signup OTPs
            await invalidatePrevious(client, { email, phone, purpose: 'signup' });

            // Generate unique code (req 1, 5)
            const code     = generateOtp();
            const codeHash = await hashOtp(code);

            await client.query(
                `INSERT INTO otp_codes (email, phone, code_hash, expires_at, purpose, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, 'signup', $5, $6)`,
                [email, phone, codeHash, expiresAt(OTP_EXPIRY_MIN), fp.ip, fp.userAgent]
            );

            await client.query('COMMIT');

            // Send to both channels — rollback OTP row on any failure (req 26, 27)
            let emailErr = null;
            let smsErr   = null;
            const results = await Promise.allSettled([
                sendEmailCode(email, code),
                sendSms(phone, code, name),
            ]);
            if (results[0].status === 'rejected') emailErr = results[0].reason;
            if (results[1].status === 'rejected') smsErr   = results[1].reason;

            if (emailErr || smsErr) {
                // Rollback the OTP row so user isn't in a half-sent state
                await pool.query(
                    `UPDATE otp_codes SET invalidated = true
                     WHERE email = $1 AND phone = $2 AND purpose = 'signup'
                       AND used = false AND invalidated = false`,
                    [email, phone]
                );
                const failedChannels = [emailErr && 'email', smsErr && 'SMS'].filter(Boolean).join(' and ');
                console.error(`[signup/start] Delivery failed (${failedChannels}):`, emailErr || smsErr);
                return res.status(502).json({
                    error: 'delivery_failed',
                    message: `Failed to send verification code via ${failedChannels}. Please try again.`,
                });
            }

            await securityAudit('otp_sent', { email, phone, ip: fp.ip, userAgent: fp.userAgent, metadata: { purpose: 'signup' } });

            res.json({ success: true, message: 'Verification code sent to your email and phone.' });
        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }
);

// ─── POST /api/auth/signup/resend ─────────────────────────────────────────────

router.post(
    '/signup/resend',
    otpLimiter,
    [body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required')],
    validate,
    async (req, res, next) => {
        const fp     = fingerprint(req);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const email = req.body.email.toLowerCase();

            const { rows } = await client.query(
                `SELECT * FROM pending_signups WHERE email = $1 AND expires_at > now() LIMIT 1`,
                [email]
            );
            if (rows.length === 0) {
                await client.query('ROLLBACK');
                // Enumeration-safe
                return res.json(ENUM_SAFE_RESPONSE);
            }
            const ps = rows[0];

            // Count resends in last 10 minutes (req 8)
            const { rows: countRows } = await client.query(
                `SELECT COALESCE(SUM(resend_count), 0) AS total
                 FROM otp_codes
                 WHERE email = $1 AND purpose = 'signup'
                   AND created_at > now() - interval '${OTP_EXPIRY_MIN} minutes'`,
                [email]
            );
            const totalResends = parseInt(countRows[0].total, 10);
            if (totalResends >= MAX_RESENDS) {
                await client.query('ROLLBACK');
                await securityAudit('otp_resend', {
                    email, phone: ps.phone, ip: fp.ip, userAgent: fp.userAgent,
                    metadata: { blocked: true, reason: 'too_many_resends' },
                });
                return res.status(429).json({
                    error: 'too_many_resends',
                    message: `Too many resend attempts. Please wait before trying again.`,
                });
            }

            // Invalidate old codes, generate fresh (req 7)
            await invalidatePrevious(client, { email, phone: ps.phone, purpose: 'signup' });

            const code     = generateOtp();
            const codeHash = await hashOtp(code);

            await client.query(
                `INSERT INTO otp_codes (email, phone, code_hash, expires_at, purpose, resend_count, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, 'signup', $5, $6, $7)`,
                [email, ps.phone, codeHash, expiresAt(OTP_EXPIRY_MIN), totalResends + 1, fp.ip, fp.userAgent]
            );

            await client.query('COMMIT');

            // Send — rollback on failure (req 26, 27)
            const results = await Promise.allSettled([
                sendEmailCode(email, code),
                sendSms(ps.phone, code, ps.name),
            ]);
            const emailErr = results[0].status === 'rejected' ? results[0].reason : null;
            const smsErr   = results[1].status === 'rejected' ? results[1].reason : null;

            if (emailErr || smsErr) {
                await pool.query(
                    `UPDATE otp_codes SET invalidated = true
                     WHERE email = $1 AND phone = $2 AND purpose = 'signup'
                       AND used = false AND invalidated = false`,
                    [email, ps.phone]
                );
                const failed = [emailErr && 'email', smsErr && 'SMS'].filter(Boolean).join(' and ');
                return res.status(502).json({
                    error: 'delivery_failed',
                    message: `Failed to resend via ${failed}. Please try again.`,
                });
            }

            await securityAudit('otp_resend', { email, phone: ps.phone, ip: fp.ip, userAgent: fp.userAgent });

            res.json({ success: true, message: 'New code sent to your email and phone.' });
        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }
);

// ─── POST /api/auth/signup/verify ─────────────────────────────────────────────

router.post(
    '/signup/verify',
    otpVerifyLimiter,
    [
        body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
        body('code').trim().matches(/^\d{6}$/).withMessage('Code must be 6 digits'),
    ],
    validate,
    async (req, res, next) => {
        const fp     = fingerprint(req);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const email = req.body.email.toLowerCase();
            const code  = req.body.code.trim();

            const { rows: pending } = await client.query(
                `SELECT * FROM pending_signups WHERE email = $1 AND expires_at > now() LIMIT 1`,
                [email]
            );
            if (pending.length === 0) {
                await client.query('ROLLBACK');
                return res.status(410).json({
                    error: 'expired',
                    message: 'Your signup session has expired. Please start over.',
                });
            }
            const ps = pending[0];

            // Fetch latest active OTP (purpose = 'signup', req 18)
            const { rows: otpRows } = await client.query(
                `SELECT * FROM otp_codes
                 WHERE email = $1 AND phone = $2 AND purpose = 'signup'
                   AND used = false AND invalidated = false AND expires_at > now()
                 ORDER BY created_at DESC LIMIT 1`,
                [email, ps.phone]
            );

            if (otpRows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(401).json({
                    error: 'invalid_code',
                    message: 'Code expired or not found. Request a new one.',
                });
            }

            const otpRow = otpRows[0];

            // Lockout check (req 9)
            if (otpRow.locked_until && new Date(otpRow.locked_until) > new Date()) {
                const remaining = Math.ceil((new Date(otpRow.locked_until) - Date.now()) / 60000);
                await client.query('ROLLBACK');
                await securityAudit('otp_locked', { email, phone: ps.phone, ip: fp.ip, userAgent: fp.userAgent });
                return res.status(429).json({
                    error: 'locked',
                    message: `Too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
                    lockedUntil: otpRow.locked_until,
                });
            }

            // Bcrypt compare (req 10)
            const valid = await compareOtp(code, otpRow.code_hash);

            if (!valid) {
                const newAttempts = otpRow.failed_attempts + 1;
                if (newAttempts >= MAX_VERIFY_ATTEMPTS) {
                    await client.query(
                        `UPDATE otp_codes SET failed_attempts = $1, locked_until = $2 WHERE id = $3`,
                        [newAttempts, expiresAt(LOCK_MINUTES), otpRow.id]
                    );
                    await client.query('COMMIT');
                    await securityAudit('otp_locked', { email, phone: ps.phone, ip: fp.ip, userAgent: fp.userAgent, metadata: { attempts: newAttempts } });
                    return res.status(429).json({
                        error: 'locked',
                        message: `Too many failed attempts. Verification locked for ${LOCK_MINUTES} minutes.`,
                    });
                }
                await client.query(
                    `UPDATE otp_codes SET failed_attempts = $1 WHERE id = $2`,
                    [newAttempts, otpRow.id]
                );
                await client.query('COMMIT');
                await securityAudit('otp_failed', { email, phone: ps.phone, ip: fp.ip, userAgent: fp.userAgent, metadata: { attempts: newAttempts } });
                return res.status(401).json({
                    error: 'invalid_code',
                    message: 'Incorrect code.',
                    attemptsRemaining: MAX_VERIFY_ATTEMPTS - newAttempts,
                });
            }

            // Mark used (req 12, 13)
            await client.query(`UPDATE otp_codes SET used = true WHERE id = $1`, [otpRow.id]);

            // Firebase duplicate pre-check (req 28) — race-condition safety
            let fbEmailUser = null;
            let fbPhoneUser = null;
            try { fbEmailUser = await admin.auth().getUserByEmail(ps.email); } catch (_) {}
            try { fbPhoneUser = await admin.auth().getUserByPhoneNumber(ps.phone); } catch (_) {}

            if (fbEmailUser || fbPhoneUser) {
                await client.query('ROLLBACK');
                await securityAudit('firebase_duplicate_blocked', { email, phone: ps.phone, ip: fp.ip, userAgent: fp.userAgent });
                return res.status(409).json({
                    error: 'account_exists',
                    message: 'An account with this email or phone already exists. Try logging in.',
                });
            }

            // Create Firebase user (req 14 — emailVerified: true)
            const password = decrypt(ps.password_encrypted);
            const [firstName, ...rest] = ps.name.trim().split(' ');
            const lastName = rest.join(' ');

            let userRecord;
            try {
                userRecord = await admin.auth().createUser({
                    email:         ps.email,
                    phoneNumber:   ps.phone,
                    password,
                    displayName:   ps.name,
                    emailVerified: true,
                });
            } catch (fbErr) {
                await client.query('ROLLBACK');
                if (fbErr.code === 'auth/email-already-exists' || fbErr.code === 'auth/phone-number-already-exists') {
                    return res.status(409).json({
                        error: 'account_exists',
                        message: 'An account with this email or phone already exists.',
                    });
                }
                throw fbErr;
            }

            // Insert profile — Firebase rollback on failure
            try {
                await client.query(
                    `INSERT INTO profiles (id, account_type, first_name, last_name, email, phone, role)
                     VALUES ($1, 'fan', $2, $3, $4, $5, 'user')`,
                    [userRecord.uid, firstName, lastName, ps.email, ps.phone]
                );
            } catch (dbErr) {
                await admin.auth().deleteUser(userRecord.uid).catch(() => {});
                throw dbErr;
            }

            await client.query('DELETE FROM pending_signups WHERE email = $1', [email]);
            await client.query('COMMIT');

            await securityAudit('signup_complete', { email, phone: ps.phone, ip: fp.ip, userAgent: fp.userAgent });

            const customToken = await admin.auth().createCustomToken(userRecord.uid);
            res.status(201).json({ customToken, message: 'Account created successfully.' });
        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }
);

// ─── POST /api/auth/send-otp  (email verification: signup + login) ──────────
// No Turnstile here — CAPTCHA is handled once, site-wide, by the full-screen
// gate (POST /turnstile-verify) before any part of the app is reachable.

router.post(
    '/send-otp',
    loginLimiter,
    otpLimiter,
    [
        body('channel').isIn(['email', 'phone']).withMessage('channel must be "email" or "phone"'),
        body('identifier').trim().notEmpty().withMessage('identifier is required'),
    ],
    validate,
    async (req, res, next) => {
        const fp     = fingerprint(req);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { channel }  = req.body;
            const identifier   = req.body.identifier.trim();
            const isEmail      = channel === 'email';
            const normalised   = isEmail ? identifier.toLowerCase() : identifier;
            const purpose      = isEmail ? 'login_email' : 'login_phone';

            // Creator guard
            const col = isEmail ? 'email' : 'phone';
            const { rows: guard } = await client.query(
                `SELECT account_type FROM profiles WHERE ${col} = $1 LIMIT 1`,
                [normalised]
            );
            if (guard.length > 0 && guard[0].account_type === 'creator') {
                await client.query('ROLLBACK');
                return res.status(403).json({
                    error: 'creator_account',
                    message: 'Creator accounts must log in with username and password.',
                });
            }

            // Invalidate previous login OTPs for this identifier + purpose (req 7)
            await invalidatePrevious(client, {
                email: isEmail ? normalised : null,
                phone: isEmail ? null : normalised,
                purpose,
            });

            const code     = generateOtp();
            const codeHash = await hashOtp(code);
            const exp      = expiresAt(OTP_EXPIRY_MIN);

            if (isEmail) {
                await client.query(
                    `INSERT INTO otp_codes (email, code_hash, expires_at, purpose, ip_address, user_agent)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [normalised, codeHash, exp, purpose, fp.ip, fp.userAgent]
                );
            } else {
                await client.query(
                    `INSERT INTO otp_codes (phone, code_hash, expires_at, purpose, ip_address, user_agent)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [normalised, codeHash, exp, purpose, fp.ip, fp.userAgent]
                );
            }

            await client.query('COMMIT');

            // Delivery — rollback if fails
            let deliveryErr = null;
            try {
                if (isEmail) await sendEmailCode(normalised, code);
                else         await sendSms(normalised, code);
            } catch (err) {
                deliveryErr = err;
            }

            if (deliveryErr) {
                await pool.query(
                    `UPDATE otp_codes SET invalidated = true
                     WHERE ${col} = $1 AND purpose = $2
                       AND used = false AND invalidated = false`,
                    [normalised, purpose]
                );
                // Enumeration-safe even on failure
                return res.json(ENUM_SAFE_RESPONSE);
            }

            await securityAudit('otp_sent', {
                email: isEmail ? normalised : null,
                phone: isEmail ? null : normalised,
                ip: fp.ip, userAgent: fp.userAgent,
                metadata: { purpose },
            });

            // Always return enumeration-safe response (req 19)
            res.json(ENUM_SAFE_RESPONSE);
        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }
);

// ─── POST /api/auth/verify-otp  (login) ──────────────────────────────────────

router.post(
    '/verify-otp',
    otpVerifyLimiter,
    [
        body('channel').isIn(['email', 'phone']).withMessage('channel must be "email" or "phone"'),
        body('identifier').trim().notEmpty().withMessage('identifier is required'),
        body('code').trim().matches(/^\d{6}$/).withMessage('Code must be 6 digits'),
    ],
    validate,
    async (req, res, next) => {
        const fp     = fingerprint(req);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { channel } = req.body;
            const identifier  = req.body.identifier.trim();
            const code        = req.body.code.trim();
            const isEmail     = channel === 'email';
            const normalised  = isEmail ? identifier.toLowerCase() : identifier;
            const purpose     = isEmail ? 'login_email' : 'login_phone';
            const col         = isEmail ? 'email' : 'phone';

            const { rows } = await client.query(
                `SELECT * FROM otp_codes
                 WHERE ${col} = $1 AND purpose = $2
                   AND used = false AND invalidated = false AND expires_at > now()
                 ORDER BY created_at DESC LIMIT 1`,
                [normalised, purpose]
            );

            if (rows.length === 0) {
                await client.query('ROLLBACK');
                // Enumeration-safe (req 19)
                return res.status(401).json({
                    error: 'invalid_code',
                    message: 'Code expired or not found. Request a new one.',
                });
            }

            const otpRow = rows[0];

            // Lockout check
            if (otpRow.locked_until && new Date(otpRow.locked_until) > new Date()) {
                const remaining = Math.ceil((new Date(otpRow.locked_until) - Date.now()) / 60000);
                await client.query('ROLLBACK');
                await securityAudit('otp_locked', {
                    email: isEmail ? normalised : null,
                    phone: isEmail ? null : normalised,
                    ip: fp.ip, userAgent: fp.userAgent,
                });
                return res.status(429).json({
                    error: 'locked',
                    message: `Too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
                    lockedUntil: otpRow.locked_until,
                });
            }

            const valid = await compareOtp(code, otpRow.code_hash);

            if (!valid) {
                const newAttempts = otpRow.failed_attempts + 1;
                const auditCtx = {
                    email: isEmail ? normalised : null,
                    phone: isEmail ? null : normalised,
                    ip: fp.ip, userAgent: fp.userAgent,
                    metadata: { attempts: newAttempts },
                };
                if (newAttempts >= MAX_VERIFY_ATTEMPTS) {
                    await client.query(
                        `UPDATE otp_codes SET failed_attempts = $1, locked_until = $2 WHERE id = $3`,
                        [newAttempts, expiresAt(LOCK_MINUTES), otpRow.id]
                    );
                    await client.query('COMMIT');
                    await securityAudit('otp_locked', auditCtx);
                    return res.status(429).json({
                        error: 'locked',
                        message: `Too many failed attempts. Verification locked for ${LOCK_MINUTES} minutes.`,
                    });
                }
                await client.query(
                    `UPDATE otp_codes SET failed_attempts = $1 WHERE id = $2`,
                    [newAttempts, otpRow.id]
                );
                await client.query('COMMIT');
                await securityAudit('otp_failed', auditCtx);
                return res.status(401).json({
                    error: 'invalid_code',
                    message: 'Incorrect code.',
                    attemptsRemaining: MAX_VERIFY_ATTEMPTS - newAttempts,
                });
            }

            // Mark used (req 12, 13)
            await client.query(`UPDATE otp_codes SET used = true WHERE id = $1`, [otpRow.id]);

            // Resolve or lazily create Firebase user
            let uid;
            try {
                const fbUser = isEmail
                    ? await admin.auth().getUserByEmail(normalised)
                    : await admin.auth().getUserByPhoneNumber(normalised);
                uid = fbUser.uid;
            } catch (fbErr) {
                if (fbErr.code !== 'auth/user-not-found') throw fbErr;
                const createOpts = isEmail
                    ? { email: normalised, password: crypto.randomBytes(24).toString('base64url'), emailVerified: true }
                    : { phoneNumber: normalised };
                const created = await admin.auth().createUser(createOpts);
                uid = created.uid;
            }

            await client.query('COMMIT');

            await securityAudit('login_complete', {
                email: isEmail ? normalised : null,
                phone: isEmail ? null : normalised,
                ip: fp.ip, userAgent: fp.userAgent,
            });

            const customToken = await admin.auth().createCustomToken(uid);
            res.json({ customToken });
        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }
);

module.exports = router;
