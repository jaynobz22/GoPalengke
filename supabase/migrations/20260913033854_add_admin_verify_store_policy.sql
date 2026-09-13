-- Allow admins to verify stores (set is_verified = true).
-- The existing stores_update_own policy only allows the store owner to update,
-- so admin verification was silently failing due to RLS.

-- 1. Add an RLS policy allowing admins to update is_verified on any store.
--    We restrict the CHECK to only allow changing is_verified (not other columns),
--    but RLS policies can't do column-level restrictions. Instead we use a
--    SECURITY DEFINER function for the actual verification, and this policy
--    just allows admin SELECT access (already covered by stores_select_all).
--    For UPDATE, we add a policy that allows admins (role = 'admin') to update.

-- First, check if an admin profiles policy helper exists. We use a subquery
-- on profiles to check the admin role.

CREATE POLICY "stores_update_admin_verify"
  ON stores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 2. Create a SECURITY DEFINER function that:
--    - Verifies the caller is an admin
--    - Sets is_verified = true on the store
--    - Also sets is_open = true so the store becomes active
--    This is safer than a raw UPDATE because it enforces the admin check
--    server-side and only touches the verification columns.

CREATE OR REPLACE FUNCTION admin_verify_store(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO is_admin
  FROM profiles
  WHERE id = auth.uid();

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  UPDATE stores
  SET is_verified = true, is_open = true, updated_at = now()
  WHERE id = p_store_id;

  RETURN FOUND;
END;
$$;

-- Grant execute to authenticated users (the function itself checks admin role)
GRANT EXECUTE ON FUNCTION admin_verify_store(uuid) TO authenticated;
