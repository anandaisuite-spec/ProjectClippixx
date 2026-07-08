const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { enrichCreator, tmdbConfigured } = require('../services/creatorEnrichment');
const { generateCreatorSummary } = require('../services/profileSummaryAI');
const { calculateVerificationScore } = require('../services/verificationScore');

/**
 * GET /api/admin/stats
 * Live DB counts for the admin dashboard.
 * Accessible by: admin, super_admin
 */
router.get('/stats', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const [usersResult, starsResult, applicationsResult, feedbackResult, adminsResult, verificationsResult] = await Promise.all([
            pool.query(
                `SELECT
                   COUNT(*)                                           AS total_users,
                   COUNT(*) FILTER (WHERE account_type = 'creator') AS total_creators
                 FROM profiles`
            ),
            pool.query(`SELECT COUNT(*) AS total_stars FROM stars`),
            pool.query(`SELECT COUNT(*) AS pending FROM creator_applications WHERE status = 'pending'`),
            pool.query(`SELECT COUNT(*) AS total FROM feedback`),
            pool.query(`SELECT COUNT(*) AS total_admins FROM profiles WHERE role IN ('admin', 'super_admin')`),
            pool.query(`SELECT COUNT(*) AS pending FROM stars WHERE verification_status = 'pending'`),
        ]);

        res.json({
            data: {
                totalUsers:           parseInt(usersResult.rows[0].total_users),
                totalCreators:        parseInt(usersResult.rows[0].total_creators),
                totalStars:           parseInt(starsResult.rows[0].total_stars),
                pendingApplications:  parseInt(applicationsResult.rows[0].pending),
                pendingFeedback:      parseInt(feedbackResult.rows[0].total),
                totalAdmins:          parseInt(adminsResult.rows[0].total_admins),
                pendingVerifications: parseInt(verificationsResult.rows[0].pending),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/audit-logs
 * Paginated audit log. Admin + super admin.
 *
 * Query params:
 *   page      (default 1)
 *   limit     (default 50, max 100)
 *   action    (filter by action type)
 *   actor_id  (filter by actor uid)
 */
router.get('/audit-logs', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { action: actionFilter, actor_id } = req.query;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const VALID_ACTIONS = ['role_change', 'user_delete', 'admin_create_user', 'profile_update_by_admin'];

        let where = 'WHERE 1=1';
        const params = [];
        let idx = 1;

        if (actionFilter && VALID_ACTIONS.includes(actionFilter)) {
            where += ` AND action = $${idx++}`;
            params.push(actionFilter);
        }

        if (actor_id) {
            where += ` AND actor_id = $${idx++}`;
            params.push(actor_id);
        }

        const [dataResult, countResult] = await Promise.all([
            pool.query(
                `SELECT id, actor_id, actor_email, action, target_id, target_email, metadata, created_at
                 FROM audit_logs ${where}
                 ORDER BY created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*) FROM audit_logs ${where}`, params),
        ]);

        const total = parseInt(countResult.rows[0].count);

        res.json({
            data: dataResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/audit-logs/:id
 * Edit an existing audit log entry. Admin + super admin.
 *
 * WARNING: Audit logs are normally immutable. This is an intentional, direct
 * overwrite (not a versioned edit) — no "this was edited" marker is recorded.
 * It removes the tamper-proof guarantee audit logs normally provide.
 *
 * Editable fields: action, target_email, metadata.
 */
const EDITABLE_AUDIT_ACTIONS = [
    'role_change', 'user_delete', 'admin_create_user', 'profile_update_by_admin',
    'application_status_change', 'mfa_enabled', 'mfa_disabled', 'mfa_backup_regenerated',
    'admin_create_creator', 'admin_reset_password', 'audit_log_edited', 'audit_log_deleted',
];

router.put('/audit-logs/:id', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, target_email, metadata } = req.body;

        // Validate inputs that are present.
        if (action !== undefined && !EDITABLE_AUDIT_ACTIONS.includes(action)) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid action value' });
        }
        let metadataValue;
        if (metadata !== undefined) {
            if (typeof metadata === 'string') {
                try { metadataValue = JSON.parse(metadata); }
                catch { return res.status(400).json({ error: 'Bad Request', message: 'Details must be valid JSON' }); }
            } else if (typeof metadata === 'object' && metadata !== null) {
                metadataValue = metadata;
            } else {
                return res.status(400).json({ error: 'Bad Request', message: 'Details must be a JSON object' });
            }
        }

        // Build a partial update from only the provided fields.
        const sets = [];
        const params = [];
        let idx = 1;
        if (action !== undefined)       { sets.push(`action = $${idx++}`);       params.push(action); }
        if (target_email !== undefined) { sets.push(`target_email = $${idx++}`); params.push(target_email || null); }
        if (metadataValue !== undefined){ sets.push(`metadata = $${idx++}`);     params.push(JSON.stringify(metadataValue)); }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'No editable fields provided' });
        }

        params.push(id);
        const updated = await pool.query(
            `UPDATE audit_logs SET ${sets.join(', ')} WHERE id = $${idx}
             RETURNING id, actor_id, actor_email, action, target_id, target_email, metadata, created_at`,
            params
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Audit log entry not found' });
        }

        res.json({ data: updated.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/audit-logs/:id
 * Hard-delete an audit log entry. Admin + super admin.
 *
 * WARNING: direct hard delete — the removal is NOT itself recorded.
 */
router.delete('/audit-logs/:id', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;

        const deleted = await pool.query(`DELETE FROM audit_logs WHERE id = $1 RETURNING id`, [id]);
        if (deleted.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Audit log entry not found' });
        }

        res.json({ data: { id }, message: 'Audit log entry deleted.' });
    } catch (error) {
        next(error);
    }
});

/**
 * Build verification-score signals from a star's current record + enrichment.
 */
function buildSignals(star, tmdbFound) {
    return {
        tmdbFound: Boolean(tmdbFound),
        hasVerifiedSocialBadge: Boolean(star.is_verified),
        governmentIdUploaded: Boolean(star.identity_proof_url),
        agencyEmailVerified: star.ownership_method === 'email',
        ownershipCodeConfirmed: Boolean(star.ownership_method) && star.verification_status === 'approved',
    };
}

/**
 * POST /api/admin/creators/:starId/enrich
 * Enrich a creator profile from TMDB / Wikidata / Wikipedia + AI bio + score.
 * Returns a PREVIEW only — nothing is saved here.
 */
router.post('/creators/:starId/enrich', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { starId } = req.params;
        const { name, tmdbUrl } = req.body;

        const starResult = await pool.query('SELECT * FROM stars WHERE id = $1', [starId]);
        if (starResult.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Creator not found' });
        }
        const star = starResult.rows[0];
        const searchName = (name && name.trim()) || star.name;

        // Enrich from open sources (graceful — each source can be null/empty).
        const { preview, facts, sources, tmdbFound } = await enrichCreator({ name: searchName, tmdbUrl });

        // AI (or template) bio.
        const { bio, source: bioSource } = await generateCreatorSummary(facts);
        preview.bio = bio;

        // Score from current signals + enrichment.
        const verificationScore = calculateVerificationScore(buildSignals(star, tmdbFound));

        res.json({
            preview,
            verification_score: verificationScore,
            sources,
            bio_source: bioSource,
            tmdb_configured: tmdbConfigured(),
            message: tmdbFound
                ? 'Enrichment complete.'
                : 'No TMDB match found — score based on existing signals only.',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/creators/:starId/enrich/confirm
 * Save a confirmed enrichment preview to the star record. Sets is_verified
 * when the score reaches the auto-verify threshold (>= 60).
 */
router.post('/creators/:starId/enrich/confirm', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { starId } = req.params;
        const { preview, verificationScore } = req.body;

        if (!preview || typeof preview !== 'object') {
            return res.status(400).json({ error: 'Bad Request', message: 'preview object is required' });
        }

        const exists = await pool.query('SELECT id FROM stars WHERE id = $1', [starId]);
        if (exists.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Creator not found' });
        }

        const score = Number.isInteger(verificationScore?.score) ? verificationScore.score : null;
        const autoVerify = score != null && score >= 60;

        const sets = [];
        const params = [];
        let i = 1;
        const set = (col, val) => { sets.push(`${col} = $${i++}`); params.push(val); };

        if (typeof preview.bio === 'string' && preview.bio.trim()) set('bio', preview.bio.trim().slice(0, 5000));
        if (preview.photo_url) set('image_url', String(preview.photo_url).slice(0, 2048));
        if (preview.occupation) set('occupation', String(preview.occupation).slice(0, 200));
        if (Number.isInteger(preview.tmdb_id)) set('tmdb_id', preview.tmdb_id);
        if (Array.isArray(preview.known_for)) set('known_for', JSON.stringify(preview.known_for));
        if (score != null) set('verification_score', score);
        if (autoVerify) {
            set('is_verified', true);
            set('verification_status', 'approved');
            set('verified_at', new Date().toISOString());
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Nothing to save' });
        }

        params.push(starId);
        const updated = await pool.query(
            `UPDATE stars SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}
             RETURNING id, name, bio, image_url, occupation, tmdb_id, known_for, verification_score, is_verified, verification_status`,
            params
        );

        res.json({
            data: updated.rows[0],
            auto_verified: autoVerify,
            message: autoVerify ? 'Saved and auto-verified.' : 'Saved.',
        });
    } catch (error) {
        next(error);
    }
});

// ─── Booking management ──────────────────────────────────────────────────────
// NOTE: adminLimiter is applied to the whole /api/admin mount in server.js, so
// it covers these routes. 'rejected' is NOT a valid bookings status — the DB
// CHECK allows pending/accepted/in_progress/delivered/cancelled (declines are
// modelled as 'cancelled').

const BOOKING_STATUSES = ['pending', 'accepted', 'in_progress', 'delivered', 'cancelled'];

/**
 * GET /api/admin/bookings
 * All bookings across all creators/fans, newest first.
 * Query: page (default 1), limit (default 20, max 100),
 *        status (one of BOOKING_STATUSES),
 *        search (fan email / fan name / creator name, ILIKE)
 * Accessible by: admin, super_admin
 */
router.get('/bookings', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        const { status, search } = req.query;

        const where = ['1=1'];
        const params = [];
        let idx = 1;

        if (status && BOOKING_STATUSES.includes(status)) {
            where.push(`b.status = $${idx++}`);
            params.push(status);
        }
        if (search && String(search).trim()) {
            where.push(`(p.email ILIKE $${idx} OR b.fan_name ILIKE $${idx} OR s.name ILIKE $${idx})`);
            params.push(`%${String(search).trim()}%`);
            idx++;
        }
        const whereClause = `WHERE ${where.join(' AND ')}`;

        const baseFrom = `
            FROM bookings b
            LEFT JOIN profiles p ON p.id = b.fan_id
            LEFT JOIN stars s ON s.id = b.creator_id
        `;

        const [dataRes, countRes] = await Promise.all([
            pool.query(
                `SELECT b.id, b.status, b.tier_name, b.tier_price, b.occasion,
                        b.is_gift, b.gift_recipient_name, b.created_at, b.updated_at,
                        b.fan_name,
                        p.email AS fan_email, p.first_name AS fan_first_name, p.last_name AS fan_last_name,
                        s.id AS creator_id, s.name AS creator_name
                 ${baseFrom} ${whereClause}
                 ORDER BY b.created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...params, limit, offset],
            ),
            pool.query(`SELECT COUNT(*) ${baseFrom} ${whereClause}`, params),
        ]);

        const total = parseInt(countRes.rows[0].count, 10);
        res.json({
            data: dataRes.rows,
            pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/bookings/:id
 * Full booking detail (all booking columns + fan + creator info).
 * Accessible by: admin, super_admin
 */
router.get('/bookings/:id', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT b.*,
                    p.email AS fan_email, p.first_name AS fan_first_name, p.last_name AS fan_last_name,
                    s.name AS creator_name, s.username AS creator_username, s.category AS creator_category
             FROM bookings b
             LEFT JOIN profiles p ON p.id = b.fan_id
             LEFT JOIN stars s ON s.id = b.creator_id
             WHERE b.id = $1`,
            [req.params.id],
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
        res.json({ data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/bookings/:id/status
 * Body: { status } — one of BOOKING_STATUSES.
 * Accessible by: admin, super_admin
 */
router.patch('/bookings/:id/status', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!BOOKING_STATUSES.includes(status)) {
            return res.status(400).json({ error: `status must be one of: ${BOOKING_STATUSES.join(', ')}` });
        }
        const result = await pool.query(
            `UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2
             RETURNING id, status, updated_at`,
            [status, req.params.id],
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
        res.json({ data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
