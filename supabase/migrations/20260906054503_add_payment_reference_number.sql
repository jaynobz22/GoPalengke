/*
# Add payment reference number to orders

1. Modified Tables
- `orders`: Added `payment_reference` column (text, nullable) to store the buyer's GCash/Maya payment reference number as proof of payment.

2. Security
- No changes to RLS policies. The existing order policies already allow buyers to update their own orders and sellers to read orders for their store.

3. Important Notes
- This column is optional — buyers can still mark as paid without it, but it's strongly encouraged as proof.
- The seller can view this reference number in the order detail to verify payment in their GCash/Maya account.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_reference text;
  END IF;
END $$;
