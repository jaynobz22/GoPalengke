/*
# Allow public (anon) read access to profiles

## Why
The landing page reviews marquee joins reviews with profiles to show the reviewer's
name and avatar. The profiles SELECT policy was scoped to `authenticated` only,
so anonymous visitors (anon key) got null on the join — every reviewer showed as
"Anonymous". Profiles (name, avatar) are public data already visible on store/user
pages, so allowing anon read is safe and consistent.

## Changes
- Drop and recreate `profiles_select_all_authenticated` to include `anon`.
- INSERT/UPDATE/DELETE policies remain unchanged (authenticated only, ownership-scoped).
*/

DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON profiles;
CREATE POLICY "profiles_select_all_authenticated" ON profiles FOR SELECT
  TO anon, authenticated USING (true);
