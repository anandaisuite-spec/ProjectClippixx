-- =============================================
-- 013: User MFA (app-level TOTP, independent of Firebase)
--   Stores a per-user TOTP secret + hashed backup recovery codes.
--   secret is base32 (otplib). Backup codes are stored only as
--   SHA-256 hashes — the plaintext is shown to the user once.
-- =============================================

CREATE TABLE IF NOT EXISTS user_mfa (
  user_id       TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  secret        TEXT NOT NULL CHECK (length(secret) <= 256),
  is_enabled    BOOLEAN NOT NULL DEFAULT false,
  -- Array of SHA-256 hex hashes of single-use backup codes.
  backup_codes  TEXT[] NOT NULL DEFAULT '{}',
  enabled_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_enabled ON user_mfa(is_enabled);

-- Auto-update updated_at (shared function from migration 002)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_mfa_updated_at'
  ) THEN
    CREATE TRIGGER update_user_mfa_updated_at
      BEFORE UPDATE ON user_mfa
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
