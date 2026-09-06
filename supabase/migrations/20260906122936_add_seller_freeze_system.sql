-- ============= ADD FREEZE COLUMNS TO seller_fees =============
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seller_fees' AND column_name = 'grace_deadline'
  ) THEN
    ALTER TABLE seller_fees ADD COLUMN grace_deadline timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seller_fees' AND column_name = 'frozen_at'
  ) THEN
    ALTER TABLE seller_fees ADD COLUMN frozen_at timestamptz;
  END IF;
END $$;

-- ============= TRIGGER: Set/clear grace_deadline on seller_fees changes =============
-- When total_payable >= 1000 and no grace_deadline yet, set it to now() + 3 days.
-- When total_payable < 1000, clear grace_deadline and frozen_at (debt resolved).
CREATE OR REPLACE FUNCTION set_grace_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_payable >= 1000 AND NEW.grace_deadline IS NULL AND NEW.frozen_at IS NULL THEN
    NEW.grace_deadline = now() + interval '3 days';
  ELSIF NEW.total_payable < 1000 THEN
    NEW.grace_deadline = NULL;
    NEW.frozen_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_grace_deadline ON seller_fees;
CREATE TRIGGER trigger_set_grace_deadline BEFORE INSERT OR UPDATE ON seller_fees
  FOR EACH ROW EXECUTE FUNCTION set_grace_deadline();

-- ============= FUNCTION: Freeze overdue sellers =============
-- Called by the app on load. Freezes any seller whose grace_deadline has passed
-- and whose total_payable is still >= 1000.
CREATE OR REPLACE FUNCTION freeze_overdue_sellers()
RETURNS void AS $$
BEGIN
  UPDATE profiles SET is_active = false
  WHERE id IN (
    SELECT seller_id FROM seller_fees
    WHERE grace_deadline IS NOT NULL
      AND grace_deadline < now()
      AND total_payable >= 1000
      AND frozen_at IS NULL
  );

  UPDATE seller_fees SET frozen_at = now()
  WHERE grace_deadline IS NOT NULL
    AND grace_deadline < now()
    AND total_payable >= 1000
    AND frozen_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============= FUNCTION: Reactivate seller (admin only) =============
-- Clears frozen_at and grace_deadline, reactivates the account.
-- If total_payable is still >= 1000, sets a new grace_deadline.
CREATE OR REPLACE FUNCTION reactivate_seller(p_seller_id uuid)
RETURNS void AS $$
DECLARE
  is_admin boolean;
  current_fee record;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE profiles SET is_active = true WHERE id = p_seller_id;

  SELECT total_payable INTO current_fee FROM seller_fees WHERE seller_id = p_seller_id;
  IF current_fee.total_payable >= 1000 THEN
    UPDATE seller_fees
      SET frozen_at = NULL, grace_deadline = now() + interval '3 days'
      WHERE seller_id = p_seller_id;
  ELSE
    UPDATE seller_fees
      SET frozen_at = NULL, grace_deadline = NULL
      WHERE seller_id = p_seller_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION freeze_overdue_sellers() TO authenticated;
GRANT EXECUTE ON FUNCTION reactivate_seller(uuid) TO authenticated;

-- ============= INDEX =============
CREATE INDEX IF NOT EXISTS idx_seller_fees_grace_deadline ON seller_fees(grace_deadline);
CREATE INDEX IF NOT EXISTS idx_seller_fees_frozen_at ON seller_fees(frozen_at);
