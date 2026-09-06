/*
# Add Admin Role and Announcements Table

## Overview
Adds an 'admin' user role to the profiles table and creates an announcements table
for the admin dashboard to manage scrolling announcement messages on the homepage.

## Changes

### 1. Modified Tables
- `profiles` — Added 'admin' to the role CHECK constraint so admin accounts can exist.
  Existing rows are unaffected; the constraint now accepts 'buyer', 'seller', 'rider', 'admin'.

### 2. New Tables
- `announcements`
  - `id` (uuid, primary key)
  - `message` (text, not null) — The announcement text shown in the scrolling bar
  - `is_active` (boolean, default true) — Whether it's visible on the homepage
  - `created_by` (uuid, references profiles) — Who created the announcement
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

### 3. Security
- RLS enabled on `announcements`.
- Public read (anon + authenticated) so the homepage can fetch the active announcement
  even for visitors who are not logged in.
- Only admin users can insert, update, and delete announcements. The admin check uses
  a subquery on profiles.role = 'admin' for the current user.

## Important Notes
1. The admin role is NOT exposed in the public sign-up form by default. Admin accounts
   are created through a separate admin sign-up flow in the app.
2. Only one announcement should be active at a time — the app enforces this by
   deactivating others when a new one is set active.
*/

-- ============= ADD ADMIN ROLE TO PROFILES =============
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('buyer', 'seller', 'rider', 'admin'));

-- ============= ANNOUNCEMENTS TABLE =============
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Public can read announcements (for homepage display)
DROP POLICY IF EXISTS "announcements_select_all" ON announcements;
CREATE POLICY "announcements_select_all" ON announcements FOR SELECT
  TO anon, authenticated USING (true);

-- Only admin can insert
DROP POLICY IF EXISTS "announcements_insert_admin" ON announcements;
CREATE POLICY "announcements_insert_admin" ON announcements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Only admin can update
DROP POLICY IF EXISTS "announcements_update_admin" ON announcements;
CREATE POLICY "announcements_update_admin" ON announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Only admin can delete
DROP POLICY IF EXISTS "announcements_delete_admin" ON announcements;
CREATE POLICY "announcements_delete_admin" ON announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);

-- ============= UPDATED_AT TRIGGER =============
DROP TRIGGER IF EXISTS trigger_announcements_updated ON announcements;
CREATE TRIGGER trigger_announcements_updated BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============= SEED DEFAULT ANNOUNCEMENT =============
INSERT INTO announcements (message, is_active)
SELECT 'Maligayang pagdating sa GoPalengke! Ang unang online wet market sa Pilipinas.', true
WHERE NOT EXISTS (SELECT 1 FROM announcements);
