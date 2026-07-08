const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole, invalidateCachedRole } = require('../middleware/role');
const { writeAuditLog } = require('../services/auditService');
const validate = require('../middleware/validate');
const { admin, firebaseInitialized } = require('../config/firebase');
const { registerLimiter } = require('../middleware/rateLimiter');
const disposableDomains = require('disposable-email-domains');
const multer = require('multer');
const { randomUUID } = require('crypto');
const r2 = require('../services/r2');

// ── Profile avatar upload (any account type — fan/creator/admin) ─────────────
// Same hardened pipeline as the creator-dashboard uploads: MIME whitelist,
// size cap, magic-byte verification, UUID object key.
const AVATAR_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const fileTypePromise = import('file-type'); // ESM-only → dynamic import from CJS

// Multer errors (e.g. file too large) → clean 400 instead of a crash.
function handleAvatarMulter(mw) {
    return (req, res, next) => mw(req, res, (err) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 5MB' : 'Upload failed';
            return res.status(400).json({ error: msg });
        }
        next();
    });
}

const createValidationRules = [
    body('account_type')
        .trim()
        .notEmpty().withMessage('Account type is required')
        .isIn(['fan', 'creator']).withMessage('Account type must be "fan" or "creator"'),
    body('first_name')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ max: 100 }).withMessage('First name must be under 100 characters'),
    body('last_name')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ max: 100 }).withMessage('Last name must be under 100 characters'),
    body('phone')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 20 }).withMessage('Phone must be under 20 characters'),
    body('bio')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 2000 }).withMessage('Bio must be under 2000 characters'),
];

const updateValidationRules = [
    body('first_name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('First name must be 1-100 characters'),
    body('last_name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Last name must be 1-100 characters'),
    body('phone')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 20 }).withMessage('Phone must be under 20 characters'),
    body('avatar_url')
        .optional({ values: 'falsy' })
        .trim()
        .isURL().withMessage('Avatar URL must be a valid URL')
        .isLength({ max: 2048 }).withMessage('Avatar URL must be under 2048 characters'),
    body('bio')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 2000 }).withMessage('Bio must be under 2000 characters'),
];

/**
 * GET /api/profiles/me
 * Returns the profile for the authenticated user, creating one automatically
 * if it doesn't exist yet (covers new social-login accounts, post-migration
 * orphaned UIDs, or any path where POST /api/profiles wasn't called first).
 */
