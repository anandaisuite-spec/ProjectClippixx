-- =============================================
-- 030: Booking request fields
-- Step 1 of the booking flow collects more than the bookings table held.
-- Add structured columns for the request details.
-- =============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_for VARCHAR(20)
  CHECK (video_for IN ('myself', 'someone_else'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS occasion VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gift_recipient_name VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gift_recipient_email VARCHAR(320);
