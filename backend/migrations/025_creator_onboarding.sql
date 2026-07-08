-- =============================================
-- 025: Creator Onboarding
-- Adds onboarding fields to the stars table (the public-facing creator
-- profile, which already holds category/price/bio) and creates a
-- pricing_tiers table keyed to stars.id.
--
-- NOTE: this project has no `users` table and no `creator` role. The user
-- record is `profiles` (Firebase-UID text PK); a creator is a profile with
-- account_type = 'creator'. Their public profile lives in `stars`, linked by
-- stars.owner_id = profiles.id. So the spec's columns land on `stars`.
-- =============================================

ALTER TABLE stars ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';        -- e.g. {English,Hindi}
ALTER TABLE stars ADD COLUMN IF NOT EXISTS turnaround_days INTEGER DEFAULT 7;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS accepting_bookings BOOLEAN DEFAULT true;
-- category and bio already exist on stars.

CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES stars(id) ON DELETE CASCADE,
  tier_name VARCHAR(100) NOT NULL,       -- e.g. "Shoutout", "Personalized", "Live Call"
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  delivery_days INTEGER NOT NULL DEFAULT 7 CHECK (delivery_days BETWEEN 1 AND 30),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_creator ON pricing_tiers(creator_id);
