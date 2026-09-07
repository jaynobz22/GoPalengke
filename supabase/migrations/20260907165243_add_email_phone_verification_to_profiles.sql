/*
# Add Email and Phone Verification to Profiles

## Summary
Adds `email_verified` and `phone_verified` boolean columns to the `profiles` table
to support a verification flow during registration. New users must verify both
their email and phone number before they can log in and access the app.

## New Columns
- `profiles.email_verified` (boolean, default false) — tracks whether the user has verified their email
- `profiles.phone_verified` (boolean, default false) — tracks whether the user has verified their phone number

## Security
- No RLS policy changes needed. Existing policies already scope by auth.uid().
- Existing users (already registered) are set to verified=true so they are not blocked.

## Important Notes
1. Existing profiles are updated to email_verified=true and phone_verified=true
   so current users are not locked out.
2. New signups will have both fields default to false.
3. The frontend will enforce the verification flow: after signup, user must verify
   email (via OTP code) and phone (via OTP code) before they can sign in.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

-- Mark all existing users as verified so they are not locked out
UPDATE profiles
  SET email_verified = true, phone_verified = true
  WHERE email_verified = false OR phone_verified = false;
