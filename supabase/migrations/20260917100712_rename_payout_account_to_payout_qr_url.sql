-- Rename payout_account to payout_qr_url to store QR code image URL instead of bank account number
ALTER TABLE affiliates RENAME COLUMN payout_account TO payout_qr_url;
