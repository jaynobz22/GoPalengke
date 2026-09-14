-- Auto-approve all existing rider accounts.
-- Riders no longer need admin approval; they can log in after email verification.
UPDATE profiles SET is_approved = true WHERE role = 'rider' AND is_approved = false;
