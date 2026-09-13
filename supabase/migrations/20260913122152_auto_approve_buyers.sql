-- Auto-approve all existing buyer accounts.
-- Buyers don't need admin approval; only sellers do.
UPDATE profiles SET is_approved = true WHERE role = 'buyer' AND is_approved = false;
