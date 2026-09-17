-- Add payout request tracking to affiliates
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'none';
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS payout_requested_at timestamptz;
