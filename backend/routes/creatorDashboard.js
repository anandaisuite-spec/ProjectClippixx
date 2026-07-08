const express = require('express');
const router = express.Router();
const multer = require('multer');
const { randomUUID } = require('crypto');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { createNotification, sendVideoReadyEmail } = require('../services/notify');
const r2 = require('../services/r2');

// file-type is ESM-only; load it once via dynamic import (works from CJS).
const fileTypePromise = import('file-type');

/**
 * Magic-byte check: the buffer's REAL content type must match the mimetype the
 * client declared in the multipart header. Blocks renamed/spoofed files (e.g.
 * an executable uploaded with a fake image/png header).
 */
async function magicBytesMatch(file) {
    const { fileTypeFromBuffer } = await fileTypePromise;
    const detected = await fileTypeFromBuffer(file.buffer);
    return Boolean(detected && detected.mime === file.mimetype);
}

// In-memory uploads (no temp disk files). Per-route size limits are enforced
// below via dedicated multer instances.
const memUpload = (maxBytes) => multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes } });
const uploadImage5 = memUpload(5 * 1024 * 1024);    // avatars
const uploadImage10 = memUpload(10 * 1024 * 1024);  // covers
const uploadGallery = memUpload(100 * 1024 * 1024); // gallery (images or video)

const IMAGE_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const VIDEO_MIME = { 'video/mp4': 'mp4', 'video/quicktime': 'mov' };

// Multer errors (e.g. file too large) → clean 400 instead of a crash.
function handleMulter(mw) {
    return (req, res, next) => mw(req, res, (err) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : (err.message || 'Upload failed');
            return res.status(400).json({ error: msg });
        }
        next();
    });
}

// A Supabase storage path looks like "{bookingId}/{filename}" (no scheme). An
// external link starts with http(s). When file upload (Method B) is wired up,
// stored paths flow through this check to produce signed URLs.
function isExternalLink(value) {
    return /^https?:\/\//i.test(value || '');
}

/**
 * Creator dashboard — stats, bookings management, earnings.
 *
 * Schema note (same as onboarding): a creator is a `profiles` row with
 * account_type = 'creator'; their public profile is a `stars` row linked by
 * stars.owner_id = profiles.id. Bookings reference stars.id as creator_id.
 *
 * resolveCreatorStar() gates every route on account_type = 'creator' and
 * returns the caller's star (without auto-provisioning — the dashboard assumes
 * onboarding already created one; if not, callers get an empty dashboard).
 */
async function resolveCreatorStar(uid) {
    const profileRes = await pool.query(
        'SELECT account_type FROM profiles WHERE id = $1',
        [uid],
    );
    if (profileRes.rows.length === 0) return { status: 404, error: 'Profile not found' };
    if (profileRes.rows[0].account_type !== 'creator') {
        return { status: 403, error: 'Only creator accounts can access the dashboard' };
    }
    const starRes = await pool.query(
        'SELECT * FROM stars WHERE owner_id = $1 ORDER BY created_at LIMIT 1',
        [uid],
    );
    if (starRes.rows.length === 0) {
        return { status: 404, error: 'No creator profile linked to your account yet' };
    }
    return { star: starRes.rows[0] };
}

/** Wrap a handler so it resolves the creator's star first. */
function withCreatorStar(handler) {
    return async (req, res, next) => {
        try {
            const result = await resolveCreatorStar(req.user.uid);
            if (result.error) return res.status(result.status).json({ error: result.error });
            req.creatorStar = result.star;
            return handler(req, res, next);
        } catch (err) {
            next(err);
        }
    };
}

const BOOKING_FIELDS = `
  id, fan_name, fan_message, tier_name, tier_price, status,
  creator_note, video_url, created_at, updated_at
`;

