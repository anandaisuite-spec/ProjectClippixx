const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

/**
 * Creator onboarding.
 *
 * Schema note: this project has no `users` table or `creator` role. A creator
 * is a `profiles` row with account_type = 'creator'; their public profile is a
 * `stars` row linked by stars.owner_id = profiles.id. So onboarding state lives
 * on the `stars` row, and pricing_tiers.creator_id references stars.id.
 *
 * resolveCreatorStar() gates on account_type = 'creator' and auto-provisions a
 * stars row the first time a creator onboards (they may not have one yet).
 */

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Marathi', 'Other'];
const CATEGORY_OPTIONS = ['Actor', 'Musician', 'Comedian', 'Athlete', 'Influencer', 'YouTuber', 'Podcaster', 'Other'];

// Username: 3–50 chars, lowercase letters / numbers / underscores only.
const USERNAME_RE = /^[a-z0-9_]{3,50}$/;

/**
 * Ensure the caller is a creator and return their star row (creating one if
 * needed). Returns { star } on success or { status, error } on failure.
 */
async function resolveCreatorStar(uid) {
    const profileRes = await pool.query(
        'SELECT id, account_type, first_name, last_name FROM profiles WHERE id = $1',
        [uid],
    );
    if (profileRes.rows.length === 0) {
        return { status: 404, error: 'Profile not found' };
    }
    const profile = profileRes.rows[0];
    if (profile.account_type !== 'creator') {
        return { status: 403, error: 'Only creator accounts can access onboarding' };
    }

    const existing = await pool.query(
        'SELECT * FROM stars WHERE owner_id = $1 ORDER BY created_at LIMIT 1',
        [uid],
    );
    if (existing.rows.length > 0) {
        return { star: existing.rows[0] };
    }

    // Auto-provision a minimal star for this creator on first onboarding.
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'New Creator';
    const created = await pool.query(
        `INSERT INTO stars (name, category, image_url, price, owner_id, onboarding_completed)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING *`,
        [fullName, 'Other', '', 0, uid],
    );
    return { star: created.rows[0] };
}

/** Wrap a handler so it resolves the creator's star and short-circuits on error. */
function withCreatorStar(handler) {
    return async (req, res, next) => {
        try {
            const result = await resolveCreatorStar(req.user.uid);
            if (result.error) {
                return res.status(result.status).json({ error: result.error });
            }
            req.creatorStar = result.star;
            return handler(req, res, next);
        } catch (err) {
            next(err);
        }
    };
}

// ─── GET /api/creator/check-username?username=... (public) ────────────────────
// Available if it's well-formed AND not taken by another star.
router.get('/check-username', async (req, res, next) => {
    try {
        const username = String(req.query.username || '').toLowerCase().trim();
        if (!USERNAME_RE.test(username)) {
            return res.json({ available: false, reason: 'invalid_format' });
        }
        const taken = await pool.query('SELECT 1 FROM stars WHERE username = $1 LIMIT 1', [username]);
        res.json({ available: taken.rows.length === 0 });
    } catch (err) {
        next(err);
    }
});

/**
 * Derive which step the creator should resume on, based on what's been saved.
 * 0 = Profile, 1 = Pricing, 2 = Availability, 3 = Done.
 */
async function deriveCurrentStep(star) {
    if (!star.category || star.category === 'Other' || !star.bio) return 0;
    const tiers = await pool.query('SELECT COUNT(*)::int AS n FROM pricing_tiers WHERE creator_id = $1', [star.id]);
    if (tiers.rows[0].n === 0) return 1;
    return 2;
}

// ─── GET /api/creator/onboarding-status ──────────────────────────────────────
router.get('/onboarding-status', verifyToken, withCreatorStar(async (req, res) => {
    const star = req.creatorStar;
    const current_step = star.onboarding_completed ? 3 : await deriveCurrentStep(star);
    res.json({
        onboarding_completed: Boolean(star.onboarding_completed),
        current_step,
        star_id: star.id,
    });
}));

