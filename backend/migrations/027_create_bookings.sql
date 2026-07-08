-- =============================================
-- 027: Bookings
-- A booking is a fan's purchase of a creator's pricing tier.
--
-- Schema note: profiles.id is TEXT (Firebase UID), so fan_id must be TEXT,
-- not UUID as a generic spec would assume. creator_id references stars(id)
-- (UUID) and tier_id references pricing_tiers(id) (UUID).
--
-- Reuses the existing update_updated_at_column() trigger fn from migration 002
-- rather than defining a duplicate.
-- =============================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES stars(id) ON DELETE CASCADE,
  fan_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES pricing_tiers(id) ON DELETE SET NULL,
  tier_name VARCHAR(100),
  tier_price NUMERIC(10, 2),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'in_progress', 'delivered', 'cancelled')),
  fan_name VARCHAR(255),
  fan_message TEXT,
  creator_note TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_creator_id_idx ON bookings(creator_id);
CREATE INDEX IF NOT EXISTS bookings_fan_id_idx ON bookings(fan_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'bookings_updated_at') THEN
    CREATE TRIGGER bookings_updated_at
      BEFORE UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