// ─── GET /api/creator/dashboard/stats ────────────────────────────────────────
router.get('/stats', verifyToken, withCreatorStar(async (req, res, next) => {
    try {
        const starId = req.creatorStar.id;

        const aggRes = await pool.query(
            `SELECT
               COALESCE(SUM(tier_price) FILTER (WHERE status = 'delivered'), 0)            AS total_earnings,
               COUNT(*) FILTER (WHERE status = 'pending')                                  AS pending_count,
               COUNT(*) FILTER (WHERE status = 'accepted')                                 AS accepted_count,
               COUNT(*) FILTER (WHERE status = 'in_progress')                              AS in_progress_count,
               COUNT(*) FILTER (WHERE status = 'delivered')                                AS delivered_count,
               COALESCE(SUM(tier_price) FILTER (
                 WHERE status = 'delivered' AND date_trunc('month', updated_at) = date_trunc('month', now())
               ), 0)                                                                       AS this_month_earnings,
               COUNT(*) FILTER (
                 WHERE date_trunc('month', created_at) = date_trunc('month', now())
               )                                                                           AS this_month_bookings
             FROM bookings WHERE creator_id = $1`,
            [starId],
        );
        const agg = aggRes.rows[0];

        // Profile completion — 25% each.
        const star = req.creatorStar;
        const tierRes = await pool.query(
            'SELECT 1 FROM pricing_tiers WHERE creator_id = $1 AND is_active = true LIMIT 1',
            [starId],
        );
        let profile_completion = 0;
        if (star.bio && star.bio.trim()) profile_completion += 25;
        if (star.category && star.category.trim()) profile_completion += 25;
        if (tierRes.rows.length > 0) profile_completion += 25;
        if (star.accepting_bookings === true) profile_completion += 25;

        res.json({
            total_earnings: Number(agg.total_earnings),
            pending_count: Number(agg.pending_count),
            accepted_count: Number(agg.accepted_count),
            in_progress_count: Number(agg.in_progress_count),
            delivered_count: Number(agg.delivered_count),
            this_month_earnings: Number(agg.this_month_earnings),
            this_month_bookings: Number(agg.this_month_bookings),
            profile_completion,
        });
    } catch (err) {
        next(err);
    }
}));

// ─── GET /api/creator/dashboard/bookings ─────────────────────────────────────
const VALID_STATUSES = ['pending', 'accepted', 'in_progress', 'delivered', 'cancelled'];

