-- =============================================
-- 011: Create Reviews Table
--   One review per completed order. Recomputes the star's
--   rating + reviews_count automatically via trigger.
-- =============================================

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  star_id     UUID NOT NULL REFERENCES stars(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 2000),
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_star    ON reviews(star_id);
CREATE INDEX IF NOT EXISTS idx_reviews_author  ON reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_reviews_visible ON reviews(is_visible);

-- Auto-update updated_at (shared function from migration 002)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_reviews_updated_at'
  ) THEN
    CREATE TRIGGER update_reviews_updated_at
      BEFORE UPDATE ON reviews
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================
-- Recompute star rating + reviews_count
--   Only visible reviews count toward the aggregate.
--   When a star has no visible reviews, rating falls back to 5.0.
-- =============================================
CREATE OR REPLACE FUNCTION recompute_star_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_star UUID;
BEGIN
  target_star := COALESCE(NEW.star_id, OLD.star_id);

  UPDATE stars s
  SET
    rating = COALESCE((
      SELECT ROUND(AVG(r.rating)::numeric, 1)
      FROM reviews r
      WHERE r.star_id = target_star AND r.is_visible = true
    ), 5.0),
    reviews_count = (
      SELECT COUNT(*)
      FROM reviews r
      WHERE r.star_id = target_star AND r.is_visible = true
    )
  WHERE s.id = target_star;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reviews_recompute_rating'
  ) THEN
    CREATE TRIGGER trg_reviews_recompute_rating
      AFTER INSERT OR UPDATE OR DELETE ON reviews
      FOR EACH ROW
      EXECUTE FUNCTION recompute_star_rating();
  END IF;
END $$;
