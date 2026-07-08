-- =============================================
-- 031: Widen star_suggestions category constraint
--
-- The "Suggest a Star" form offers more categories (Comedian, Reality TV,
-- Other, …) than the original check (Actor/Athlete/Creator/Musician), so those
-- submissions were rejected by the DB CHECK constraint. Widen it to the full
-- frontend set. When "Other" is chosen, the specific type is captured in the
-- free-text `reason` field by the client.
-- =============================================

ALTER TABLE star_suggestions DROP CONSTRAINT IF EXISTS star_suggestions_category_check;
ALTER TABLE star_suggestions ADD CONSTRAINT star_suggestions_category_check CHECK (
  category = ANY (ARRAY[
    'Actor', 'Athlete', 'Creator', 'Musician',
    'Comedian', 'Reality TV', 'Other'
  ])
);
