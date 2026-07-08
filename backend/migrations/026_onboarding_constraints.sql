-- =============================================
-- 026: Onboarding constraint compatibility
--
-- The onboarding Profile step offers categories (Comedian, Influencer,
-- YouTuber, Podcaster, Other, …) that the original stars_category_check
-- constraint (Actor/Athlete/Creator/Musician only) rejects. Widen it to the
-- full onboarding set.
--
-- Also: onboarding auto-provisions a placeholder star before the creator has
-- set a price, but stars_price_check requires price > 0. Relax it to price >= 0
-- so a not-yet-priced creator can exist; real pricing lives in pricing_tiers.
-- =============================================

ALTER TABLE stars DROP CONSTRAINT IF EXISTS stars_category_check;
ALTER TABLE stars ADD CONSTRAINT stars_category_check CHECK (
  category = ANY (ARRAY[
    'Actor', 'Athlete', 'Creator', 'Musician',
    'Comedian', 'Influencer', 'YouTuber', 'Podcaster', 'Other'
  ])
);

ALTER TABLE stars DROP CONSTRAINT IF EXISTS stars_price_check;
ALTER TABLE stars ADD CONSTRAINT stars_price_check CHECK (price >= 0);
