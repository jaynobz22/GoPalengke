/*
# Add house_photo_url to profiles

## Purpose
Buyers are now required to upload a photo of the outside of their house
(showing the door or gate) so riders can easily identify which house to
deliver to. This photo is stored in the profile-images storage bucket and
shown to the assigned rider on the delivery detail screen.

## Changes
1. Adds `house_photo_url` (text, nullable) column to `profiles`.
   - Nullable so existing profiles are not broken on migration.
   - The frontend will require it before checkout (UI-level enforcement).
2. No new tables.
3. No RLS policy changes needed — the existing profiles UPDATE policy
   already allows users to update their own row, and the existing SELECT
   policy already allows authenticated users to read profiles (needed so
   riders can see the house photo of the buyer they are delivering to).

## Security
- No new policies. Existing profile RLS covers this column.
- The column is user-editable (buyer uploads their own house photo) which
  is the intended behavior.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS house_photo_url text;
