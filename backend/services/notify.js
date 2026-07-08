'use strict';

/**
 * Notification helpers — in-app rows + transactional email via SMTP.
 *
 * Email goes through services/emailService.js (Nodemailer SMTP), which is a
 * logged no-op when SMTP isn't configured. Email failures never throw to the
 * caller — delivery of the video must not fail just because an email bounced.
 */

const pool = require('../config/db');
const { sendEmail } = require('./emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/** Insert an in-app notification row. Returns the created row. */
async function createNotification({ userId, type, title, message, bookingId = null }) {
    const r = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, booking_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, type, title, message, bookingId],
    );
    return r.rows[0];
}

/**
 * Email the fan that their video is ready. Never throws — returns true on
 * success, false on failure / not-configured.
 */
async function sendVideoReadyEmail({ to, creatorName, bookingId }) {
    if (!to) return false;
    const link = `${FRONTEND_URL}/fan/bookings/${bookingId}`;
    try {
        return await sendEmail({
            to,
            subject: `Your Clipixx video from ${creatorName} is ready 🎉`,
            html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f0f0f;border-radius:16px">
  <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 16px">Your video is ready!</h1>
  <p style="color:#ccc;font-size:15px;margin:0 0 28px">${creatorName} has completed your personalized video.</p>
  <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:12px">View &amp; Download Your Video</a>
  <p style="color:#666;font-size:13px;margin:32px 0 0">— Team Clipixx</p>
</div>`,
        });
    } catch (err) {
        console.error('[email] video-ready send failed:', err.message);
        return false;
    }
}

module.exports = { createNotification, sendVideoReadyEmail };
