'use strict';

/**
 * Explore (public discovery) business logic + data access.
 * Behavior identical to pre-refactor routes/explore.js: same INNER JOIN gating
 * (accepting_bookings + ≥1 active tier), same filters, same sort whitelist,
 * same response mapping/coercions.
 */

const pool = require('../../config/db');

const SORTS = {
    popular: 'review_count DESC NULLS LAST, s.created_at DESC',
    rating: 'avg_rating DESC NULLS LAST, review_count DESC NULLS LAST',
    price_low: 'starting_price ASC',
    price_high: 'starting_price DESC',
    newest: 's.created_at DESC',
};

async function listCreators(query) {
    const { q, category, min_price, max_price, rating, language } = query;
    const sortKey = Object.prototype.hasOwnProperty.call(SORTS, query.sort) ? query.sort : 'popular';
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(query.limit) || 12));
    const offset = (page - 1) * limit;

    const tierJoin = `
        JOIN (
            SELECT creator_id,
                   MIN(price) AS starting_price,
                   MIN(delivery_days) AS min_delivery_days
            FROM pricing_tiers
            WHERE is_active = true
            GROUP BY creator_id
        ) t ON t.creator_id = s.id
    `;

    const where = ['s.accepting_bookings = true'];
    const params = [];
    let idx = 1;

    if (q) {
        where.push(`(s.name ILIKE $${idx} OR s.username ILIKE $${idx})`);
        params.push(`%${q}%`);
        idx++;
    }
    if (category && category !== 'All') {
        where.push(`s.category = $${idx++}`);
        params.push(category);
    }
    if (min_price !== undefined && min_price !== '') {
        where.push(`t.starting_price >= $${idx++}`);
        params.push(Number(min_price));
    }
    if (max_price !== undefined && max_price !== '') {
        where.push(`t.starting_price <= $${idx++}`);
        params.push(Number(max_price));
    }
    if (rating !== undefined && rating !== '') {
        where.push(`s.avg_rating >= $${idx++}`);
        params.push(Number(rating));
    }
    if (language) {
        where.push(`$${idx++} = ANY(s.languages)`);
        params.push(language);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const selectCols = `
        s.id, s.name AS display_name, s.username, s.profile_picture_url,
        s.cover_image_url, s.category, s.bio,
        COALESCE(s.avg_rating, 0) AS avg_rating,
        COALESCE(s.review_count, 0) AS review_count,
        s.languages, s.is_verified AS verified,
        t.starting_price, t.min_delivery_days,
        (SELECT COUNT(*) FROM bookings b WHERE b.creator_id = s.id) AS bookings_count
    `;

    const dataQuery = `
        SELECT ${selectCols}
        FROM stars s
        ${tierJoin}
        ${whereClause}
        ORDER BY ${SORTS[sortKey]}
        LIMIT $${idx++} OFFSET $${idx++}
    `;
    const countQuery = `SELECT COUNT(*) FROM stars s ${tierJoin} ${whereClause}`;

    const [dataRes, countRes] = await Promise.all([
        pool.query(dataQuery, [...params, limit, offset]),
        pool.query(countQuery, params),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    const creators = dataRes.rows.map((r) => ({
        id: r.id,
        display_name: r.display_name,
        username: r.username,
        profile_picture_url: r.profile_picture_url,
        cover_image_url: r.cover_image_url,
        category: r.category,
        bio: r.bio,
        avg_rating: Number(r.avg_rating),
        review_count: Number(r.review_count),
        languages: r.languages || [],
        starting_price: Number(r.starting_price),
        min_delivery_days: Number(r.min_delivery_days),
        verified: Boolean(r.verified),
        bookings_count: Number(r.bookings_count),
    }));

    return { creators, total, page, total_pages: Math.max(1, Math.ceil(total / limit)) };
}

async function getFilters() {
    const [cats, langs, priceRange] = await Promise.all([
        pool.query(`SELECT DISTINCT category FROM stars WHERE category IS NOT NULL AND accepting_bookings = true ORDER BY category`),
        pool.query(`SELECT DISTINCT unnest(languages) AS lang FROM stars WHERE languages IS NOT NULL ORDER BY lang`),
        pool.query(`SELECT COALESCE(MIN(price), 0) AS min, COALESCE(MAX(price), 0) AS max FROM pricing_tiers WHERE is_active = true`),
    ]);
    return {
        categories: cats.rows.map((r) => r.category),
        languages: langs.rows.map((r) => r.lang).filter(Boolean),
        price_range: { min: Number(priceRange.rows[0].min), max: Number(priceRange.rows[0].max) },
        max_rating: 5,
    };
}

module.exports = { listCreators, getFilters };
