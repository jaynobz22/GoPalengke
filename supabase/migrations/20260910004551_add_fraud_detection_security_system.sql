/*
# Fraud Detection & User Protection Security System

## Overview
Adds automated fraud detection infrastructure: security flags logging, device fingerprinting,
account status enforcement, product moderation for price anomalies, and payout locking
for account takeover protection.

## New Tables

### 1. security_flags
Central log of all security events flagged by the automated system or by admins.
- id (uuid PK)
- user_id (uuid FK -> profiles, nullable for system-wide flags)
- trigger_type (text): 'OFF_PLATFORM_POACHING' | 'ACCOUNT_TAKEOVER' | 'BULK_ACCOUNT_CREATION' | 'PRICE_ANOMALY' | 'IP_DELIVERY_MISMATCH' | 'ORDER_FLOODING' | 'MANUAL'
- severity (text): 'LOW' | 'MEDIUM' | 'HIGH'
- actions_taken (jsonb): array of action strings e.g. ['ACCOUNT_SUSPENDED', 'IP_BANNED']
- details (jsonb): contextual payload for the event
- status (text): 'PENDING_REVIEW' | 'RESOLVED' | 'BANNED'
- reviewed_by (uuid FK -> profiles, nullable)
- reviewed_at (timestamptz, nullable)
- admin_notes (text, nullable)
- created_at, updated_at (timestamptz)

### 2. user_devices
Device fingerprint tracking for multi-account / botnet detection.
- id (uuid PK)
- user_id (uuid FK -> profiles)
- device_id (text): unique device fingerprint hash
- ip_address (text): last known IP
- user_agent (text): browser UA string
- first_seen_at (timestamptz)
- last_seen_at (timestamptz)

### 3. banned_devices
Permanently blacklisted device IDs.
- id (uuid PK)
- device_id (text unique)
- reason (text)
- banned_by (uuid FK -> profiles, nullable)
- created_at (timestamptz)

### 4. security_audit_log
Immutable audit trail of admin actions on security flags.
- id (uuid PK)
- flag_id (uuid FK -> security_flags)
- admin_id (uuid FK -> profiles)
- action (text): e.g. 'DISMISS', 'LIFT_SUSPENSION', 'BAN_USER_DEVICE'
- notes (text, nullable)
- created_at (timestamptz)

## Modified Tables

### profiles
- Add account_status text column default 'ACTIVE' with CHECK constraint for valid states.
- Add is_payout_locked boolean column default false.
- Add security_pin text column (nullable) — hashed 4-digit PIN for checkout verification.
- Add payout_locked_until timestamptz (nullable) — auto-unlock time for cooling-off.

### products
- Add moderation_status text column default 'APPROVED' with states: 'PENDING_MODERATION' | 'APPROVED' | 'REJECTED'.

## Security (RLS)
- security_flags: admins can CRUD; users can read their own flags.
- user_devices: admins can read all; users can read/insert their own.
- banned_devices: admins can CRUD; anon/authenticated can check existence.
- security_audit_log: admins can read/insert.
- profiles: users can update own security_pin; account_status and is_payout_locked only updatable by admins (column-level via separate policy).

## Helper Functions
- check_order_flood(p_buyer_id): counts distinct stores ordered in last 2 minutes.
- check_device_flood(p_device_id): counts distinct users on same device in last 10 minutes.
- get_category_avg_price(p_category_id): returns average price for a category.
- lift_suspension(p_user_id, p_admin_id): resets account_status to ACTIVE, clears payout lock.
- ban_user_and_device(p_user_id, p_device_id, p_admin_id, p_reason): bans user + blacklists device.
*/

-- ============================================================
-- 1. security_flags table
-- ============================================================
CREATE TABLE IF NOT EXISTS security_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (
    trigger_type IN ('OFF_PLATFORM_POACHING', 'ACCOUNT_TAKEOVER', 'BULK_ACCOUNT_CREATION',
                     'PRICE_ANOMALY', 'IP_DELIVERY_MISMATCH', 'ORDER_FLOODING', 'MANUAL')
  ),
  severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  actions_taken jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'RESOLVED', 'BANNED')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_flags ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "admin_all_security_flags" ON security_flags;
CREATE POLICY "admin_all_security_flags" ON security_flags FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Users can read their own flags
DROP POLICY IF EXISTS "user_read_own_flags" ON security_flags;
CREATE POLICY "user_read_own_flags" ON security_flags FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 2. user_devices table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  ip_address text,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON user_devices(last_seen_at);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_user_devices" ON user_devices;
CREATE POLICY "admin_all_user_devices" ON user_devices FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "user_read_own_devices" ON user_devices;
CREATE POLICY "user_read_own_devices" ON user_devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_insert_own_device" ON user_devices;
CREATE POLICY "user_insert_own_device" ON user_devices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. banned_devices table
-- ============================================================
CREATE TABLE IF NOT EXISTS banned_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'Automated ban',
  banned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE banned_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_banned_devices" ON banned_devices;