router.get('/me', verifyToken, async (req, res, next) => {
    try {
        let result = await pool.query(
            `SELECT id, account_type, first_name, last_name, email, phone, avatar_url, bio, role, created_at, updated_at
             FROM profiles WHERE id = $1`,
            [req.user.uid]
        );

        if (result.rows.length === 0) {
            // Derive name from token — Google/Facebook supply displayName; phone/OTP
            // accounts won't, fall back gracefully to empty strings.
            const rawName = (req.user.name || '').trim();
            const [firstName, ...rest] = rawName ? rawName.split(' ') : [''];
            const lastName = rest.join(' ');
            // Phone-auth tokens carry phone_number; email tokens carry email.
            const phoneFromToken = req.user.phone_number || null;

            result = await pool.query(
                `INSERT INTO profiles (id, email, first_name, last_name, phone, account_type, role)
                 VALUES ($1, $2, $3, $4, $5, 'fan', 'user')
                 RETURNING id, account_type, first_name, last_name, email, phone, avatar_url, bio, role, created_at, updated_at`,
                [req.user.uid, req.user.email || null, firstName || '', lastName, phoneFromToken]
            );
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/profiles/me/activity
 * Returns the logged-in user's own submissions:
 *   - creator_applications (matched by email)
 *   - star_suggestions     (matched by submitter_email)
 *   - feedback             (matched by email)
 */
router.get('/me/activity', verifyToken, async (req, res, next) => {
    try {
        const email = req.user.email;

        const [applications, suggestions, feedback] = await Promise.all([
            pool.query(
                `SELECT id, full_name, category, status, created_at, updated_at
                 FROM creator_applications WHERE email = $1
                 ORDER BY created_at DESC LIMIT 20`,
                [email]
            ),
            pool.query(
                `SELECT id, celebrity_name, category, status, created_at
                 FROM star_suggestions WHERE submitter_email = $1
                 ORDER BY created_at DESC LIMIT 20`,
                [email]
            ),
            pool.query(
                `SELECT id, type, subject, created_at
                 FROM feedback WHERE email = $1
                 ORDER BY created_at DESC LIMIT 20`,
                [email]
            ),
        ]);

        res.json({
            data: {
                applications: applications.rows,
                suggestions: suggestions.rows,
                feedback: feedback.rows,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/profiles
 * UPSERT — eliminates check-then-insert race condition.
 *
 * This is the ACTIVE signup endpoint (the frontend creates the Firebase user
 * client-side, then calls this), so the anti-abuse stack lives here:
 *   registerLimiter → Firebase token → validation → honeypot →
 *   disposable-email check.
 * CAPTCHA is NOT enforced per-form: the full-screen Turnstile gate already
 * verifies every browser session before any part of the site is usable.
 */
router.post('/', registerLimiter, verifyToken, createValidationRules, validate, async (req, res, next) => {
    try {
        // ── Honeypot ──
        // `website` is a hidden field no real user can see/fill. If it's filled,
        // a bot submitted the form — return a success-shaped response and do nothing.
        if (req.body.website) {
            return res.status(201).json({ message: 'Profile created' });
        }

        // ── Disposable email block ──
        // Email comes from the VERIFIED Firebase token, not the request body.
        const emailDomain = (req.user.email || '').split('@')[1]?.toLowerCase();
        if (emailDomain && disposableDomains.includes(emailDomain)) {
            return res.status(400).json({
                error: 'disposable_email',
                message: 'Please use a permanent email address to sign up.',
            });
        }

        const { account_type, first_name, last_name, phone, bio } = req.body;

        const result = await pool.query(
            `INSERT INTO profiles (id, account_type, first_name, last_name, email, phone, bio)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET updated_at = now()
             RETURNING id, account_type, first_name, last_name, email, phone, avatar_url, bio, role, created_at, updated_at`,
            [req.user.uid, account_type, first_name, last_name, req.user.email, phone || null, bio || '']
        );

        res.status(201).json({ message: 'Profile created', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/profiles/me
 */
router.put('/me', verifyToken, updateValidationRules, validate, async (req, res, next) => {
    try {
        // Defense-in-depth: reject modification of restricted fields
        const restricted = ['role', 'account_type', 'id', 'email'].filter((f) => req.body[f] !== undefined);
        if (restricted.length > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Cannot modify restricted fields: ${restricted.join(', ')}`,
            });
        }

        const { first_name, last_name, phone, avatar_url, bio } = req.body;

        const result = await pool.query(
            `UPDATE profiles
             SET first_name  = COALESCE($1, first_name),
                 last_name   = COALESCE($2, last_name),
                 phone       = COALESCE($3, phone),
                 avatar_url  = COALESCE($4, avatar_url),
                 bio         = COALESCE($5, bio)
             WHERE id = $6
             RETURNING id, account_type, first_name, last_name, email, phone, avatar_url, bio, role, created_at, updated_at`,
            [first_name, last_name, phone, avatar_url, bio, req.user.uid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({ message: 'Profile updated', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/profiles/me/avatar
 * Profile-picture upload for the logged-in account (any role). Unlike
 * /creator/dashboard/upload-avatar (creator-star-scoped), this saves to
 * profiles.avatar_url. Field name: "avatar".
 */
router.post('/me/avatar', verifyToken, handleAvatarMulter(avatarUpload.single('avatar')), async (req, res, next) => {
    try {
        if (!r2.isConfigured()) return res.status(503).json({ error: 'Media storage is not configured yet' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const ext = AVATAR_MIME[req.file.mimetype];
        if (!ext) return res.status(400).json({ error: 'Only JPG, PNG, or WEBP images are allowed' });

        // Magic-byte check — the real content must match the declared type.
        const { fileTypeFromBuffer } = await fileTypePromise;
        const detected = await fileTypeFromBuffer(req.file.buffer);
        if (!detected || detected.mime !== req.file.mimetype) {
            return res.status(400).json({ error: 'File content does not match its declared type' });
        }

        const key = `avatars/profile/${req.user.uid}/${randomUUID()}.${ext}`;
        let url;
        try {
            ({ url } = await r2.uploadBuffer(req.file.buffer, key, req.file.mimetype));
        } catch (err) {
            console.error('[avatar] R2 upload failed:', err.message);
            return res.status(502).json({ error: 'Upload failed, please try again' });
        }

        const updated = await pool.query(
            `UPDATE profiles SET avatar_url = $1, updated_at = now() WHERE id = $2 RETURNING avatar_url`,
            [url, req.user.uid],
        );
        if (updated.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

        res.json({ url });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/profiles
 * Paginated, searchable user list. Admin+ only.
 */
router.get('/', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { search, role: roleFilter } = req.query;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];
        let idx = 1;

        if (search && search.length <= 200) {
            where += ` AND (first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }

        if (roleFilter && ['user', 'admin', 'super_admin'].includes(roleFilter)) {
            where += ` AND role = $${idx++}`;
            params.push(roleFilter);
        }

        const [dataResult, countResult] = await Promise.all([
            pool.query(
                `SELECT id, account_type, first_name, last_name, email, phone, avatar_url, bio, role, created_at
                 FROM profiles ${where}
                 ORDER BY created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*) FROM profiles ${where}`, params),
        ]);

        const total = parseInt(countResult.rows[0].count);

        res.json({
            data: dataResult.rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/profiles/:id
 * Public profile — no email, phone, or role returned.
 * Must be defined BEFORE /:id/role and DELETE /:id to avoid route shadowing.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, account_type, first_name, last_name, avatar_url, bio, created_at
             FROM profiles WHERE id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({ data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/profiles/:id/role
 * Super admin updates any user's role. Invalidates role cache + writes audit log.
 */
router.put('/:id/role', verifyToken, requireRole(['super_admin']), [
    body('role').isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role provided'),
], validate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const before = await pool.query('SELECT role, email FROM profiles WHERE id = $1', [id]);
        if (before.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // ── Privilege escalation guards ──────────────────────────────────

        // 1. Cannot change your own role (prevents self-lockout)
        if (id === req.user.uid) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Cannot change your own role. Another super_admin must do this.',
            });
        }

        // 2. Cannot modify another super_admin's role (peer protection)
        if (before.rows[0].role === 'super_admin') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Cannot modify another super_admin\'s role.',
            });
        }

        // ─────────────────────────────────────────────────────────────────

        const result = await pool.query(
            `UPDATE profiles SET role = $1 WHERE id = $2
             RETURNING id, role, email, first_name`,
            [role, id]
        );

        invalidateCachedRole(id);

        writeAuditLog({
            actorId:     req.user.uid,
            actorEmail:  req.user.email,
            action:      'role_change',
            targetId:    id,
            targetEmail: result.rows[0].email,
            metadata:    { previousRole: before.rows[0].role, newRole: role },
        });

        res.json({ message: 'Role updated successfully', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/profiles/:id
 * Admin or super admin edits any user's profile fields. Writes audit log.
 * Guard: admin cannot edit super_admin profiles.
 */
router.put('/:id', verifyToken, requireRole(['admin', 'super_admin']), updateValidationRules, validate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, phone, avatar_url, bio } = req.body;

        const before = await pool.query(
            'SELECT first_name, last_name, bio, email, role FROM profiles WHERE id = $1',
            [id]
        );
        if (before.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Admin cannot edit super_admin profiles
        if (req.user.role === 'admin' && before.rows[0].role === 'super_admin') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Admins cannot modify super_admin profiles.',
            });
        }

        const result = await pool.query(
            `UPDATE profiles
             SET first_name  = COALESCE($1, first_name),
                 last_name   = COALESCE($2, last_name),
                 phone       = COALESCE($3, phone),
                 avatar_url  = COALESCE($4, avatar_url),
                 bio         = COALESCE($5, bio)
             WHERE id = $6
             RETURNING id, account_type, first_name, last_name, email, phone, avatar_url, bio, role, created_at, updated_at`,
            [first_name, last_name, phone, avatar_url, bio, id]
        );

        writeAuditLog({
            actorId:     req.user.uid,
            actorEmail:  req.user.email,
            action:      'profile_update_by_admin',
            targetId:    id,
            targetEmail: before.rows[0].email,
            metadata:    {
                before: { first_name: before.rows[0].first_name, last_name: before.rows[0].last_name, bio: before.rows[0].bio },
                after:  { first_name, last_name, bio },
            },
        });

        res.json({ message: 'Profile updated', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/profiles/admin/users
 * Super admin creates a user in Firebase + Postgres.
 */
router.post('/admin/users', verifyToken, requireRole(['super_admin']), [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('first_name').trim().notEmpty().withMessage('First name is required'),
    body('last_name').optional().trim(),
    body('role').isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role'),
], validate, async (req, res, next) => {
    if (!firebaseInitialized) {
        return res.status(500).json({ error: 'Server Configuration Error', message: 'Firebase Admin SDK is not initialized.' });
    }

    try {
        const { email, password, first_name, last_name, role } = req.body;

        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${first_name} ${last_name || ''}`.trim(),
        });

        try {
            const result = await pool.query(
                `INSERT INTO profiles (id, account_type, first_name, last_name, email, role)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, account_type, first_name, last_name, email, role, created_at`,
                [userRecord.uid, 'fan', first_name, last_name || '', email, role]
            );

            writeAuditLog({
                actorId:     req.user.uid,
                actorEmail:  req.user.email,
                action:      'admin_create_user',
                targetId:    userRecord.uid,
                targetEmail: email,
                metadata:    { role, first_name, last_name: last_name || '' },
            });

            res.status(201).json({ message: 'User created successfully', data: result.rows[0] });
        } catch (dbError) {
            await admin.auth().deleteUser(userRecord.uid);
            throw dbError;
        }
    } catch (error) {
        if (error.code && error.code.startsWith('auth/')) {
            return res.status(400).json({ error: 'Firebase Auth Error', message: error.message });
        }
        next(error);
    }
});

/**
 * POST /api/profiles/admin/create-creator
 * Admin or super admin onboards a creator directly with a username + password
 * (no real email). A placeholder email is synthesised purely to satisfy
 * Firebase's email/password requirement; it never receives mail and is never
 * shown to the admin as something to think about.
 *
 * Creates: Firebase auth user, a `creator` profile, and a star owned by them.
 */
const SYNTHETIC_EMAIL_DOMAIN = 'creators.clipixx.local';
const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;
const STAR_CATEGORIES = ['Actor', 'Athlete', 'Creator', 'Musician'];
const DEFAULT_CREATOR_IMAGE = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=600';

router.post('/admin/create-creator', verifyToken, requireRole(['admin', 'super_admin']), [
    body('username')
        .trim()
        .customSanitizer((v) => (typeof v === 'string' ? v.toLowerCase() : v))
        .matches(USERNAME_RE).withMessage('Username must be 3-30 chars: lowercase letters, numbers, dot, dash or underscore'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('first_name').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }),
    body('last_name').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }),
    body('star_name').trim().notEmpty().withMessage('Star name is required').isLength({ max: 200 }),
    body('category').isIn(STAR_CATEGORIES).withMessage('Invalid category'),
    body('price').isInt({ gt: 0 }).withMessage('Price must be a positive integer'),
    body('image_url').optional({ values: 'falsy' }).trim().isURL().withMessage('Image URL must be a valid URL').isLength({ max: 2048 }),
], validate, async (req, res, next) => {
    if (!firebaseInitialized) {
        return res.status(500).json({ error: 'Server Configuration Error', message: 'Firebase Admin SDK is not initialized.' });
    }

    try {
        const { username, password, first_name, last_name, star_name, category, price, image_url } = req.body;
        const syntheticEmail = `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;

        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email: syntheticEmail,
                password,
                displayName: `${first_name} ${last_name}`.trim(),
            });
        } catch (fbError) {
            if (fbError.code === 'auth/email-already-exists') {
                // Translate to username language — never expose the synthetic email.
                return res.status(409).json({ error: 'That username is already taken. Try another.' });
            }
            throw fbError;
        }

        // From here on, if any DB step fails we must clean up the orphaned Firebase user.
        try {
            const profileResult = await pool.query(
                `INSERT INTO profiles (id, account_type, first_name, last_name, email, role)
                 VALUES ($1, 'creator', $2, $3, $4, 'user')
                 RETURNING id`,
                [userRecord.uid, first_name, last_name, syntheticEmail]
            );

            const starResult = await pool.query(
                `INSERT INTO stars (name, category, image_url, price, owner_id)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [star_name, category, image_url || DEFAULT_CREATOR_IMAGE, price, userRecord.uid]
            );

            writeAuditLog({
                actorId:     req.user.uid,
                actorEmail:  req.user.email,
                action:      'admin_create_creator',
                targetId:    userRecord.uid,
                targetEmail: syntheticEmail,
                metadata:    { username, star_name, category, price },
            });

            return res.status(201).json({
                message: 'Creator created successfully',
                username,
                profile_id: profileResult.rows[0].id,
                star_id: starResult.rows[0].id,
            });
        } catch (dbError) {
            // Roll back the Firebase user so we don't leave an orphaned auth account.
            await admin.auth().deleteUser(userRecord.uid).catch(() => {});
            throw dbError;
        }
    } catch (error) {
        if (error.code && error.code.startsWith('auth/')) {
            return res.status(400).json({ error: 'Firebase Auth Error', message: error.message });
        }
        next(error);
    }
});

/**
 * POST /api/profiles/:id/reset-password
 * Admin-mediated password reset for accounts with no real inbox (the
 * username-based creator accounts can't use Firebase's email reset flow).
 */
router.post('/:id/reset-password', verifyToken, requireRole(['admin', 'super_admin']), [
    body('new_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], validate, async (req, res, next) => {
    if (!firebaseInitialized) {
        return res.status(500).json({ error: 'Server Configuration Error', message: 'Firebase Admin SDK is not initialized.' });
    }

    try {
        const { id } = req.params;
        const { new_password } = req.body;

        const target = await pool.query('SELECT email, role FROM profiles WHERE id = $1', [id]);
        if (target.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }

        // Admins cannot reset a super_admin's password (peer/privilege protection).
        if (req.user.role === 'admin' && target.rows[0].role === 'super_admin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Admins cannot reset a super_admin password.' });
        }

        await admin.auth().updateUser(id, { password: new_password });

        writeAuditLog({
            actorId:     req.user.uid,
            actorEmail:  req.user.email,
            action:      'admin_reset_password',
            targetId:    id,
            targetEmail: target.rows[0].email,
            metadata:    {},
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ error: 'Not Found', message: 'Auth account not found' });
        }
        if (error.code && error.code.startsWith('auth/')) {
            return res.status(400).json({ error: 'Firebase Auth Error', message: error.message });
        }
        next(error);
    }
});

/**
 * DELETE /api/profiles/:id
 * Super admin deletes a user from Firebase + Postgres.
 * Invalidates role cache + writes audit log.
 */
router.delete('/:id', verifyToken, requireRole(['super_admin']), async (req, res, next) => {
    if (!firebaseInitialized) {
        return res.status(500).json({ error: 'Server Configuration Error', message: 'Firebase Admin SDK is not initialized.' });
    }

    try {
        const { id } = req.params;

        if (id === req.user.uid) {
            return res.status(400).json({ error: 'Cannot delete your own super admin account through this method.' });
        }

        const target = await pool.query(
            'SELECT email, first_name, last_name, role FROM profiles WHERE id = $1',
            [id]
        );
        if (target.rows.length === 0) {
            return res.status(404).json({ error: 'User profile not found in database.' });
        }

        // Cannot delete super_admin accounts through the API
        if (target.rows[0].role === 'super_admin') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Cannot delete a super_admin account. Demote the user first via direct database access.',
            });
        }

        await pool.query('DELETE FROM profiles WHERE id = $1', [id]);

        try {
            await admin.auth().deleteUser(id);
        } catch (fbError) {
            if (fbError.code === 'auth/user-not-found') {
                console.warn(`Firebase user ${id} already deleted or not found.`);
            } else {
                console.error(`Failed to delete Firebase Auth user ${id}:`, fbError);
            }
        }

        invalidateCachedRole(id);

        writeAuditLog({
            actorId:     req.user.uid,
            actorEmail:  req.user.email,
            action:      'user_delete',
            targetId:    id,
            targetEmail: target.rows[0].email,
            metadata:    { deletedUser: target.rows[0] },
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
