/*
# Add COD Payment Fields to Orders

## Summary
Adds two new columns to the `orders` table to support the Cash on Delivery (COD)
payment flow where the rider collects cash from the buyer, then sends the payment
to the seller via QR code and submits a reference number.

## New Columns
- `orders.cod_payment_reference` (text, nullable) — the reference number the rider
  submits after sending the COD payment to the seller via QR code.
- `orders.cod_payment_accepted_at` (timestamptz, nullable) — timestamp when the
  seller accepts the rider's COD payment, completing the transaction.

## Security
No new tables. No policy changes needed — existing order UPDATE policies already
allow the buyer, seller, and rider to update order columns they're authorized to
modify. The new columns are updated through the same order update flow.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cod_payment_reference'
  ) THEN
    ALTER TABLE orders ADD COLUMN cod_payment_reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cod_payment_accepted_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN cod_payment_accepted_at timestamptz;
  END IF;
END $$;
