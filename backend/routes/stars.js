const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

const LIST_COLUMNS = 'id, name, category, image_url, rating, reviews_count, price, is_featured, is_verified';
const DETAIL_COLUMNS = LIST_COLUMNS + ', bio, instagram_url, youtube_url, twitter_url, accepting_bookings, username, profile_picture_url, cover_image_url, avg_rating, review_count, created_at, updated_at';
const VALID_SORT = ['name', 'rating', 'price', 'reviews_count', 'created_at'];

/**
 * GET /api/stars
 * Fetch stars with optional filters and pagination.
 *
 * Query params: category, featured, search, sort, order, page, limit
 */
router.get('/', async (req, res, next) => {
    try {
        const { category, featured, search, sort, order } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];
        let idx = 1;

        if (category && category !== 'All') {
            whereClause += ` AND category = $${idx++}`;
            params.push(category);
        }

        if (featured === 'true') {
            whereClause += ' AND is_featured = true';
        }

        if (search) {
            whereClause += ` AND name ILIKE $${idx++}`;
            params.push(`%${search}%`);
        }

        const sortCol = VALID_SORT.includes(sort) ? sort : 'created_at';
        const sortDir = order === 'asc' ? 'ASC' : 'DESC';

        // Data query with pagination
        const dataQuery = `SELECT ${LIST_COLUMNS} FROM stars ${whereClause} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx++} OFFSET $${idx++}`;
        const dataParams = [...params, limit, offset];

        // Count query (same filters, no pagination)
        const countQuery = `SELECT COUNT(*) FROM stars ${whereClause}`;

        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, dataParams),
            pool.query(countQuery, params),
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
 * Build the full public profile payload for a star row:
 * star + active pricing tiers (when accepting bookings) + gallery.
 */
async function buildStarDetail(star) {
    let pricing_tiers = [];
    if (star.accepting_bookings) {
        const tiers = await pool.query(
            `SELECT id, tier_name, description, price, delivery_days
               FROM pricing_tiers
              WHERE creator_id = $1 AND is_active = true
              ORDER BY price ASC`,
            [star.id],
        );
        // price is NUMERIC → comes back as a string; coerce to number for the client.
        pricing_tiers = tiers.rows.map((t) => ({ ...t, price: Number(t.price) }));
    }

    const gallery = await pool.query(
        `SELECT id, media_url, media_type, caption, sort_order, created_at
           FROM creator_gallery WHERE creator_id = $1 ORDER BY sort_order ASC, created_at ASC`,
        [star.id],
    );

    return {
        ...star,
        avg_rating: star.avg_rating === null ? 0 : Number(star.avg_rating),
        review_count: star.review_count ?? 0,
        pricing_tiers,
        gallery: gallery.rows,
    };
}

/**
 * GET /api/stars/by-username/:username
 * Same payload as GET /api/stars/:id but looked up by username.
 * Declared before /:id; the extra path segment keeps them from colliding.
 */
router.get('/by-username/:username', async (req, res, next) => {
    try {
        const username = String(req.params.username || '').toLowerCase();
        const result = await pool.query(`SELECT ${DETAIL_COLUMNS} FROM stars WHERE username = $1`, [username]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Star not found' });
        res.json({ data: await buildStarDetail(result.rows[0]) });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/stars/:id
 * Fetch a single star by ID (includes bio, pricing tiers, gallery).
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT ${DETAIL_COLUMNS} FROM stars WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Star not found' });
        }
        res.json({ data: await buildStarDetail(result.rows[0]) });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/stars/:id/reviews  (public, paginated)
 * Booking-based reviews with the fan's display name.
 */
router.get('/:id/reviews', async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;

        const [dataRes, countRes] = await Promise.all([
            pool.query(
                `SELECT br.id, br.rating, br.review_text, br.created_at,
                        TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS fan_name
                   FROM booking_reviews br
                   LEFT JOIN profiles p ON p.id = br.fan_id
                  WHERE br.creator_id = $1
                  ORDER BY br.created_at DESC
                  LIMIT $2 OFFSET $3`,
                [id, limit, offset],
            ),
            pool.query('SELECT COUNT(*) FROM booking_reviews WHERE creator_id = $1', [id]),
        ]);

        const total = parseInt(countRes.rows[0].count, 10);
        res.json({
            data: dataRes.rows,
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/stars
 * Super Admin adds a new star.
 */
router.post('/', verifyToken, requireRole(['admin', 'super_admin']), [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
    body('category').isIn(['Actor', 'Athlete', 'Creator', 'Musician']).withMessage('Invalid Category'),
    body('image_url').trim().notEmpty().isURL().withMessage('Valid image URL required').isLength({ max: 2048 }),
    body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    body('reviews_count').optional().isInt({ min: 0 }),
    body('price').isInt({ min: 1 }).withMessage('Price must be greater than 0'),
    body('is_featured').optional().isBoolean(),
    body('bio').optional().trim().isLength({ max: 5000 }),
], validate, async (req, res, next) => {
    try {
        const { name, category, image_url, rating, reviews_count, price, is_featured, bio } = req.body;

        const result = await pool.query(
            `INSERT INTO stars (name, category, image_url, rating, reviews_count, price, is_featured, bio)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING ${DETAIL_COLUMNS}`,
            [
                name, 
                category, 
                image_url, 
                rating !== undefined ? rating : 5.0, 
                reviews_count || 0, 
                price, 
                is_featured || false, 
                bio || ''
            ]
        );

        res.status(201).json({
            message: 'Star created successfully',
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/stars/:id
 * Admin / Super Admin updates a star. Partial update — only provided fields change.
 */
router.put('/:id', verifyToken, requireRole(['admin', 'super_admin']), [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 200 }),
    body('category').optional().isIn(['Actor', 'Athlete', 'Creator', 'Musician']).withMessage('Invalid Category'),
    body('image_url').optional().trim().isURL().withMessage('Valid image URL required').isLength({ max: 2048 }),
    body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    body('reviews_count').optional().isInt({ min: 0 }),
    body('price').optional().isInt({ min: 1 }).withMessage('Price must be greater than 0'),
    body('is_featured').optional().isBoolean(),
    body('bio').optional().trim().isLength({ max: 5000 }),
], validate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const ALLOWED = ['name', 'category', 'image_url', 'rating', 'reviews_count', 'price', 'is_featured', 'bio'];

        const sets = [];
        const params = [];
        let idx = 1;
        for (const field of ALLOWED) {
            if (req.body[field] !== undefined) {
                sets.push(`${field} = $${idx++}`);
                params.push(req.body[field]);
            }
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }

        params.push(id);
        const result = await pool.query(
            `UPDATE stars SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx}
             RETURNING ${DETAIL_COLUMNS}`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Star not found' });
        }

        res.json({ message: 'Star updated successfully', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/stars/:id
 * Admin / Super Admin deletes a star.
 */
router.delete('/:id', verifyToken, requireRole(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM stars WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Star not found' });
        }

        res.json({ message: 'Star deleted successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
