const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

const VERIFICATION_COLUMNS = `
  id, name, owner_id, platform, follower_count,
  instagram_url, twitter_url, youtube_url, tiktok_url,
  identity_proof_url, identity_proof_type,
  ownership_code, ownership_method,
  is_verified, verification_status, verification_notes, verified_at
`;

/**
 * A short, human-readable ownership proof code (e.g. CLIPP-A3F9C2). The creator
 * places this in their bio / story / email reply so an admin can confirm they
 * actually control the social account.
 */
function generateOwnershipCode() {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CLIPP-${suffix}`;
}

/**
 * Resolve the single star a creator may submit verification for.
 * Prefers an explicit star_id (validated against ownership); otherwise falls
 * back to the one star this user already owns. Returns { error, status } on
 * failure, or { star } on success.
 */
async function resolveStar(req, starId) {
    if (starId) {
        const r = await pool.query('SELECT id, owner_id FROM stars WHERE id = $1', [starId]);
        if (r.rows.length === 0) return { status: 404, error: 'Star not found' };
        const star = r.rows[0];
        if (star.owner_id && star.owner_id !== req.user.uid && req.user.role !== 'super_admin') {
            return { status: 403, error: 'Not your star' };
        }
        return { star };
    }
    // No star_id provided — use the star this creator owns.
    const owned = await pool.query('SELECT id, owner_id FROM stars WHERE owner_id = $1 ORDER BY created_at LIMIT 1', [req.user.uid]);
    if (owned.rows.length === 0) {
        return { status: 404, error: 'No creator profile linked to your account. Contact support to get one set up.' };
    }
    return { star: owned.rows[0] };
}

/**
 * POST /api/verification/submit
 * Creator submits platform + social links + identity proof for a star they own.
 * A fresh ownership proof code is generated and returned so the creator can
 * place it in their bio/story/email. Status is NOT moved to pending here — that
 * happens once the creator confirms they've posted the code (notify-admin).
 */
router.post('/submit', verifyToken, requireRole(['user', 'admin']), [
    body('star_id').optional({ values: 'falsy' }).isUUID().withMessage('Valid star_id required'),
    body('platform').optional({ values: 'falsy' }).isIn(['instagram', 'youtube', 'tiktok', 'twitter']).withMessage('Invalid platform'),
    body('follower_count').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Follower count must be a non-negative number'),
    body('identity_proof_url').trim().notEmpty().isURL().withMessage('Valid identity proof URL required').isLength({ max: 2048 }),
    body('identity_proof_type').optional({ values: 'falsy' }).isIn(['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'other']).withMessage('Invalid ID type'),
    body('instagram_url').optional({ values: 'falsy' }).isURL().withMessage('Invalid Instagram URL').isLength({ max: 2048 }),
    body('twitter_url').optional({ values: 'falsy' }).isURL().withMessage('Invalid Twitter URL').isLength({ max: 2048 }),
    body('youtube_url').optional({ values: 'falsy' }).isURL().withMessage('Invalid YouTube URL').isLength({ max: 2048 }),
    body('tiktok_url').optional({ values: 'falsy' }).isURL().withMessage('Invalid TikTok URL').isLength({ max: 2048 }),
    body('consent').equals('true').withMessage('You must confirm the ownership consent to submit').toBoolean(),
], validate, async (req, res, next) => {
    try {
        const {
            star_id, platform, follower_count,
            identity_proof_url, identity_proof_type,
            instagram_url, twitter_url, youtube_url, tiktok_url,
        } = req.body;

        const resolved = await resolveStar(req, star_id);
        if (resolved.error) {
            return res.status(resolved.status).json({ error: resolved.status === 403 ? 'Forbidden' : 'Not Found', message: resolved.error });
        }

        // Generate a fresh ownership code on every (re)submission.
        const ownershipCode = generateOwnershipCode();

        // Digital consent — captured at submission time.
        const consentText =
            'I confirm that I am the owner, manager, or authorized representative of this account, and that the information I have provided is accurate.';

        const result = await pool.query(
            `UPDATE stars SET
                owner_id            = COALESCE(owner_id, $1),
                platform            = $2,
                follower_count      = $3,
                identity_proof_url  = $4,
                identity_proof_type = $5,
                instagram_url       = $6,
                twitter_url         = $7,
                youtube_url         = $8,
                tiktok_url          = $9,
                ownership_code      = $10,
                ownership_method    = NULL,
                verification_notes  = NULL,
                consent_ip          = $12,
                consent_timestamp   = now(),
                consent_text        = $13
             WHERE id = $11
             RETURNING ${VERIFICATION_COLUMNS}`,
            [
                req.user.uid,
                platform || null,
                follower_count != null && follower_count !== '' ? Number(follower_count) : null,
                identity_proof_url,
                identity_proof_type || null,
                instagram_url || null,
                twitter_url || null,
                youtube_url || null,
                tiktok_url || null,
                ownershipCode,
                resolved.star.id,
                req.ip || null,
                consentText,
            ]
        );

        res.json({ message: 'Verification details saved. Add your ownership code, then notify the admin.', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/verification/notify-admin
 * Creator confirms they've placed the ownership code (bio / story / email) and
 * asks an admin to review. Records the chosen method and moves status to pending.
 */
router.post('/notify-admin', verifyToken, requireRole(['user', 'admin']), [
    body('star_id').optional({ values: 'falsy' }).isUUID().withMessage('Valid star_id required'),
    body('ownership_method').isIn(['bio', 'story', 'email']).withMessage('Choose how you proved ownership'),
], validate, async (req, res, next) => {
    try {
        const resolved = await resolveStar(req, req.body.star_id);
        if (resolved.error) {
            return res.status(resolved.status).json({ error: resolved.status === 403 ? 'Forbidden' : 'Not Found', message: resolved.error });
        }

        // Must have submitted details (and therefore have an ownership code) first.
        const check = await pool.query('SELECT ownership_code, identity_proof_url FROM stars WHERE id = $1', [resolved.star.id]);
        if (!check.rows[0].ownership_code || !check.rows[0].identity_proof_url) {
            return res.status(400).json({ error: 'Bad Request', message: 'Submit your verification details first.' });
        }

        const result = await pool.query(
            `UPDATE stars SET
                ownership_method    = $1,
                verification_status = 'pending',
                verification_notes  = NULL
             WHERE id = $2
             RETURNING ${VERIFICATION_COLUMNS}`,
            [req.body.ownership_method, resolved.star.id]
        );

        res.json({ message: 'Admin notified. Your verification is now pending review.', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/verification/status
 * Creator checks verification status for the star they own.
 * Returns a single object (the creator's star) or null.
 */
router.get('/status', verifyToken, requireRole(['user', 'admin']), async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT ${VERIFICATION_COLUMNS} FROM stars WHERE owner_id = $1 ORDER BY created_at LIMIT 1`,
            [req.user.uid]
        );
        res.json({ data: result.rows[0] || null });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/verification/pending
 * Admin lists all stars awaiting verification, with the star's display fields,
 * the submission details, and the owner's profile so the reviewer has full
 * context to confirm (1) the profile is public + matches, and (2) the ownership
 * code appears in their bio/story/email.
 */