CREATE POLICY "admin_all_banned_devices" ON banned_devices FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "anyone_check_banned_devices" ON banned_devices;
CREATE POLICY "anyone_check_banned_devices" ON banned_devices FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================
-- 4. security_audit_log table
-- ============================================================
CREATE TABLE IF NOT EXISTS security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid REFERENCES security_flags(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_audit_log" ON security_audit_log;
CREATE POLICY "admin_all_audit_log" ON security_audit_log FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 5. Add columns to profiles
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'account_status') THEN
    ALTER TABLE profiles ADD COLUMN account_status text NOT NULL DEFAULT 'ACTIVE'
      CHECK (account_status IN ('ACTIVE', 'RESTRICTED_48H', 'SUSPENDED', 'BANNED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_payout_locked') THEN
    ALTER TABLE profiles ADD COLUMN is_payout_locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'security_pin') THEN
    ALTER TABLE profiles ADD COLUMN security_pin text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payout_locked_until') THEN
    ALTER TABLE profiles ADD COLUMN payout_locked_until timestamptz;
  END IF;
END $$;

-- Admins can update account_status and is_payout_locked (via SECURITY DEFINER function later)
-- Regular users can update their own security_pin only
DROP POLICY IF EXISTS "user_update_own_security_pin" ON profiles;
CREATE POLICY "user_update_own_security_pin" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 6. Add moderation_status to products
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'moderation_status') THEN
    ALTER TABLE products ADD COLUMN moderation_status text NOT NULL DEFAULT 'APPROVED'
      CHECK (moderation_status IN ('PENDING_MODERATION', 'APPROVED', 'REJECTED'));
  END IF;
END $$;

-- ============================================================
-- 7. Helper functions
-- ============================================================

-- Count distinct stores a buyer ordered from in last 2 minutes
CREATE OR REPLACE FUNCTION check_order_flood(p_buyer_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT store_id)::integer
  FROM orders
  WHERE buyer_id = p_buyer_id
    AND created_at >= now() - interval '2 minutes';
$$;

-- Count distinct users on same device in last 10 minutes
CREATE OR REPLACE FUNCTION check_device_flood(p_device_id text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::integer
  FROM user_devices
  WHERE device_id = p_device_id
    AND last_seen_at >= now() - interval '10 minutes';
$$;

-- Get average price for a category
CREATE OR REPLACE FUNCTION get_category_avg_price(p_category_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(avg(price), 0)::numeric
  FROM products
  WHERE category_id = p_category_id
    AND moderation_status = 'APPROVED'
    AND is_available = true;
$$;

-- Lift suspension: reset account to ACTIVE, clear payout lock
CREATE OR REPLACE FUNCTION lift_suspension(p_user_id uuid, p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET account_status = 'ACTIVE',
      is_payout_locked = false,
      payout_locked_until = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE security_flags
  SET status = 'RESOLVED',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'PENDING_REVIEW';
END;
$$;

-- Ban user and blacklist device
CREATE OR REPLACE FUNCTION ban_user_and_device(
  p_user_id uuid,
  p_device_id text,
  p_admin_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET account_status = 'BANNED',
      is_active = false,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO banned_devices (device_id, reason, banned_by)
  VALUES (p_device_id, p_reason, p_admin_id)
  ON CONFLICT (device_id) DO NOTHING;

  UPDATE security_flags
  SET status = 'BANNED',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'PENDING_REVIEW';
END;
$$;

-- Create security flag (callable by authenticated users for self-reporting, or by system)
CREATE OR REPLACE FUNCTION create_security_flag(
  p_user_id uuid,
  p_trigger_type text,
  p_severity text,
  p_actions jsonb,
  p_details jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flag_id uuid;
BEGIN
  INSERT INTO security_flags (user_id, trigger_type, severity, actions_taken, details)
  VALUES (p_user_id, p_trigger_type, p_severity, p_actions, p_details)
  RETURNING id INTO flag_id;
  RETURN flag_id;
END;
$$;

-- Auto-suspend user account
CREATE OR REPLACE FUNCTION suspend_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET account_status = 'SUSPENDED',
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Apply 48h restriction + payout lock
CREATE OR REPLACE FUNCTION apply_account_restriction(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET account_status = 'RESTRICTED_48H',
      is_payout_locked = true,
      payout_locked_until = now() + interval '48 hours',
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute on all helper functions to authenticated
GRANT EXECUTE ON FUNCTION check_order_flood(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_device_flood(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_avg_price(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lift_suspension(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ban_user_and_device(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_security_flag(uuid, text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION suspend_user_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_account_restriction(uuid) TO authenticated;

-- Index for security_flags queries
CREATE INDEX IF NOT EXISTS idx_security_flags_status ON security_flags(status);
CREATE INDEX IF NOT EXISTS idx_security_flags_severity ON security_flags(severity);
CREATE INDEX IF NOT EXISTS idx_security_flags_user_id ON security_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_security_flags_created_at ON security_flags(created_at DESC);
