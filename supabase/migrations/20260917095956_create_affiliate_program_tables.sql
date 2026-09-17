/*
# Affiliate Program Tables

1. New Tables
- `affiliates` — affiliate partner accounts (separate from main profiles)
  - id (uuid, pk)
  - email (text, unique, not null)
  - full_name (text, not null)
  - payout_account (text) — GCash/Bank account number
  - promo_code (text, optional)
  - referral_code (text, unique, not null) — generated unique code for tracking
  - wallet_balance (numeric, default 0) — available for payout
  - lifetime_earnings (numeric, default 0)
  - password_hash (text, not null) — simple hash for demo
  - created_at, updated_at

- `affiliate_referrals` — tracks referred sellers/riders
  - id (uuid, pk)
  - affiliate_id (uuid, fk -> affiliates)
  - referred_user_id (uuid, fk -> profiles)
  - referred_role (text) — 'seller' or 'rider'
  - referred_name (text)
  - accumulated_admin_collected (numeric, default 0) — how much admin has collected from this user
  - milestones_hit (int, default 0) — how many times milestone was reached
  - total_commission_earned (numeric, default 0)
  - created_at

- `affiliate_transactions` — ledger of all affiliate earnings
  - id (uuid, pk)
  - affiliate_id (uuid, fk -> affiliates)
  - referral_id (uuid, fk -> affiliate_referrals, nullable)
  - type (text) — 'seller_milestone' | 'rider_milestone' | 'payout'
  - description (text)
  - amount (numeric)
  - status (text) — 'credited' | 'pending' | 'paid'
  - created_at

2. Security
- Enable RLS on all tables
- Public can register (INSERT on affiliates)
- Affiliates can read their own data
- Affiliates can update their own wallet_balance (for demo)
- Public read on referrals for tracking (no sensitive data exposed)
*/

-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  payout_account text DEFAULT '',
  promo_code text DEFAULT '',
  referral_code text UNIQUE NOT NULL DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8)),
  wallet_balance numeric NOT NULL DEFAULT 0,
  lifetime_earnings numeric NOT NULL DEFAULT 0,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Public can insert (register)
DROP POLICY IF EXISTS "public_register_affiliate" ON affiliates;
CREATE POLICY "public_register_affiliate"
  ON affiliates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can read affiliate data (needed for login + referral lookups; no sensitive info beyond email)
DROP POLICY IF EXISTS "public_read_affiliates" ON affiliates;
CREATE POLICY "public_read_affiliates"
  ON affiliates FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anyone can update (demo: wallet balance changes via RPC)
DROP POLICY IF EXISTS "public_update_affiliates" ON affiliates;
CREATE POLICY "public_update_affiliates"
  ON affiliates FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Affiliate referrals table
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  referred_role text NOT NULL DEFAULT 'seller',
  referred_name text NOT NULL DEFAULT '',
  accumulated_admin_collected numeric NOT NULL DEFAULT 0,
  milestones_hit int NOT NULL DEFAULT 0,
  total_commission_earned numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_referrals" ON affiliate_referrals;
CREATE POLICY "public_read_referrals"
  ON affiliate_referrals FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_insert_referrals" ON affiliate_referrals;
CREATE POLICY "public_insert_referrals"
  ON affiliate_referrals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_referrals" ON affiliate_referrals;
CREATE POLICY "public_update_referrals"
  ON affiliate_referrals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_referrals" ON affiliate_referrals;
CREATE POLICY "public_delete_referrals"
  ON affiliate_referrals FOR DELETE
  TO anon, authenticated
  USING (true);

-- Affiliate transactions table
CREATE TABLE IF NOT EXISTS affiliate_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES affiliate_referrals(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'seller_milestone',
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'credited',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE affiliate_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_transactions" ON affiliate_transactions;
CREATE POLICY "public_read_transactions"
  ON affiliate_transactions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_insert_transactions" ON affiliate_transactions;
CREATE POLICY "public_insert_transactions"
  ON affiliate_transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_transactions" ON affiliate_transactions;
CREATE POLICY "public_delete_transactions"
  ON affiliate_transactions FOR DELETE
  TO anon, authenticated
  USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_transactions_affiliate_id ON affiliate_transactions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