router.get('/bookings', verifyToken, withCreatorStar(async (req, res, next) => {
    try {
        const starId = req.creatorStar.id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;

        const where = ['creator_id = $1'];
        const params = [starId];
        if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
            params.push(req.query.status);
            where.push(`status = $${params.length}`);
        }
        const whereClause = `WHERE ${where.join(' AND ')}`;

        const dataParams = [...params, limit, offset];
        const [dataRes, countRes] = await Promise.all([
            pool.query(
                `SELECT ${BOOKING_FIELDS} FROM bookings ${whereClause}
                 ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                dataParams,
            ),
            pool.query(`SELECT COUNT(*) FROM bookings ${whereClause}`, params),
        ]);

        const total = parseInt(countRes.rows[0].count, 10);
        res.json({
            bookings: dataRes.rows.map((b) => ({ ...b, tier_price: b.tier_price === null ? null : Number(b.tier_price) })),
            total,
            page,
            total_pages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (err) {
        next(err);
    }
}));

// ─── PATCH /api/creator/dashboard/bookings/:bookingId/status ──────────────────
// Allowed transitions from each current status.
const TRANSITIONS = {
    pending: ['accepted', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['delivered'],
    delivered: [],
    cancelled: [],
};

router.patch(
    '/bookings/:bookingId/status',
    verifyToken,
    [
        param('bookingId').isUUID().withMessage('Invalid booking id'),
        body('status').isIn(['accepted', 'in_progress', 'delivered', 'cancelled']).withMessage('Invalid status'),
    ],
    validate,
    withCreatorStar(async (req, res, next) => {
        try {
            const { bookingId } = req.params;
            const { status } = req.body;

            const cur = await pool.query(
                'SELECT status, creator_id FROM bookings WHERE id = $1',
                [bookingId],
            );
            if (cur.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
            if (cur.rows[0].creator_id !== req.creatorStar.id) {
                return res.status(403).json({ error: 'Not your booking' });
            }

            const current = cur.rows[0].status;
            const allowed = TRANSITIONS[current] || [];
            if (!allowed.includes(status)) {
                return res.status(409).json({
                    error: `Cannot move a booking from "${current}" to "${status}"`,
                });
            }

            const updated = await pool.query(
                `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING ${BOOKING_FIELDS}`,
                [status, bookingId],
            );
            const b = updated.rows[0];
            res.json({ ...b, tier_price: b.tier_price === null ? null : Number(b.tier_price) });
        } catch (err) {
            next(err);
        }
    }),
);

// ─── PATCH /api/creator/dashboard/bookings/:bookingId/note ────────────────────
router.patch(
    '/bookings/:bookingId/note',
    verifyToken,
    [
        param('bookingId').isUUID().withMessage('Invalid booking id'),
        body('creator_note').isString().isLength({ max: 500 }).withMessage('Note must be 500 characters or fewer'),
    ],
    validate,
    withCreatorStar(async (req, res, next) => {
        try {
            const { bookingId } = req.params;
            const { creator_note } = req.body;

            const cur = await pool.query('SELECT creator_id FROM bookings WHERE id = $1', [bookingId]);
            if (cur.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
            if (cur.rows[0].creator_id !== req.creatorStar.id) {
                return res.status(403).json({ error: 'Not your booking' });
            }

            const updated = await pool.query(
                `UPDATE bookings SET creator_note = $1 WHERE id = $2 RETURNING ${BOOKING_FIELDS}`,
                [creator_note, bookingId],
            );
            const b = updated.rows[0];
            res.json({ ...b, tier_price: b.tier_price === null ? null : Number(b.tier_price) });
        } catch (err) {
            next(err);
        }
    }),
);

// ─── POST /api/creator/dashboard/bookings/:bookingId/deliver ──────────────────
// Method A (link) only for now. Method B (file upload) is deferred until object
// storage is provisioned; the modal's Upload tab is disabled accordingly.
router.post(
    '/bookings/:bookingId/deliver',
    verifyToken,
    [
        param('bookingId').isUUID().withMessage('Invalid booking id'),
        body('delivery_method').equals('link').withMessage('Only link delivery is supported right now'),
        body('video_url').trim().isURL().withMessage('A valid video URL is required').isLength({ max: 2048 }),
    ],
    validate,
    withCreatorStar(async (req, res, next) => {
        try {
            const { bookingId } = req.params;
            const { video_url } = req.body;

            const cur = await pool.query(
                'SELECT status, creator_id, fan_id FROM bookings WHERE id = $1',
                [bookingId],
            );
            if (cur.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
            const booking = cur.rows[0];
            if (booking.creator_id !== req.creatorStar.id) {
                return res.status(403).json({ error: 'Not your booking' });
            }
            if (booking.status !== 'in_progress') {
                return res.status(409).json({ error: 'Only an in-progress booking can be delivered' });
            }

            const updated = await pool.query(
                `UPDATE bookings
                    SET video_url = $1, video_filename = NULL,
                        status = 'delivered', video_delivered_at = now()
                  WHERE id = $2 RETURNING ${BOOKING_FIELDS}`,
                [video_url, bookingId],
            );

            // Fire notifications. Failures here must NOT fail the delivery.
            try {
                const creatorName = req.creatorStar.name || 'Your creator';
                if (booking.fan_id) {
                    await createNotification({
                        userId: booking.fan_id,
                        type: 'video_delivered',
                        title: 'Your video is ready!',
                        message: `${creatorName} has delivered your personalized video.`,
                        bookingId,
                    });
                    const fanRes = await pool.query('SELECT email FROM profiles WHERE id = $1', [booking.fan_id]);
                    const fanEmail = fanRes.rows[0]?.email;
                    await sendVideoReadyEmail({ to: fanEmail, creatorName, bookingId });
                }
            } catch (notifyErr) {
                console.error('[deliver] notification step failed:', notifyErr.message);
            }

            const b = updated.rows[0];
            res.json({ ...b, tier_price: b.tier_price === null ? null : Number(b.tier_price) });
        } catch (err) {
            next(err);
        }
    }),
);

// ─── GET /api/creator/dashboard/bookings/:bookingId ───────────────────────────
// Single booking, accessible by EITHER the fan on it OR the owning creator.
// Powers the fan video-access page.
router.get(
    '/bookings/:bookingId',
    verifyToken,
    [param('bookingId').isUUID().withMessage('Invalid booking id')],
    validate,
    async (req, res, next) => {
        try {
            const { bookingId } = req.params;
            const uid = req.user.uid;
            const r = await pool.query(
                `SELECT b.id, b.fan_id, b.tier_name, b.tier_price, b.status, b.fan_name,
                        b.video_url, b.video_filename, b.video_delivered_at, b.created_at,
                        s.owner_id AS creator_owner, s.name AS creator_name
                   FROM bookings b
                   LEFT JOIN stars s ON s.id = b.creator_id
                  WHERE b.id = $1`,
                [bookingId],
            );
            if (r.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
            const row = r.rows[0];

            const isFan = row.fan_id === uid;
            const isCreator = row.creator_owner === uid;
            if (!isFan && !isCreator) {
                return res.status(403).json({ error: 'You do not have access to this booking' });
            }

            // Don't leak the raw storage path/URL; the client fetches it via /video-url.
            res.json({
                id: row.id,
                creator_name: row.creator_name,
                tier_name: row.tier_name,
                tier_price: row.tier_price === null ? null : Number(row.tier_price),
                status: row.status,
                fan_name: row.fan_name,
                has_video: Boolean(row.video_url),
                delivery_method: row.video_url ? (isExternalLink(row.video_url) ? 'link' : 'upload') : null,
                video_delivered_at: row.video_delivered_at,
                created_at: row.created_at,
            });
        } catch (err) {
            next(err);
        }
    },
);

// ─── GET /api/creator/dashboard/bookings/:bookingId/video-url ─────────────────
// Accessible by EITHER the creator who owns the booking OR the fan on it.
router.get(
    '/bookings/:bookingId/video-url',
    verifyToken,
    [param('bookingId').isUUID().withMessage('Invalid booking id')],
    validate,
    async (req, res, next) => {
        try {
            const { bookingId } = req.params;
            const uid = req.user.uid;

            const r = await pool.query(
                `SELECT b.video_url, b.video_filename, b.fan_id, s.owner_id AS creator_owner
                   FROM bookings b
                   LEFT JOIN stars s ON s.id = b.creator_id
                  WHERE b.id = $1`,
                [bookingId],
            );
            if (r.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
            const row = r.rows[0];

            const isFan = row.fan_id === uid;
            const isCreator = row.creator_owner === uid;
            if (!isFan && !isCreator) {
                return res.status(403).json({ error: 'You do not have access to this booking' });
            }
            if (!row.video_url) {
                return res.status(404).json({ error: 'No video has been delivered yet' });
            }

            if (isExternalLink(row.video_url)) {
                return res.json({
                    url: row.video_url,
                    filename: row.video_filename || null,
                    delivery_method: 'link',
                });
            }

            // Stored object path → signed URL. Deferred until object storage is
            // wired up; surfaced clearly rather than returning a broken path.
            return res.status(501).json({
                error: 'File-based video delivery is not enabled yet. This booking was delivered via a stored file.',
            });
        } catch (err) {
            next(err);
        }
    },
);

// ─── Settings ─────────────────────────────────────────────────────────────────
// Same option sets as creator onboarding, kept in sync intentionally.
const CATEGORY_OPTIONS = ['Actor', 'Musician', 'Comedian', 'Athlete', 'Influencer', 'YouTuber', 'Podcaster', 'Other'];
const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Marathi', 'Other'];

// GET /api/creator/dashboard/settings
router.get('/settings', verifyToken, withCreatorStar(async (req, res, next) => {
    try {
        const star = req.creatorStar;
        const [tiers, gallery] = await Promise.all([
            pool.query(
                `SELECT id, tier_name, description, price, delivery_days, is_active
                   FROM pricing_tiers WHERE creator_id = $1 ORDER BY price ASC`,
                [star.id],
            ),
            pool.query(
                `SELECT id, media_url, media_type, caption, sort_order, created_at
                   FROM creator_gallery WHERE creator_id = $1 ORDER BY sort_order ASC, created_at ASC`,
                [star.id],
            ),
        ]);
        res.json({
            accepting_bookings: Boolean(star.accepting_bookings),
            turnaround_days: star.turnaround_days ?? 7,
            bio: star.bio ?? null,
            category: star.category ?? null,
            languages: star.languages ?? [],
            username: star.username ?? null,
            profile_picture_url: star.profile_picture_url ?? null,
            cover_image_url: star.cover_image_url ?? null,
            pricing_tiers: tiers.rows.map((t) => ({ ...t, price: Number(t.price) })),
            gallery: gallery.rows,
        });
    } catch (err) {
        next(err);
    }
}));

// PATCH /api/creator/dashboard/settings — partial update of the stars row.
router.patch(
    '/settings',
    verifyToken,
    [
        body('accepting_bookings').optional().isBoolean().withMessage('accepting_bookings must be a boolean').toBoolean(),
        body('turnaround_days').optional().isInt({ min: 1, max: 30 }).withMessage('Turnaround must be between 1 and 30 days'),
        body('bio').optional({ nullable: true }).isLength({ max: 500 }).withMessage('Bio must be 500 characters or fewer'),
        body('category').optional().isIn(CATEGORY_OPTIONS).withMessage('Invalid category'),
        body('languages').optional().isArray().withMessage('Languages must be an array'),
        body('languages.*').optional().isIn(LANGUAGE_OPTIONS).withMessage('Invalid language'),
    ],
    validate,
    withCreatorStar(async (req, res, next) => {
        try {
            // Build a dynamic SET clause from only the provided fields.
            const allowed = ['accepting_bookings', 'turnaround_days', 'bio', 'category', 'languages'];
            const sets = [];
            const params = [];
            let idx = 1;
            for (const field of allowed) {
                if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                    sets.push(`${field} = $${idx++}`);
                    params.push(req.body[field]);
                }
            }
            if (sets.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }
            params.push(req.creatorStar.id);
            await pool.query(
                `UPDATE stars SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx}`,
                params,
            );

            // Return the full, fresh settings object.
            const star = (await pool.query('SELECT * FROM stars WHERE id = $1', [req.creatorStar.id])).rows[0];
            const tiers = await pool.query(
                `SELECT id, tier_name, description, price, delivery_days, is_active
                   FROM pricing_tiers WHERE creator_id = $1 ORDER BY price ASC`,
                [star.id],
            );
            res.json({
                accepting_bookings: Boolean(star.accepting_bookings),
                turnaround_days: star.turnaround_days ?? 7,
                bio: star.bio ?? null,
                category: star.category ?? null,
                languages: star.languages ?? [],
                pricing_tiers: tiers.rows.map((t) => ({ ...t, price: Number(t.price) })),
            });
        } catch (err) {
            next(err);
        }
    }),
);

// PATCH /api/creator/dashboard/settings/tiers/:tierId/toggle
router.patch(
    '/settings/tiers/:tierId/toggle',
    verifyToken,
    [param('tierId').isUUID().withMessage('Invalid tier id')],
    validate,
    withCreatorStar(async (req, res, next) => {
        try {
            const { tierId } = req.params;
            const cur = await pool.query('SELECT creator_id, is_active FROM pricing_tiers WHERE id = $1', [tierId]);
            if (cur.rows.length === 0) return res.status(404).json({ error: 'Tier not found' });
            if (cur.rows[0].creator_id !== req.creatorStar.id) {
                return res.status(403).json({ error: 'Not your tier' });
            }
            const updated = await pool.query(
                'UPDATE pricing_tiers SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active',
                [tierId],
            );
            res.json(updated.rows[0]);
        } catch (err) {
            next(err);
        }
    }),
);

// ─── Media uploads (Cloudflare R2) ────────────────────────────────────────────

/**
 * Shared image-upload handler for avatar/cover. Validates mime + size, uploads
 * to R2, saves the public URL to the given stars column. R2 failures return a
 * clean error rather than crashing.
 */
function makeImageUploader({ column, prefix, maxBytes }) {
    return async (req, res, next) => {
        try {
            if (!r2.isConfigured()) {
                return res.status(503).json({ error: 'Media storage is not configured yet' });
            }
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            const ext = IMAGE_MIME[req.file.mimetype];
            if (!ext) return res.status(400).json({ error: 'Only JPG, PNG, or WEBP images are allowed' });
            if (req.file.size > maxBytes) return res.status(400).json({ error: 'File is too large' });
            if (!(await magicBytesMatch(req.file))) {
                return res.status(400).json({ error: 'File content does not match its declared type' });
            }

            const key = `${prefix}/${req.creatorStar.id}/${randomUUID()}.${ext}`;
            let url;
            try {
                ({ url } = await r2.uploadBuffer(req.file.buffer, key, req.file.mimetype));
            } catch (err) {
                console.error('[upload] R2 failed:', err.message);
                return res.status(502).json({ error: 'Upload failed, please try again' });
            }
            await pool.query(`UPDATE stars SET ${column} = $1, updated_at = now() WHERE id = $2`, [url, req.creatorStar.id]);
            res.json({ url });
        } catch (err) {
            next(err);
        }
    };
}

// POST /api/creator/dashboard/upload-avatar
router.post(
    '/upload-avatar',
    verifyToken,
    handleMulter(uploadImage5.single('avatar')),
    withCreatorStar(makeImageUploader({ column: 'profile_picture_url', prefix: 'avatars', maxBytes: 5 * 1024 * 1024 })),
);

// POST /api/creator/dashboard/upload-cover
router.post(
    '/upload-cover',
    verifyToken,
    handleMulter(uploadImage10.single('cover')),
    withCreatorStar(makeImageUploader({ column: 'cover_image_url', prefix: 'covers', maxBytes: 10 * 1024 * 1024 })),
);

// ─── Gallery ──────────────────────────────────────────────────────────────────
const MAX_GALLERY_ITEMS = 20;

// POST /api/creator/dashboard/gallery  (one file per request, field "media")
router.post(
    '/gallery',
    verifyToken,
    handleMulter(uploadGallery.single('media')),
    withCreatorStar(async (req, res, next) => {
        try {
            if (!r2.isConfigured()) return res.status(503).json({ error: 'Media storage is not configured yet' });
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const isImage = Boolean(IMAGE_MIME[req.file.mimetype]);
            const isVideo = Boolean(VIDEO_MIME[req.file.mimetype]);
            if (!isImage && !isVideo) {
                return res.status(400).json({ error: 'Only JPG/PNG/WEBP images or MP4/MOV videos are allowed' });
            }
            const maxBytes = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
            if (req.file.size > maxBytes) {
                return res.status(400).json({ error: `File exceeds the ${isImage ? '10MB' : '100MB'} limit` });
            }
            if (!(await magicBytesMatch(req.file))) {
                return res.status(400).json({ error: 'File content does not match its declared type' });
            }

            // Enforce the per-creator cap.
            const countRes = await pool.query('SELECT COUNT(*)::int AS n FROM creator_gallery WHERE creator_id = $1', [req.creatorStar.id]);
            if (countRes.rows[0].n >= MAX_GALLERY_ITEMS) {
                return res.status(409).json({ error: `Gallery is full (max ${MAX_GALLERY_ITEMS} items)` });
            }

            const ext = isImage ? IMAGE_MIME[req.file.mimetype] : VIDEO_MIME[req.file.mimetype];
            const key = `gallery/${req.creatorStar.id}/${randomUUID()}.${ext}`;
            let url;
            try {
                ({ url } = await r2.uploadBuffer(req.file.buffer, key, req.file.mimetype));
            } catch (err) {
                console.error('[gallery] R2 failed:', err.message);
                return res.status(502).json({ error: 'Upload failed, please try again' });
            }

            const inserted = await pool.query(
                `INSERT INTO creator_gallery (creator_id, media_url, media_type, sort_order)
                 VALUES ($1, $2, $3, $4) RETURNING id, media_url, media_type, caption, sort_order, created_at`,
                [req.creatorStar.id, url, isImage ? 'image' : 'video', countRes.rows[0].n],
            );
            res.status(201).json(inserted.rows[0]);
        } catch (err) {
            next(err);
        }
    }),
);

// DELETE /api/creator/dashboard/gallery/:itemId
router.delete(
    '/gallery/:itemId',
    verifyToken,
    [param('itemId').isUUID().withMessage('Invalid item id')],
    validate,
    withCreatorStar(async (req, res, next) => {
        try {
            const { itemId } = req.params;
            const cur = await pool.query('SELECT creator_id, media_url FROM creator_gallery WHERE id = $1', [itemId]);
            if (cur.rows.length === 0) return res.status(404).json({ error: 'Gallery item not found' });
            if (cur.rows[0].creator_id !== req.creatorStar.id) {
                return res.status(403).json({ error: 'Not your gallery item' });
            }
            // Best-effort R2 delete (never blocks DB cleanup).
            await r2.deleteObject(cur.rows[0].media_url);
            await pool.query('DELETE FROM creator_gallery WHERE id = $1', [itemId]);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }),
);

module.exports = router;
