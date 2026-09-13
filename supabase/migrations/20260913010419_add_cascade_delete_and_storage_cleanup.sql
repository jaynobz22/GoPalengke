/*
# Cascade Delete for User Data + Automatic Storage Cleanup

## Purpose
When an admin deletes a user, all their associated data should be automatically removed — both database rows and uploaded files (profile pictures, product images, store images, chat images, payment screenshots). This migration ensures no orphaned files remain in Supabase Storage after a user is deleted.

## Changes

### 1. Foreign Key Updates (SET NULL → CASCADE)
Changed the following foreign keys from ON DELETE SET NULL to ON DELETE CASCADE so that deleting a profile automatically removes all their associated records:

- `security_flags.user_id` → profiles (was SET NULL, now CASCADE)
  - When a user is deleted, their security flags are removed too
- `email_campaign_recipients.user_id` → profiles (was SET NULL, now CASCADE)
  - When a user is deleted, they're removed from campaign recipient lists

**Kept as SET NULL** (intentionally preserved for audit trail):
- `announcements.created_by` — preserves who created an announcement
- `banned_devices.banned_by` — preserves admin audit trail
- `email_campaigns.created_by` — preserves who created a campaign
- `fee_payments.approved_by` — preserves approval audit trail
- `orders.rider_id` — rider is optional, orders shouldn't be deleted when rider is removed
- `platform_qr_codes.created_by` — preserves system audit trail
- `platform_settings.updated_by` — preserves system audit trail
- `security_audit_log.admin_id` — preserves security audit trail
- `security_flags.reviewed_by` — preserves who reviewed a flag

### 2. Storage Cleanup Function
Created `cleanup_user_storage(p_user_id uuid)` — a SECURITY DEFINER function that:
- Deletes all files owned by the user across all storage buckets (profile-images, product-images, store-images, chat-images, payment-screenshots, product-catalog)
- Uses the `storage.objects` table to find files by owner
- Calls `storage.del` internal function to remove objects
- Handles errors gracefully without blocking the user deletion

### 3. Updated admin_delete_user Function
Modified the existing `admin_delete_user` function to:
1. Call `cleanup_user_storage` before deleting the profile
2. Then delete the profile row (cascades to all related tables)
3. Then delete the auth.users entry

### Security
- `cleanup_user_storage` is SECURITY DEFINER with EXECUTE limited to `authenticated` role
- `admin_delete_user` remains SECURITY DEFINER and verifies admin role before proceeding
- No new RLS policies needed — these are server-side functions
*/

-- ============================================================
-- 1. Update foreign keys from SET NULL to CASCADE
-- ============================================================

-- security_flags.user_id: SET NULL → CASCADE
ALTER TABLE public.security_flags
  DROP CONSTRAINT IF EXISTS security_flags_user_id_fkey;
ALTER TABLE public.security_flags
  ADD CONSTRAINT security_flags_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- email_campaign_recipients.user_id: SET NULL → CASCADE
ALTER TABLE public.email_campaign_recipients
  DROP CONSTRAINT IF EXISTS email_campaign_recipients_user_id_fkey;
ALTER TABLE public.email_campaign_recipients
  ADD CONSTRAINT email_campaign_recipients_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Create storage cleanup function
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_user_storage(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bucket text;
  v_name text;
  v_deleted_count integer := 0;
BEGIN
  -- Iterate over all storage buckets and delete files owned by this user
  FOR v_bucket, v_name IN
    SELECT o.bucket_id, o.name
    FROM storage.objects o
    WHERE o.owner = p_user_id
      AND o.is_delete_marker = false
  LOOP
    -- Use the internal storage delete function
    BEGIN
      PERFORM storage.del(v_bucket, ARRAY[v_name]);
      v_deleted_count := v_deleted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Skip individual file errors — don't block user deletion
      RAISE NOTICE 'Failed to delete file % from bucket %: %', v_name, v_bucket, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Deleted % storage files for user %', v_deleted_count, p_user_id;
END;
$$;

-- Limit execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.cleanup_user_storage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_user_storage(uuid) TO authenticated;

-- ============================================================
-- 3. Update admin_delete_user to clean up storage first
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid, p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  -- Clean up all storage files owned by this user (profile pics, product images, etc.)
  PERFORM public.cleanup_user_storage(p_user_id);

  -- Delete the profile row (cascades to all related tables via FK)
  DELETE FROM profiles WHERE id = p_user_id;

  -- Delete the auth.users entry
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;

-- Ensure admin_delete_user is only executable by authenticated users
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, uuid) TO authenticated;
