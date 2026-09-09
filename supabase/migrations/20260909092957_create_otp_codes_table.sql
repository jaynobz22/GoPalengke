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

3. Notes
- Codes expire after 10 minutes.
- Max 5 verification attempts per code.
- Used codes are marked as used to prevent replay.
*/

CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_otp_codes" ON otp_codes;
CREATE POLICY "anon_insert_otp_codes" ON otp_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_otp_codes" ON otp_codes;
CREATE POLICY "anon_select_otp_codes" ON otp_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_otp_codes" ON otp_codes;
CREATE POLICY "anon_update_otp_codes" ON otp_codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);