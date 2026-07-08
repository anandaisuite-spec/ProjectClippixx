'use strict';

/**
 * Transactional email via SMTP (Nodemailer).
 *
 * Requirements (.env):
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Graceful degradation: when SMTP_HOST/USER/PASS aren't all set, sendEmail logs
 * instead of sending so the signup/login/notification flows are testable without
 * mail credentials. The transporter is created lazily on first real send.
 */

const nodemailer = require('nodemailer');

let transporter = null;

function isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
    if (transporter) return transporter;
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465, // true for 465, false for 587/others
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    return transporter;
}

/**
 * Send an email. Returns true if sent, false if skipped (not configured).
 * Throws on a real SMTP failure so callers can handle/report it.
 * @param {{ to: string, subject: string, html: string }} opts
 */
async function sendEmail({ to, subject, html }) {
    if (!isConfigured()) {
        console.log('[EMAIL - not configured] To:', to, '| Subject:', subject);
        return false;
    }
    await getTransporter().sendMail({
        from: process.env.SMTP_FROM || 'noreply@clipixx.com',
        to,
        subject,
        html,
    });
    return true;
}

module.exports = { sendEmail, isConfigured };
