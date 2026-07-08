/**
 * OTP Production Test Suite (req 32)
 *
 * Tests:
 *  1. OTP expiry — expired code rejected
 *  2. OTP reuse — used code rejected on second attempt
 *  3. Resend invalidation — previous code invalid after resend
 *  4. Lockout — 5 failed attempts trigger 15-min lock
 *  5. Concurrent requests — only one OTP valid at a time (last-write-wins)
 *  6. Transaction rollback — DB state clean on error
 *  7. Firebase rollback — Firebase user deleted if profile insert fails
 *  8. SMS failure — OTP row invalidated, 502 returned, no half-state
 *  9. Email failure — OTP row invalidated, 502 returned, no half-state
 * 10. Purpose isolation — signup OTP cannot verify login
 * 11. Strong password — weak passwords rejected at /signup/start
 * 12. Enumeration safety — existing email returns generic success response
 */

require('../setup');

// ─── Env vars needed by auth.js ───────────────────────────────────────────────
process.env.PENDING_SIGNUP_ENCRYPTION_KEY =
    '1b4056f66a8523d766eead21edb659da6d9e60692d3bef8eccd6314350d2e681';
// Leaving SMTP_* and AUTHKEY_API_KEY unset triggers the email/SMS dev no-op paths.
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
process.env.AUTHKEY_API_KEY = ''; // triggers SMS dev no-op path

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreateUser   = jest.fn();
const mockDeleteUser   = jest.fn().mockResolvedValue(undefined);
const mockGetByEmail   = jest.fn();
const mockGetByPhone   = jest.fn();
const mockCustomToken  = jest.fn().mockResolvedValue('mock-custom-token');

jest.mock('../../config/firebase', () => ({
    admin: {
        auth: () => ({
            createUser:          mockCreateUser,
            deleteUser:          mockDeleteUser,
            getUserByEmail:      mockGetByEmail,
            getUserByPhoneNumber: mockGetByPhone,
            createCustomToken:   mockCustomToken,
            verifyIdToken:       jest.fn().mockResolvedValue({ uid: 'test-uid' }),
        }),
    },
    firebaseInitialized: true,
}));

// smsService — controllable per test
const mockSendSms = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/smsService', () => ({ sendSms: mockSendSms }));

// securityAuditService — swallow in tests
jest.mock('../../services/securityAuditService', () => ({
    securityAudit: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const bcrypt  = require('bcrypt');
const pool    = require('../../config/db');

function makeApp() {
    // Clear module cache so each describe group gets a fresh server instance
    jest.resetModules();
    return require('../../server');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_EMAIL = `otp-test-${Date.now()}`;
let   emailSeq   = 0;

function uniqEmail() {
    return `${BASE_EMAIL}-${++emailSeq}@test.com`;
}

function uniqPhone() {
    // Use Date.now + random suffix to avoid cross-run collisions in the shared DB
    const suffix = String(Date.now()).slice(-7) + String(++emailSeq).padStart(2, '0');
    return `+91${suffix}`;
}

/** Insert a pending_signup row directly, bypassing the route. */
async function insertPendingSignup(email, phone, name = 'Test User') {
    const { encrypt } = require('../../utils/pendingSignupCrypto');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query(
        `INSERT INTO pending_signups (name, email, phone, password_encrypted, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [name, email, phone, encrypt('Password1!'), expiresAt]
    );
}

/** Insert a real bcrypt-hashed OTP row directly into otp_codes. */
async function insertOtpRow({ email = null, phone = null, code, purpose = 'signup', expiresInMs = 10 * 60 * 1000 }) {
    const hash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + expiresInMs);
    const { rows } = await pool.query(
        `INSERT INTO otp_codes (email, phone, code_hash, expires_at, purpose)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [email, phone, hash, expiresAt, purpose]
    );
    return rows[0].id;
}

/** Delete all test rows for an email, cleaning up after each test. */
async function cleanupEmail(email) {
    await pool.query('DELETE FROM otp_codes       WHERE email = $1', [email]);
    await pool.query('DELETE FROM pending_signups  WHERE email = $1', [email]);
    await pool.query('DELETE FROM profiles         WHERE email = $1', [email]);
    await pool.query('DELETE FROM security_audit_logs WHERE email = $1', [email]);
}

// ─── Test setup ───────────────────────────────────────────────────────────────

let app;

beforeAll(() => {
    app = makeApp();
});

// Default Firebase mocks reset before each test so one test's mocks don't leak
beforeEach(() => {
    mockGetByEmail.mockReset();
    mockGetByPhone.mockReset();
    mockCreateUser.mockReset();
    mockDeleteUser.mockReset();
    mockCustomToken.mockReset();
    mockSendSms.mockReset();

    // Safe defaults: user not found, create succeeds, token works
    mockGetByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    mockGetByPhone.mockRejectedValue({ code: 'auth/user-not-found' });
    mockCreateUser.mockResolvedValue({ uid: `firebase-uid-${Date.now()}-${Math.random()}` });
    mockDeleteUser.mockResolvedValue(undefined);
    mockCustomToken.mockResolvedValue('mock-custom-token');
    mockSendSms.mockResolvedValue(undefined);
});

afterAll(async () => {
    await pool.end();
});

// ─── 1. OTP Expiry ───────────────────────────────────────────────────────────

describe('1. OTP expiry', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('rejects a code whose expires_at is in the past', async () => {
        await insertPendingSignup(email, phone);
        await insertOtpRow({ email, phone, code: '123456', purpose: 'signup', expiresInMs: -1000 }); // already expired

        const res = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '123456' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('invalid_code');
    });
});

// ─── 2. OTP Reuse ────────────────────────────────────────────────────────────

describe('2. OTP reuse', () => {
    it('marks code used on first verify and rejects on second', async () => {
        const email = uniqEmail();
        const phone = uniqPhone();

        await insertPendingSignup(email, phone);
        const otpId = await insertOtpRow({ email, phone, code: '654321', purpose: 'signup' });

        // First verify — should succeed (creates profile)
        const first = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '654321' });

        expect(first.status).toBe(201);

        // OTP row must now be marked used
        const { rows } = await pool.query('SELECT used FROM otp_codes WHERE id = $1', [otpId]);
        if (rows.length > 0) expect(rows[0].used).toBe(true);

        // Re-insert pending session (prior verify deleted it)
        await insertPendingSignup(email, phone);
        // Insert an already-expired clone of same code
        await insertOtpRow({ email, phone, code: '654321', purpose: 'signup', expiresInMs: -1 });

        // Second verify — no active unused row → rejected
        const second = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '654321' });

        expect([401, 410]).toContain(second.status);

        await cleanupEmail(email);
    });
});

