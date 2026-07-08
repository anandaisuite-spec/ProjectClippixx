-- =============================================
-- 028: Video delivery + in-app notifications
--
-- video_url already exists on bookings (migration 027); add the remaining
-- delivery metadata. notifications.user_id is TEXT to match profiles.id
-- (Firebase UID), not UUID as a generic spec would assume.
-- =============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_filename TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_delivered_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,        -- e.g. 'video_delivered'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
