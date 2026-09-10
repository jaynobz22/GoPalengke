-- Fix: seller_fees.total_sales and commission_balance were inflated because
-- three overlapping trigger migrations each applied commission to the same
-- orders without checking if it was already applied. This migration
-- recalculates all seller_fees from actual order data.
--
-- Root cause:
-- 1. Migration 20260906103519 created apply_commission_on_delivery() trigger
-- 2. Migration 20260907141434 replaced that function (same trigger name)
-- 3. Migration 20260909223653 added commission_applied flag + backfill, but
--    the backfill re-applied commission to orders that already had it from
--    the earlier triggers, causing double/triple counting.
--
-- Fix: Recalculate seller_fees from scratch using only orders where
-- commission_applied = true and status != 'cancelled'.

-- First, get the correct totals per seller
WITH correct_totals AS (
  SELECT
    s.seller_id,
    COALESCE(SUM(o.total), 0) AS correct_total_sales,
    COALESCE(SUM(o.commission_amount), 0) AS correct_commission
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.commission_applied = true
    AND o.status != 'cancelled'
  GROUP BY s.seller_id
)
-- Update seller_fees with correct values
UPDATE seller_fees sf SET
  total_sales = ct.correct_total_sales,
  commission_balance = ct.correct_commission,
  total_payable = ct.correct_commission + sf.subscription_balance,
  updated_at = now()
FROM correct_totals ct
WHERE sf.seller_id = ct.seller_id;

-- Also fix any seller_fees rows that have no paid orders at all (reset to 0)
UPDATE seller_fees sf SET
  total_sales = 0,
  commission_balance = 0,
  total_payable = 0 + sf.subscription_balance,
  updated_at = now()
WHERE sf.seller_id NOT IN (
  SELECT DISTINCT s.seller_id
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.commission_applied = true
    AND o.status != 'cancelled'
);

-- Ensure the trigger function is the correct one (from migration 20260909223653)
-- It already checks commission_applied = false before applying, so no changes needed.
-- The double-counting happened because earlier triggers didn't have this guard.