router.get('/pending', verifyToken, requireRole(['admin']), async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT
                s.id, s.name, s.category, s.image_url, s.owner_id,
                s.platform, s.follower_count,
                s.instagram_url, s.twitter_url, s.youtube_url, s.tiktok_url,
                s.identity_proof_url, s.identity_proof_type,
                s.ownership_code, s.ownership_method,
                s.is_verified, s.verification_status,
                s.verification_notes, s.verified_at,
                p.email      AS owner_email,
                p.first_name AS owner_first_name,
                p.last_name  AS owner_last_name
             FROM stars s
             LEFT JOIN profiles p ON p.id = s.owner_id
             WHERE s.verification_status = 'pending'
             ORDER BY s.name`
        );
        res.json({ data: result.rows });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/verification/:starId/approve
 * Admin approves a creator: sets badge + approved status.
 */
router.patch('/:starId/approve', verifyToken, requireRole(['admin']), async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE stars SET
                is_verified = true,
                verification_status = 'approved',
                verification_notes = NULL,
                verified_at = now()
             WHERE id = $1
             RETURNING ${VERIFICATION_COLUMNS}`,
            [req.params.starId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Star not found' });
        }
        res.json({ message: 'Creator approved', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/verification/:starId/reject
 * Admin rejects a creator with an optional reason note.
 */
router.patch('/:starId/reject', verifyToken, requireRole(['admin']), [
    body('notes').optional().trim().isLength({ max: 2000 }),
], validate, async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE stars SET
                is_verified = false,
                verification_status = 'rejected',
                verification_notes = $1,
                verified_at = NULL
             WHERE id = $2
             RETURNING ${VERIFICATION_COLUMNS}`,
            [req.body.notes || null, req.params.starId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Star not found' });
        }
        res.json({ message: 'Creator rejected', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
