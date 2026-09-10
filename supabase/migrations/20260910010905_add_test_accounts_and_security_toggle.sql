-- Add is_test_account flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;

-- Add a platform setting to toggle device fingerprint checks globally
-- (used during testing; when false, device checks are skipped for everyone)
INSERT INTO platform_settings (key, value)
VALUES ('security_device_check_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Allow admins to manage is_test_account
CREATE POLICY "admin_update_test_account_flag"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow admins to read platform_settings
CREATE POLICY "admin_read_platform_settings"
  ON platform_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow admins to update platform_settings
CREATE POLICY "admin_update_platform_settings"
  ON platform_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
