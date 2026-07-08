-- =============================================
-- 010: Create Orders Table
--   Booking lifecycle between a buyer (fan) and a star (creator).
--   buyer_id references profiles (Firebase UID / TEXT).
--   star_id references stars (UUID).
-- =============================================

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  star_id         UUID NOT NULL REFERENCES stars(id) ON DELETE RESTRICT,
  recipient_name  TEXT NOT NULL CHECK (length(recipient_name) <= 200),
  occasion        TEXT NOT NULL CHECK (length(occasion) <= 200),
  instructions    TEXT NOT NULL DEFAULT '' CHECK (length(instructions) <= 2000),
  price           INTEGER NOT NULL CHECK (price > 0),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending',
                    'accepted',
                    'in_progress',
                    'delivered',
                    'completed',
                    'rejected',
                    'cancelled'
                  )),
  video_url       TEXT CHECK (length(video_url) <= 2048),
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer   ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_star    ON orders(star_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Auto-update updated_at (shared function from migration 002)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at'
  ) THEN
    CREATE TRIGGER update_orders_updated_at
      BEFORE UPDATE ON orders
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
