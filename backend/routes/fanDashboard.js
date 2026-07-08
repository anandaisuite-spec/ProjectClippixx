const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

/**
 * Fan dashboard — bookings, videos, reviews, settings.
 *
 * Schema notes:
 *   - profiles has no display_name; it's first_name + last_name. The settings
 *     endpoint reads a composed display_name and writes it back split across
 *     first/last.
 *   - A fan is any profile with account_type !== 'creator'. Creators are 403'd.
 *   - Reviews live in booking_reviews (the booking-based table).
 *
 * Mounted at /api/fan/dashboard.
 */

/** Gate: caller must be an authenticated non-creator profile. */
function withFan(handler) {
    return async (req, res, next) => {
        try {
            const prof = await pool.query(
                'SELECT id, account_type, first_name, last_name, email, phone FROM profiles WHERE id = $1',
                [req.user.uid],
            );
            if (prof.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
            if (prof.rows[0].account_type === 'creator') {
                return res.status(403).json({ error: 'This dashboard is for fans' });
            }
            req.fanProfile = prof.rows[0];
            return handler(req, res, next);
        } catch (err) {
            next(err);
        }
    };
}

// Creator sub-object joined onto a fan's bookings, plus has_review flag.
const BOOKING_SELECT = `
  b.id, b.status, b.tier_name, b.tier_price, b.occasion, b.is_gift,
  b.gift_recipient_name, b.fan_message, b.instructions,
  b.video_url, b.video_delivered_at, b.created_at, b.updated_at,
  s.id AS creator_id,
  TRIM(CONCAT(s.name, '')) AS creator_display_name,
  s.profile_picture_url AS creator_profile_picture_url,
  s.username AS creator_username,
  s.category AS creator_category,
  (br.id IS NOT NULL) AS has_review
`;

const BOOKING_FROM = `
  FROM bookings b
  LEFT JOIN stars s ON s.id = b.creator_id
  LEFT JOIN booking_reviews br ON br.booking_id = b.id
`;

/** Reshape a flat row into { ...booking, creator: {...}, has_review }. */
function shapeBooking(r) {
    return {
        id: r.id,
        status: r.status,
        tier_name: r.tier_name,
        tier_price: r.tier_price === null ? null : Number(r.tier_price),
        occasion: r.occasion,
        is_gift: r.is_gift,
        gift_recipient_name: r.gift_recipient_name,
        fan_message: r.fan_message,
        instructions: r.instructions,
        video_url: r.video_url,
        video_delivered_at: r.video_delivered_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        has_review: r.has_review,
        creator: {
            id: r.creator_id,
            display_name: r.creator_display_name,
            profile_picture_url: r.creator_profile_picture_url,
            username: r.creator_username,
            category: r.creator_category,
        },
    };
}

const VALID_STATUSES = ['pending', 'accepted', 'in_progress', 'delivered', 'cancelled'];

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get('/stats', verifyToken, withFan(async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const [agg, reviews] = await Promise.all([
            pool.query(
                `SELECT
                   COUNT(*)                                            AS total_bookings,
                   COUNT(*) FILTER (WHERE status = 'pending')          AS pending_count,
                   COUNT(*) FILTER (WHERE status = 'delivered')        AS delivered_count,
                   COUNT(*) FILTER (WHERE status = 'delivered' AND video_url IS NOT NULL) AS videos_received
                 FROM bookings WHERE fan_id = $1`,
                [uid],
            ),
            pool.query('SELECT COUNT(*) AS n FROM booking_reviews WHERE fan_id = $1', [uid]),
        ]);
        const a = agg.rows[0];
        res.json({
            total_bookings: Number(a.total_bookings),
            pending_count: Number(a.pending_count),
            delivered_count: Number(a.delivered_count),
            reviews_left: Number(reviews.rows[0].n),
            videos_received: Number(a.videos_received),
        });
    } catch (err) {
        next(err);
    }
}));

// ─── GET /bookings ────────────────────────────────────────────────────────────
router.get('/bookings', verifyToken, withFan(async (req, res, next) => {
    try {
        const uid = req.user.uid;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;

        const where = ['b.fan_id = $1'];
        const params = [uid];
        if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
            params.push(req.query.status);
            where.push(`b.status = $${params.length}`);
        }
        const whereClause = `WHERE ${where.join(' AND ')}`;

        const [dataRes, countRes] = await Promise.all([
            pool.query(
                `SELECT ${BOOKING_SELECT} ${BOOKING_FROM} ${whereClause}
                 ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset],
            ),
            pool.query(`SELECT COUNT(*) FROM bookings b ${whereClause}`, params),
        ]);

        const total = parseInt(countRes.rows[0].count, 10);
        res.json({
            bookings: dataRes.rows.map(shapeBooking),
            total,
            page,
            total_pages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (err) {
        next(err);
    }
}));

// ─── GET /videos ──────────────────────────────────────────────────────────────
router.get('/videos', verifyToken, withFan(async (req, res, next) => {
    try {
        const rows = await pool.query(
            `SELECT ${BOOKING_SELECT} ${BOOKING_FROM}
              WHERE b.fan_id = $1 AND b.status = 'delivered' AND b.video_url IS NOT NULL
              ORDER BY b.video_delivered_at DESC NULLS LAST`,
            [req.user.uid],
        );
        res.json({ videos: rows.rows.map(shapeBooking) });
    } catch (err) {
        next(err);
    }
}));

// ─── GET /reviews ─────────────────────────────────────────────────────────────
router.get('/reviews', verifyToken, withFan(async (req, res, next) => {
    try {
        const rows = await pool.query(
            `SELECT br.id, br.rating, br.review_text, br.created_at,
                    s.id AS creator_id, s.name AS creator_display_name,
                    s.profile_picture_url AS creator_profile_picture_url
               FROM booking_reviews br
               LEFT JOIN stars s ON s.id = br.creator_id
              WHERE br.fan_id = $1
              ORDER BY br.created_at DESC`,
            [req.user.uid],
        );
        res.json({
            reviews: rows.rows.map((r) => ({
                id: r.id,
                rating: r.rating,
                review_text: r.review_text,
                created_at: r.created_at,
                creator: {
                    id: r.creator_id,
                    display_name: r.creator_display_name,
                    profile_picture_url: r.creator_profile_picture_url,
                },
            })),
        });
    } catch (err) {
        next(err);
    }
}));

// ─── PATCH /settings ──────────────────────────────────────────────────────────
router.patch(
    '/settings',
    verifyToken,
    [
        body('display_name').optional().trim().isLength({ max: 100 }).withMessage('Display name max 100 chars'),
        body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }).withMessage('Phone max 20 chars'),
    ],
    validate,
    withFan(async (req, res, next) => {
        try {
            const sets = [];
            const params = [];
            let idx = 1;

            if (Object.prototype.hasOwnProperty.call(req.body, 'display_name')) {
                // Split a single display name into first/last to fit the schema.
                const parts = String(req.body.display_name).trim().split(/\s+/);
                const first = parts.shift() || '';
                const last = parts.join(' ');
                sets.push(`first_name = $${idx++}`); params.push(first);
                sets.push(`last_name = $${idx++}`); params.push(last);
            }
            if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
                sets.push(`phone = $${idx++}`); params.push(req.body.phone || null);
            }
            if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

            params.push(req.user.uid);
            const updated = await pool.query(
                `UPDATE profiles SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx}
                 RETURNING first_name, last_name, email, phone`,
                params,
            );
            const p = updated.rows[0];
            res.json({
                display_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                phone: p.phone,
                email: p.email,
            });
        } catch (err) {
            next(err);
        }
    }),
);

module.exports = router;
