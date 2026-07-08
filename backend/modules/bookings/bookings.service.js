'use strict';

/**
 * Bookings business logic + data access.
 *
 * Behavior is identical to the pre-refactor routes/bookings.js: same checks,
 * same SQL, same status codes. Errors are raised as ApiError(status, message);
 * the existing errorHandler renders them as { error: message } with that
 * status — byte-identical to the old inline res.status().json({ error }).
 */

const pool = require('../../config/db');
const ApiError = require('../../utils/ApiError');

/**
 * Create a booking for an authenticated fan.
 * @param {string} fanUid  Firebase UID of the booking fan (bookings.fan_id)
 * @param {object} input   validated booking fields
 * @returns {Promise<object>} the created booking row (tier_price coerced to Number)
 */
async function createBooking(fanUid, input) {
    const {
        creator_id, tier_id, fan_name, video_for,
        occasion, instructions, is_gift,
        gift_recipient_name, gift_recipient_email,
    } = input;

    // Fan-only (a creator can't book themselves through this flow).
    const prof = await pool.query('SELECT account_type FROM profiles WHERE id = $1', [fanUid]);
    if (prof.rows.length === 0) throw new ApiError(404, 'Profile not found');
    if (prof.rows[0].account_type === 'creator') {
        throw new ApiError(403, 'Creators cannot place bookings');
    }

    // Validate the creator is accepting bookings.
    const starRes = await pool.query('SELECT id, accepting_bookings FROM stars WHERE id = $1', [creator_id]);
    if (starRes.rows.length === 0) throw new ApiError(404, 'Creator not found');
    if (!starRes.rows[0].accepting_bookings) {
        throw new ApiError(409, 'This creator is not accepting bookings right now');
    }

    // Resolve the tier and confirm it belongs to this creator + is active.
    const tierRes = await pool.query(
        'SELECT id, tier_name, price, creator_id, is_active FROM pricing_tiers WHERE id = $1',
        [tier_id],
    );
    if (tierRes.rows.length === 0) throw new ApiError(404, 'Pricing tier not found');
    const tier = tierRes.rows[0];
    if (tier.creator_id !== creator_id) {
        throw new ApiError(400, 'Tier does not belong to this creator');
    }
    if (!tier.is_active) {
        throw new ApiError(409, 'This pricing tier is no longer available');
    }

    // If marked a gift, require a recipient name.
    if (is_gift && !(gift_recipient_name && gift_recipient_name.trim())) {
        throw new ApiError(422, 'Gift bookings need a recipient name');
    }

    const inserted = await pool.query(
        `INSERT INTO bookings (
            creator_id, fan_id, tier_id, tier_name, tier_price, status,
            fan_name, video_for, occasion, instructions,
            is_gift, gift_recipient_name, gift_recipient_email
         ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, status, tier_name, tier_price, created_at`,
        [
            creator_id, fanUid, tier.id, tier.tier_name, tier.price,
            fan_name, video_for, occasion || null, instructions || null,
            Boolean(is_gift), gift_recipient_name || null, gift_recipient_email || null,
        ],
    );

    const b = inserted.rows[0];
    return { ...b, tier_price: b.tier_price === null ? null : Number(b.tier_price) };
}

module.exports = { createBooking };