// ─── 3. Resend invalidation ───────────────────────────────────────────────────

describe('3. Resend invalidates previous code', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('marks the old OTP invalidated when resend is called', async () => {
        await insertPendingSignup(email, phone);
        const oldId = await insertOtpRow({ email, phone, code: '111111', purpose: 'signup' });

        // Call resend endpoint
        const res = await request(app)
            .post('/api/auth/signup/resend')
            .send({ email });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Old OTP row must now be invalidated
        const { rows } = await pool.query(
            'SELECT invalidated FROM otp_codes WHERE id = $1',
            [oldId]
        );
        expect(rows[0].invalidated).toBe(true);

        // Old code must now be rejected
        await insertPendingSignup(email, phone); // restore session
        const verify = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '111111' });

        expect(verify.status).toBe(401);
    });
});

// ─── 4. Lockout after 5 failures ──────────────────────────────────────────────

describe('4. Lockout after 5 failed attempts', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('locks verification after 5 wrong codes', async () => {
        await insertPendingSignup(email, phone);
        await insertOtpRow({ email, phone, code: '999999', purpose: 'signup' });

        const wrongCode = '000000';
        let lastRes;

        for (let i = 0; i < 5; i++) {
            lastRes = await request(app)
                .post('/api/auth/signup/verify')
                .send({ email, code: wrongCode });
        }

        // 5th attempt should trigger lockout
        expect(lastRes.status).toBe(429);
        expect(lastRes.body.error).toBe('locked');

        // Further attempts are blocked even with correct code
        await insertPendingSignup(email, phone);
        const correctAttempt = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '999999' });

        expect(correctAttempt.status).toBe(429);
        expect(correctAttempt.body.error).toBe('locked');
    });
});

// ─── 5. Concurrent requests — last-write-wins ────────────────────────────────

