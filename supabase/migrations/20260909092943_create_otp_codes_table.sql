/*
# Create OTP codes table for custom email verification

1. New Tables
- `otp_codes`
  - `id` (uuid, primary key)
  - `email` (text, not null) — the email address being verified
  - `code` (text, not null) — the 6-digit OTP code
  - `expires_at` (timestamptz, not null) — when the code expires (10 minutes)
  - `used` (boolean, default false) — whether the code has been used
  - `attempts` (integer, default 0) — number of failed verification attempts
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `otp_codes`.
- Allow anon + authenticated to insert (for sending OTP).
- Allow anon + authenticated to read and update (for verifying OTP).
- No delete policy needed — cleanup via scheduled job or expiry check.

3. Notes
- Codes expire after 10 minutes.
- Max 5 verification attempts per code.
- Used codes are marked as used to prevent replay.
*/