-- Add admin update policy for profiles table
-- This allows admin to update is_approved and is_active on any user's profile
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Also allow admin to select all profiles (already covered by profiles_select_all_authenticated)
-- No additional SELECT policy needed since profiles_select_all_authenticated allows all authenticated users to SELECT

-- Allow admin to read all fee_payments (already covered by fee_payments_select_own policy which checks for admin role)
-- No additional policy needed

-- Allow admin to read all seller_fees (already covered by seller_fees_select_own policy which checks for admin role)
-- No additional policy needed