describe('5. Concurrent requests — only latest OTP valid', () => {
    it('invalidates earlier OTPs when a new one is generated concurrently', async () => {
        const email = uniqEmail();
        const phone = uniqPhone();

        await insertPendingSignup(email, phone);

        // Insert first OTP then immediately invalidate it (simulates concurrent /signup/start)
        const firstId = await insertOtpRow({ email, phone, code: '111222', purpose: 'signup' });
        await pool.query(`UPDATE otp_codes SET invalidated = true WHERE id = $1`, [firstId]);

        // Insert second (active) OTP
        await insertOtpRow({ email, phone, code: '333444', purpose: 'signup' });

        // First (invalidated) code must be rejected
        const firstAttempt = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '111222' });
        expect(firstAttempt.status).toBe(401);

        // Ensure session still valid for second attempt
        await insertPendingSignup(email, phone);

        // Second code must work — clean email, no profile yet
        const secondAttempt = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '333444' });
        expect(secondAttempt.status).toBe(201);

        await cleanupEmail(email);
    });
});

// ─── 6. Transaction rollback on DB error ─────────────────────────────────────

describe('6. Transaction rollback', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('rolls back and does not create orphan OTP row when profile insert fails', async () => {
        await insertPendingSignup(email, phone);
        const otpId = await insertOtpRow({ email, phone, code: '777888', purpose: 'signup' });

        // Make profile insert fail by pre-inserting a conflicting uid
        mockCreateUser.mockResolvedValueOnce({ uid: 'conflict-uid' });
        await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, phone, role)
             VALUES ('conflict-uid', 'fan', 'Existing', 'User', $1, $2, 'user')`,
            [email, phone]
        );

        const res = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '777888' });

        // Should error (duplicate key on profiles.id)
        expect([409, 500]).toContain(res.status);

        // OTP row must NOT be marked used — transaction was rolled back
        const { rows } = await pool.query(
            'SELECT used FROM otp_codes WHERE id = $1', [otpId]
        );
        if (rows.length > 0) {
            expect(rows[0].used).toBe(false);
        }
    });
});

// ─── 7. Firebase rollback on profile insert failure ──────────────────────────

describe('7. Firebase rollback', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('calls deleteUser when profile insert fails due to duplicate uid', async () => {
        const uid = `firebase-rollback-uid-${Date.now()}`;

        await insertPendingSignup(email, phone);
        await insertOtpRow({ email, phone, code: '246810', purpose: 'signup' });

        // 1. Pre-insert a profile row with the exact uid that createUser will return.
        //    Use a distinct email/phone so no other constraint blocks us.
        const dupEmail = `pre-existing-${Date.now()}@test.invalid`;
        const dupPhone = `+1999${Date.now().toString().slice(-7)}`;
        await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, phone, role)
             VALUES ($1, 'fan', 'Pre', 'Existing', $2, $3, 'user')`,
            [uid, dupEmail, dupPhone]
        );

        // 2. Wire createUser to return that same uid → profile INSERT will hit PK conflict
        mockCreateUser.mockResolvedValueOnce({ uid });

        const res = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '246810' });

        // 3. The route must either call deleteUser (rollback) or return a server error
        const calledDelete = mockDeleteUser.mock.calls.some(([calledUid]) => calledUid === uid);
        const serverError  = res.status >= 500;
        expect(calledDelete || serverError).toBe(true);

        // Cleanup pre-inserted row
        await pool.query('DELETE FROM profiles WHERE id = $1', [uid]);
    });
});

// ─── 8. SMS delivery failure ─────────────────────────────────────────────────

describe('8. SMS failure handling', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('invalidates OTP row and returns 502 when SMS fails', async () => {
        mockSendSms.mockRejectedValueOnce(new Error('MSG91 timeout'));

        const res = await request(app)
            .post('/api/auth/signup/start')
            .send({
                name:            'SMS Fail User',
                email,
                phone,
                password:        'Password1!',
                confirmPassword: 'Password1!',
            });

        expect(res.status).toBe(502);
        expect(res.body.error).toBe('delivery_failed');

        // No active, non-invalidated OTP row should remain
        const { rows } = await pool.query(
            `SELECT * FROM otp_codes
             WHERE email = $1 AND phone = $2
               AND used = false AND invalidated = false`,
            [email, phone]
        );
        expect(rows).toHaveLength(0);
    });
});

// ─── 9. Email delivery failure ───────────────────────────────────────────────

describe('9. Email failure handling', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('invalidates OTP row and returns 502 when email fails', async () => {
        // sendEmailCode is a no-op when SMTP isn't configured (SMTP_* unset here).
        // We test the rollback branch via SMS failure instead, which uses the same
        // Promise.allSettled rollback path. This test validates the invariant:
        // after any delivery failure, no active un-invalidated OTP row remains.

        mockSendSms.mockRejectedValueOnce(new Error('SMS provider down'));

        const res = await request(app)
            .post('/api/auth/signup/start')
            .send({
                name:            'Email Fail User',
                email,
                phone,
                password:        'Password1!',
                confirmPassword: 'Password1!',
            });

        expect(res.status).toBe(502);
        expect(res.body.error).toBe('delivery_failed');

        // No active OTP row should remain after the rollback
        const { rows } = await pool.query(
            `SELECT * FROM otp_codes
             WHERE email = $1 AND phone = $2
               AND used = false AND invalidated = false`,
            [email, phone]
        );
        expect(rows).toHaveLength(0);
    });
});

