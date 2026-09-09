/*
# Email Campaigns — Occasion/Event CRM System

1. New Tables
- `email_campaigns`: Stores preset email campaigns created by admin
  - `id` (uuid, primary key)
  - `name` (text, not null) — campaign name (e.g. "Pasko 2026 Reminder")
  - `subject` (text, not null) — email subject line
  - `body` (text, not null) — email body content
  - `target_role` (text, not null) — which users to target: 'buyer', 'seller', 'rider', 'all'
  - `target_region` (text, nullable) — filter recipients by region
  - `target_city` (text, nullable) — filter recipients by city
  - `target_barangay` (text, nullable) — filter recipients by barangay
  - `scheduled_for` (timestamptz, nullable) — when to send; null = draft
  - `status` (text, not null default 'draft') — draft, scheduled, sending, sent, failed
  - `sent_count` (int, default 0) — how many emails were sent
  - `failed_count` (int, default 0) — how many failed
  - `created_by` (uuid, references profiles, nullable)
  - `created_at`, `updated_at` (timestamps)

- `email_campaign_recipients`: Per-recipient tracking for each campaign
  - `id` (uuid, primary key)
  - `campaign_id` (uuid, references email_campaigns, cascade delete)
  - `user_id` (uuid, references profiles, nullable)
  - `email` (text, not null)
  - `full_name` (text, nullable)
  - `status` (text, not null default 'pending') — pending, sent, failed
  - `sent_at` (timestamptz, nullable)
  - `error_message` (text, nullable)
  - `created_at` (timestamp)

2. Security
- Enable RLS on both tables.
- Only admin role can CRUD campaigns and recipients.
*/

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  target_role text NOT NULL DEFAULT 'all',
  target_region text,
  target_city text,
  target_barangay text,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'draft',
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_crud_campaigns" ON email_campaigns;
CREATE POLICY "admin_crud_campaigns"
ON email_campaigns FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_crud_recipients" ON email_campaign_recipients;
CREATE POLICY "admin_crud_recipients"
ON email_campaign_recipients FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign_id ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
