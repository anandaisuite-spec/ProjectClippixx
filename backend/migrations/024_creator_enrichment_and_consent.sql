-- =============================================
-- 024: Creator enrichment + digital consent
--
--   verification_score : 0–100 weighted score from verificationScore.js.
--   tmdb_id            : TMDB person id used to enrich this creator.
--   occupation         : occupation from TMDB/Wikidata (e.g. "Actor").
--   known_for          : JSON array of notable works (TMDB combined_credits).
--   consent_ip /
--   consent_timestamp /
--   consent_text       : digital consent captured at verification submission.
-- =============================================

ALTER TABLE stars
  ADD COLUMN IF NOT EXISTS verification_score INTEGER CHECK (verification_score >= 0 AND verification_score <= 100),
  ADD COLUMN IF NOT EXISTS tmdb_id            INTEGER,
  ADD COLUMN IF NOT EXISTS occupation         TEXT CHECK (length(occupation) <= 200),
  ADD COLUMN IF NOT EXISTS known_for          JSONB,
  ADD COLUMN IF NOT EXISTS consent_ip         TEXT CHECK (length(consent_ip) <= 64),
  ADD COLUMN IF NOT EXISTS consent_timestamp  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_text       TEXT CHECK (length(consent_text) <= 1000);
