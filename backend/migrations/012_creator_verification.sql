-- =============================================
-- 012: Creator Verification
--   Adds social links, identity proof and a verification
--   badge directly on the stars table, plus a status field
--   to drive the admin approval workflow.
-- =============================================

ALTER TABLE stars
  ADD COLUMN IF NOT EXISTS owner_id            TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instagram_url       TEXT CHECK (length(instagram_url) <= 2048),
  ADD COLUMN IF NOT EXISTS twitter_url         TEXT CHECK (length(twitter_url) <= 2048),
  ADD COLUMN IF NOT EXISTS youtube_url         TEXT CHECK (length(youtube_url) <= 2048),
  ADD COLUMN IF NOT EXISTS tiktok_url          TEXT CHECK (length(tiktok_url) <= 2048),
  ADD COLUMN IF NOT EXISTS identity_proof_url  TEXT CHECK (length(identity_proof_url) <= 2048),
  ADD COLUMN IF NOT EXISTS is_verified         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_notes  TEXT CHECK (length(verification_notes) <= 2000),
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stars_verification_status ON stars(verification_status);
CREATE INDEX IF NOT EXISTS idx_stars_is_verified         ON stars(is_verified);
CREATE INDEX IF NOT EXISTS idx_stars_owner               ON stars(owner_id);