// ─── POST /api/creator/onboarding/profile ────────────────────────────────────
router.post(
    '/onboarding/profile',
    verifyToken,
    [
        body('username').trim().toLowerCase().matches(USERNAME_RE)
            .withMessage('Username must be 3–50 chars: lowercase letters, numbers, underscores'),
        body('bio').trim().isLength({ max: 500 }).withMessage('Bio must be 500 characters or fewer'),
        body('category').trim().notEmpty().withMessage('Category is required')
            .isIn(CATEGORY_OPTIONS).withMessage('Invalid category'),
        body('languages').optional().isArray().withMessage('Languages must be an array'),
        body('languages.*').optional().isIn(LANGUAGE_OPTIONS).withMessage('Invalid language'),
    ],
    validate,
    withCreatorStar(async (req, res, next) => {
        const { username, bio = '', category, languages = [] } = req.body;
        // Guard against taking a username owned by a different star.
        const clash = await pool.query(
            'SELECT 1 FROM stars WHERE username = $1 AND id <> $2 LIMIT 1',
            [username, req.creatorStar.id],
        );
        if (clash.rows.length > 0) {
            return res.status(409).json({ error: 'That username is already taken' });
        }
        try {
            const updated = await pool.query(
                `UPDATE stars SET username = $1, bio = $2, category = $3, languages = $4, updated_at = now()
                 WHERE id = $5 RETURNING id, username, bio, category, languages`,
                [username, bio, category, languages, req.creatorStar.id],
            );
            res.json({ success: true, data: updated.rows[0] });
        } catch (err) {
            if (err.code === '23505') { // unique_violation race
                return res.status(409).json({ error: 'That username is already taken' });
            }
            next(err);
        }
    }),
);

// ─── POST /api/creator/onboarding/pricing ────────────────────────────────────
router.post(
    '/onboarding/pricing',
    verifyToken,
    [
        body('tiers').isArray({ min: 1, max: 5 }).withMessage('Add between 1 and 5 pricing tiers'),
        body('tiers.*.tier_name').trim().notEmpty().withMessage('Tier name is required').isLength({ max: 100 }),
        body('tiers.*.description').optional({ values: 'falsy' }).isLength({ max: 200 }).withMessage('Description max 200 chars'),
        body('tiers.*.price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
        body('tiers.*.delivery_days').isInt({ min: 1, max: 30 }).withMessage('Delivery days must be between 1 and 30'),
    ],
    validate,
    withCreatorStar(async (req, res, next) => {
        const { tiers } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Replace strategy: clear existing tiers, insert the new set.
            await client.query('DELETE FROM pricing_tiers WHERE creator_id = $1', [req.creatorStar.id]);
            const inserted = [];
            for (const t of tiers) {
                const r = await client.query(
                    `INSERT INTO pricing_tiers (creator_id, tier_name, description, price, delivery_days)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [req.creatorStar.id, t.tier_name, t.description || null, t.price, t.delivery_days],
                );
                inserted.push(r.rows[0]);
            }
            await client.query('COMMIT');
            res.json({ success: true, data: inserted });
        } catch (err) {
            await client.query('ROLLBACK');
            next(err);
        } finally {
            client.release();
        }
    }),
);

// ─── POST /api/creator/onboarding/availability ───────────────────────────────
router.post(
    '/onboarding/availability',
    verifyToken,
    [
        body('turnaround_days').isInt({ min: 1, max: 30 }).withMessage('Turnaround must be between 1 and 30 days'),
        body('accepting_bookings').isBoolean().withMessage('accepting_bookings must be a boolean').toBoolean(),
    ],
    validate,
    withCreatorStar(async (req, res) => {
        const { turnaround_days, accepting_bookings } = req.body;
        const updated = await pool.query(
            `UPDATE stars SET turnaround_days = $1, accepting_bookings = $2, updated_at = now()
             WHERE id = $3 RETURNING id, turnaround_days, accepting_bookings`,
            [turnaround_days, accepting_bookings, req.creatorStar.id],
        );
        res.json({ success: true, data: updated.rows[0] });
    }),
);

// ─── POST /api/creator/onboarding/complete ───────────────────────────────────
router.post('/onboarding/complete', verifyToken, withCreatorStar(async (req, res) => {
    await pool.query(
        'UPDATE stars SET onboarding_completed = true, updated_at = now() WHERE id = $1',
        [req.creatorStar.id],
    );
    res.json({ success: true });
}));

module.exports = router;
