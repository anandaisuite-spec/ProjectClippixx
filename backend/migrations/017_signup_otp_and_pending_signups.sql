-- Extend otp_codes to support both email and phone channels, and a purpose field
ALTER TABLE otp_codes ALTER COLUMN email DROP NOT NULL;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'login'
    CHECK (purpose IN ('login', 'signup'));
ALTER TABLE otp_codes ADD CONSTRAINT otp_identifier_check
    CHECK (email IS NOT NULL OR phone IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);

-- Pending signups: holds unverified signup data until both OTPs are confirmed
CREATE TABLE IF NOT EXISTS pending_signups (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  phone            TEXT        NOT NULL,
  password_encrypted TEXT      NOT NULL,
  email_verified   BOOLEAN     NOT NULL DEFAULT false,
  phone_verified   BOOLEAN     NOT NULL DEFAULT false,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
