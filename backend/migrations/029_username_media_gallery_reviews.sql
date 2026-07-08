-- =============================================
-- 029: Username, media (avatar/cover), gallery, and booking reviews
--
-- IMPORTANT conflict note:
-- A `reviews` table already exists (migration 011), keyed on order_id with
-- star_id/author_id/comment and its own stars.rating sync trigger. To avoid
-- colliding with that working system, the spec's "reviews" feature is built
-- here as a SEPARATE `booking_reviews` table (keyed on booking_id), with its
-- own stars.avg_rating / stars.review_count columns + trigger. The legacy
-- reviews table and its trigger are left completely untouched.
-- =============================================

-- ── PART 1: username ──────────────────────────────────────────────────────────
ALTER TABLE stars ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS stars_username_idx ON stars(username);

-- ── PART 2: profile picture + cover ───────────────────────────────────────────
ALTER TABLE stars ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- ── PART 3: gallery ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES stars(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10) DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_creator_id_idx ON creator_gallery(creator_id);

-- ── PART 4: booking reviews (separate from legacy `reviews`) ───────────────────
CREATE TABLE IF NOT EXISTS booking_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  creator_id UUID REFERENCES stars(id) ON DELETE CASCADE,
  fan_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_reviews_creator_id_idx ON booking_reviews(creator_id);

-- Dedicated aggregate columns (separate from the legacy rating/reviews_count
-- maintained by the order-based reviews system).
ALTER TABLE stars ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE stars ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION sync_star_booking_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stars SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2) FROM booking_reviews
      WHERE creator_id = COALESCE(NEW.creator_id, OLD.creator_id)
    ), 0),
    review_count = (
      SELECT COUNT(*) FROM booking_reviews
      WHERE creator_id = COALESCE(NEW.creator_id, OLD.creator_id)
    )
  WHERE id = COALESCE(NEW.creator_id, OLD.creator_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'booking_reviews_sync_rating') THEN
    CREATE TRIGGER booking_reviews_sync_rating
      AFTER INSERT OR UPDATE OR DELETE ON booking_reviews
      FOR EACH ROW EXECUTE FUNCTION sync_star_booking_rating();
  END IF;
END $$;