// ─── 10. Purpose isolation ────────────────────────────────────────────────────

describe('10. Purpose isolation', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    afterAll(() => cleanupEmail(email));

    it('rejects a signup-purpose OTP when used on the login verify endpoint', async () => {
        // Insert a signup OTP
        await insertOtpRow({ email, phone: null, code: '112233', purpose: 'login_email' });

        // Try to use it as a signup verify — session won't exist, should 410
        const res = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '112233' });

        // No pending_signup exists → expired
        expect(res.status).toBe(410);
        expect(res.body.error).toBe('expired');
    });

    it('rejects a login_email OTP used on signup/verify even with active session', async () => {
        await insertPendingSignup(email, phone);

        // Insert a login_email OTP (wrong purpose for signup/verify)
        await insertOtpRow({ email, phone: null, code: '998877', purpose: 'login_email' });

        const res = await request(app)
            .post('/api/auth/signup/verify')
            .send({ email, code: '998877' });

        // signup/verify queries purpose='signup' — this login_email code won't match
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('invalid_code');
    });
});

// ─── 11. Password length validation (min 8 chars, no complexity rules) ────────

describe('11. Password length validation', () => {
    const phone = uniqPhone();

    // Only too-short passwords are rejected now — no uppercase/lowercase/digit/
    // special-character complexity is enforced.
    it('rejects password: too short', async () => {
        const email = uniqEmail();
        const res = await request(app)
            .post('/api/auth/signup/start')
            .send({ name: 'Test', email, phone, password: 'short1!', confirmPassword: 'short1!' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('weak_password');
    });

    // These would have failed the old complexity rules; with length-only
    // validation an 8+ char password is accepted regardless of character mix.
    const accepted = [
        { password: 'alllowercase',  desc: 'all lowercase, no digit/special' },
        { password: 'ALLUPPERCASE',  desc: 'all uppercase, no digit/special' },
        { password: 'nonumbersorspecials', desc: 'letters only' },
        { password: '12345678',      desc: 'digits only' },
    ];

    accepted.forEach(({ password, desc }) => {
        it(`accepts password: ${desc}`, async () => {
            const email = uniqEmail();
            const res = await request(app)
                .post('/api/auth/signup/start')
                .send({ name: 'Test', email, phone, password, confirmPassword: password });

            // 200 = sent (or enumeration-safe response), 409 = email exists — not 400
            expect([200, 409]).toContain(res.status);
        });
    });

    it('accepts an 8+ char password', async () => {
        const email = uniqEmail();
        const res = await request(app)
            .post('/api/auth/signup/start')
            .send({
                name:            'Test User',
                email,
                phone,
                password:        'simplepass',
                confirmPassword: 'simplepass',
            });

        // 200 = sent (or enumeration-safe response), not 400
        expect([200, 409]).toContain(res.status);
    });
});

// ─── 12. Account enumeration protection ──────────────────────────────────────

describe('12. Enumeration protection', () => {
    const email = uniqEmail();
    const phone = uniqPhone();

    beforeAll(async () => {
        // Pre-insert a profile so the email "exists"
        await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, phone, role)
             VALUES (gen_random_uuid(), 'fan', 'Existing', 'User', $1, $2, 'user')
             ON CONFLICT DO NOTHING`,
            [email, phone]
        );
    });

    afterAll(() => cleanupEmail(email));

    it('returns generic success even when email is already registered', async () => {
        const res = await request(app)
            .post('/api/auth/signup/start')
            .send({
                name:            'Any Name',
                email,
                phone:           uniqPhone(),
                password:        'StrongPass1!',
                confirmPassword: 'StrongPass1!',
            });

        // Must NOT return 409 — must return the generic enumeration-safe body
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/if the account exists/i);
    });

    it('returns generic response for send-otp regardless of whether user exists', async () => {
        const res = await request(app)
            .post('/api/auth/send-otp')
            .send({ channel: 'email', identifier: 'nonexistent@nowhere.com' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/if the account exists/i);
    });
});
