/*
# Allow public (anon) read access to reviews

## Why
The landing page displays buyer reviews for sellers and riders in an animated marquee.
The reviews table's SELECT policy was scoped to `authenticated` only, so anonymous
visitors (anon key) got zero rows — the marquee never appeared on the homepage.

## Changes
- Drop and recreate `reviews_select_all` policy to include `anon` alongside `authenticated`.
- Reviews are public reputation data (rating + comment + reviewer name), safe to show to everyone.
- INSERT / UPDATE / DELETE policies remain unchanged (authenticated only, ownership-scoped).
*/

DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT
  TO anon, authenticated USING (true);
