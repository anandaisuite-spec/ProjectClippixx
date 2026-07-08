-- Migration 019: Expand otp_codes.purpose to support login_email / login_phone
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_purpose_check;

ALTER TABLE otp_codes
    ADD CONSTRAINT otp_codes_purpose_check
    CHECK (purpose IN ('login', 'login_email', 'login_phone', 'signup'));
