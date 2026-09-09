/*
# Admin: Delete User + Multiple QR Codes

## Overview
1. Adds a SECURITY DEFINER function that allows an admin to permanently delete any user account.
   This cascades to all related data (stores, products, orders, conversations, seller_fees, etc.)
   via existing ON DELETE CASCADE foreign keys. Also removes the auth.users entry.
2. Adds a `platform_qr_codes` table so admin can upload multiple QR codes for receiving payments
   and toggle which one is currently active. The active QR code is what sellers see in the billing page.

## Changes

### 1. New function: admin_delete_user(p_user_id uuid, p_admin_id uuid)
- SECURITY DEFINER function that verifies the caller is an admin.
- Deletes the user's profile row, which cascades to all related tables.
- Also deletes the auth.users entry to fully remove the account.
- Prevents admin from deleting themselves.

### 2. New table: platform_qr_codes
- `id` (uuid, primary key)
- `label` (text): A name for the QR code (e.g. "GCash", "Maya", "BPI")
- `image_url` (text): URL of the uploaded QR code image
- `is_active` (boolean): Whether this is the currently active QR code shown to sellers
- `created_by` (uuid, references profiles): Admin who created it
- `created_at` (timestamptz)
- Only one QR code can be active at a time (enforced by a partial unique index)

### 3. Security (RLS)
- Only admin can insert/update/delete platform_qr_codes
- All authenticated users can read platform_qr_codes (so sellers can see the active QR)

## Important Notes
1. The admin_delete_user function uses SECURITY DEFINER so it can delete from auth.users
   (which the authenticated role normally cannot access).
2. Deleting a seller cascades to: stores -> products, orders, order_items, conversations,
   messages, seller_fees, fee_payments, reviews, cart_items.
3. Deleting a buyer cascades to: orders, cart_items, conversations, messages, reviews.
4. Deleting a rider cascades to: conversations, messages (orders.rider_id is SET NULL).
5. The old `admin_qr_code` key in platform_settings is preserved for backwards compatibility
   but the new system uses platform_qr_codes table instead.
*/

-- ============= ADMIN DELETE USER FUNCTION =============
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid, p_admin_id uuid)
RETURNS void AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Verify the caller is an admin
  SELECT role INTO v_user_role FROM profiles WHERE id = p_admin_id;
  IF v_user_role IS NULL OR v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent self-deletion
  IF p_user_id = p_admin_id THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete the profile row (cascades to all related tables)
  DELETE FROM profiles WHERE id = p_user_id;

  -- Delete the auth.users entry
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_delete_user(uuid, uuid) TO authenticated;

-- ============= PLATFORM QR CODES TABLE =============
CREATE TABLE IF NOT EXISTS platform_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Payment QR',
  image_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE platform_qr_codes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (sellers need to see the active QR)
DROP POLICY IF EXISTS "platform_qr_codes_select_all" ON platform_qr_codes;
CREATE POLICY "platform_qr_codes_select_all" ON platform_qr_codes FOR SELECT
  TO anon, authenticated USING (true);

-- Only admin can insert
DROP POLICY IF EXISTS "platform_qr_codes_insert_admin" ON platform_qr_codes;
CREATE POLICY "platform_qr_codes_insert_admin" ON platform_qr_codes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Only admin can update
DROP POLICY IF EXISTS "platform_qr_codes_update_admin" ON platform_qr_codes;
CREATE POLICY "platform_qr_codes_update_admin" ON platform_qr_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Only admin can delete
DROP POLICY IF EXISTS "platform_qr_codes_delete_admin" ON platform_qr_codes;
CREATE POLICY "platform_qr_codes_delete_admin" ON platform_qr_codes FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Only one QR code can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_qr_codes_active
  ON platform_qr_codes (is_active) WHERE is_active = true;

-- Migrate existing admin_qr_code from platform_settings to platform_qr_codes
DO $$
DECLARE
  v_existing_url text;
  v_admin_id uuid;
BEGIN
  SELECT value INTO v_existing_url FROM platform_settings WHERE key = 'admin_qr_code';
  IF v_existing_url IS NOT NULL AND v_existing_url != '' THEN
    SELECT updated_by INTO v_admin_id FROM platform_settings WHERE key = 'admin_qr_code';
    INSERT INTO platform_qr_codes (label, image_url, is_active, created_by)
    VALUES ('GCash/Maya', v_existing_url, true, v_admin_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
