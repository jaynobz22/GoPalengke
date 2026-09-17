/*
# Add phone and linked_user_id to affiliates

1. Modified Tables
- `affiliates`
  - Add `phone` (text, nullable) — affiliate's phone number, same as their GoPalengke account
  - Add `linked_user_id` (uuid, nullable, FK -> profiles.id) — optional link to existing GoPalengke user (seller/rider/buyer)
2. Security
  - No policy changes needed; existing public INSERT/SELECT/UPDATE policies already cover the new columns.
3. Notes
  - Allows any existing GoPalengke user (seller, rider, buyer) to register as an affiliate
    using the same email and phone number. The linked_user_id connects the affiliate
    account to their main GoPalengke profile when the email matches.
*/

ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_affiliates_linked_user_id ON affiliates(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_phone ON affiliates(phone);
