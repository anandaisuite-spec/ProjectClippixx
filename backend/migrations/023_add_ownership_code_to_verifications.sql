-- =============================================
-- 023: Ownership Proof Code + verification submission details
--   Verification lives on the `stars` table (see migration 012), so these
--   enhancement columns are added there. Only genuinely-missing columns are
--   added — instagram_url / youtube_url / twitter_url / tiktok_url /
--   identity_proof_url already exist from 012.
--
--   ownership_code      : backend-generated proof code (CLIPP-XXXXXX) the creator
--                         places in their bio/story/email so an admin can confirm
--                         they control the social account.
--   ownership_method    : which proof channel the creator chose.
--   follower_count      : self-reported audience size for the chosen platform.
--   platform            : the primary social platform being verified.
--   identity_proof_type : kind of ID document linked in identity_proof_url.
-- =============================================

ALTER TABLE stars
  ADD COLUMN IF NOT EXISTS ownership_code      TEXT CHECK (length(ownership_code) <= 32),
  ADD COLUMN IF NOT EXISTS ownership_method    TEXT
    CHECK (ownership_method IN ('bio', 'story', 'email')),
  ADD COLUMN IF NOT EXISTS follower_count      INTEGER CHECK (follower_count >= 0),
  ADD COLUMN IF NOT EXISTS platform            TEXT
    CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'twitter')),
  ADD COLUMN IF NOT EXISTS identity_proof_type TEXT
    CHECK (identity_proof_type IN ('aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'other'));
