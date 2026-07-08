'use strict';

/**
 * SMS sending via Authkey.io.
 *
 * Requirements (.env):
 *   AUTHKEY_API_KEY      — from the Authkey dashboard
 *   AUTHKEY_SENDER_ID    — approved sender ID (e.g. CLPIXX)
 *   AUTHKEY_TEMPLATE_SID — SID from SMS > Template List
 *
 * The approved template substitutes {#Name#} and {#otp#}:
 *   "Dear {#Name#}, Here is your Verification Code: {#otp#}. Valid for 5
 *    minutes. Your next great clip starts here. — Team Clipixx"
 *
 * Interface is kept as sendSms(phone, code, name) so existing call sites that
 * pass only (phone, code) keep working — name defaults to "User".
 *
 * Graceful degradation: when AUTHKEY_API_KEY is empty or a REPLACE placeholder,
 * the OTP is logged (dev) instead of sent, so the signup/login flow is testable
 * without credentials. A real Authkey error throws (callers already handle it).
 *
 * country_code is hardcoded to 91 (India) for now.
 */

const AUTHKEY_URL = 'https://api.authkey.io/request';
const COUNTRY_CODE = '91';

/** True only when a real API key is present (not empty / not a REPLACE stub). */
function isConfigured() {
    const key = process.env.AUTHKEY_API_KEY;
    return Boolean(key) && !key.startsWith('REPLACE') && key !== 'YOUR_AUTHKEY_API_KEY';
}

async function sendSms(phone, code, name = 'User') {
    if (!isConfigured()) {
        // Dev/test no-op — never log the OTP in production.
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`[smsService] Authkey not configured — OTP for ${phone}: ${code}`);
        } else {
            console.warn('[smsService] Authkey not configured — SMS OTP not sent.');
        }
        return;
    }

    // Authkey expects the mobile without a leading '+' and without the country
    // code prefix; country_code is sent separately.
    const mobile = String(phone).replace(/^\+/, '').replace(new RegExp(`^${COUNTRY_CODE}`), '');

    const params = new URLSearchParams({
        authkey: process.env.AUTHKEY_API_KEY,
        mobile,
        country_code: COUNTRY_CODE,
        sid: process.env.AUTHKEY_TEMPLATE_SID || '',
        name: name || 'User',
        otp: code,
    });
    if (process.env.AUTHKEY_SENDER_ID) params.set('sender', process.env.AUTHKEY_SENDER_ID);

    let data;
    try {
        const response = await fetch(`${AUTHKEY_URL}?${params.toString()}`);
        const text = await response.text();
        try { data = JSON.parse(text); } catch { data = { raw: text, httpStatus: response.status }; }
        if (!response.ok) {
            console.error(`[smsService] Authkey HTTP ${response.status}:`, text);
            throw new Error('Failed to send OTP. Please try again.');
        }
    } catch (err) {
        console.error('[smsService] Authkey request failed:', err.message);
        throw new Error('Failed to send OTP. Please try again.');
    }

    // Authkey returns status '200' / a "Submitted Successfully" message on
    // success; surface a generic error otherwise (details logged above).
    const status = data.status ?? data.Status;
    const okMessage = /success|submitted/i.test(data.Message || data.message || '');
    if (status !== undefined && String(status) !== '200' && !okMessage) {
        console.error('[smsService] Authkey rejected:', JSON.stringify(data));
        throw new Error('Failed to send OTP. Please try again.');
    }

    return data;
}

module.exports = { sendSms, isConfigured };
