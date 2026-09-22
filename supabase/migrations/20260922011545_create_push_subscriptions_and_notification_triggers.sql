/*
# PWA Push Notification System

1. New Tables
- `push_subscriptions`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, ON DELETE CASCADE)
  - `role` (text: buyer, seller, rider, admin — the user's account type at registration time)
  - `endpoint` (text, the Web Push endpoint URL from the browser)
  - `p256dh_key` (text, public key from PushSubscription)
  - `auth_key` (text, auth secret from PushSubscription)
  - `is_active` (boolean, default true — can be deactivated to stop notifications)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  Unique constraint on `endpoint` to prevent duplicate subscriptions per browser.

2. New Functions
- `notify_push(p_user_id uuid, p_role text, p_title text, p_body text, p_url text)`:
  SECURITY DEFINER function that inserts a row into `push_notification_queue` so the
  `send-push-notification` edge function can pick it up and deliver via Web Push.
- `push_notification_queue` table:
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null)
  - `role` (text, not null)
  - `title` (text, not null)
  - `body` (text, not null)
  - `url` (text, the deep link to open on click)
  - `status` (text: pending, sent, failed — default pending)
  - `created_at` (timestamptz)
  - `sent_at` (timestamptz, nullable)

3. Triggers
- `notify_seller_on_new_order`: AFTER INSERT on `orders` — sends push to the seller
  (store owner) with "New Order Received!" when a buyer places an order.
- `notify_buyer_on_status_change`: AFTER UPDATE on `orders` — sends push to the buyer
  when the order status changes to accepted, picked_up, or delivered.
- `notify_rider_on_ready_for_pickup`: AFTER UPDATE on `orders` — sends push to all
  available riders in the same city when an order becomes ready_for_pickup.

4. Security
- Enable RLS on `push_subscriptions` — users can only manage their own subscriptions.
- Enable RLS on `push_notification_queue` — no direct user access (only SECURITY DEFINER
  function and edge function with service role key can read/write).
- `notify_push` is SECURITY DEFINER so triggers (which run as the table owner) can
  insert notification requests without needing RLS exemptions.
*/

-- =========================================================
-- 1. push_subscriptions table
-- =========================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'buyer',
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
  ON push_subscriptions(endpoint);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_push_subs" ON push_subscriptions;
CREATE POLICY "select_own_push_subs" ON push_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_push_subs" ON push_subscriptions;
CREATE POLICY "insert_own_push_subs" ON push_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_push_subs" ON push_subscriptions;
CREATE POLICY "update_own_push_subs" ON push_subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_push_subs" ON push_subscriptions;
CREATE POLICY "delete_own_push_subs" ON push_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 2. push_notification_queue table
-- =========================================================
CREATE TABLE IF NOT EXISTS push_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_notification_queue_status_idx
  ON push_notification_queue(status)
  WHERE status = 'pending';

ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;
-- No policies: only accessible via SECURITY DEFINER function and service-role key.

-- =========================================================
-- 3. notify_push() SECURITY DEFINER function
-- =========================================================
CREATE OR REPLACE FUNCTION notify_push(
  p_user_id uuid,
  p_role text,
  p_title text,
  p_body text,
  p_url text DEFAULT '/'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO push_notification_queue (user_id, role, title, body, url)
  VALUES (p_user_id, p_role, p_title, p_body, p_url);
END;
$$;

-- =========================================================
-- 4. Trigger: notify_seller_on_new_order
--    Fires AFTER INSERT on orders → sends push to the store's seller
-- =========================================================
CREATE OR REPLACE FUNCTION trigger_notify_seller_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_store_name text;
BEGIN
  SELECT seller_id INTO v_seller_id FROM stores WHERE id = NEW.store_id;
  SELECT name INTO v_store_name FROM stores WHERE id = NEW.store_id;

  IF v_seller_id IS NOT NULL THEN
    PERFORM notify_push(
      v_seller_id,
      'seller',
      'New Order Received! 🛒',
      'Order #' || LEFT(NEW.id::text, 8) || ' is waiting for your confirmation.',
      '/seller'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_new_order ON orders;
CREATE TRIGGER trg_notify_seller_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_seller_new_order();

-- =========================================================
-- 5. Trigger: notify_buyer_on_status_change
--    Fires AFTER UPDATE on orders → sends push to buyer on key status changes
-- =========================================================
CREATE OR REPLACE FUNCTION trigger_notify_buyer_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_store_name text;
BEGIN
  -- Only fire when status actually changed
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT name INTO v_store_name FROM stores WHERE id = NEW.store_id;

  IF NEW.status = 'accepted' THEN
    v_title := 'Order Update! 📦';
    v_body := 'Your order from ' || COALESCE(v_store_name, 'GoPalengke') || ' has been confirmed!';
    PERFORM notify_push(NEW.buyer_id, 'buyer', v_title, v_body, '/buyer');
  ELSIF NEW.status = 'picked_up' THEN
    v_title := 'Order Update! 📦';
    v_body := 'Your rider is now delivering your fresh products from ' || COALESCE(v_store_name, 'GoPalengke') || '.';
    PERFORM notify_push(NEW.buyer_id, 'buyer', v_title, v_body, '/buyer');
  ELSIF NEW.status = 'delivered' THEN
    v_title := 'Order Delivered! ✅';
    v_body := 'Your order from ' || COALESCE(v_store_name, 'GoPalengke') || ' has been delivered. Enjoy!';
    PERFORM notify_push(NEW.buyer_id, 'buyer', v_title, v_body, '/buyer');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_buyer_status_change ON orders;
CREATE TRIGGER trg_notify_buyer_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_buyer_status_change();

-- =========================================================
-- 6. Trigger: notify_rider_on_ready_for_pickup
--    Fires AFTER UPDATE on orders → notifies available riders in same city
-- =========================================================
CREATE OR REPLACE FUNCTION trigger_notify_rider_ready_pickup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_name text;
  v_rider RECORD;
BEGIN
  -- Only fire when status transitions TO ready_for_pickup
  IF NEW.status = 'ready_for_pickup' AND (OLD.status IS DISTINCT FROM 'ready_for_pickup') THEN
    -- Skip livestock orders (pickup/meetup — no rider needed)
    IF NEW.delivery_method IS NOT NULL THEN RETURN NEW; END IF;

    SELECT name INTO v_store_name FROM stores WHERE id = NEW.store_id;

    -- Notify all available riders in the same city as the store
    FOR v_rider IN
      SELECT p.id FROM profiles p
      WHERE p.role = 'rider'
        AND p.is_available = true
        AND p.is_approved = true
        AND p.is_active = true
        AND p.city = (SELECT city FROM stores WHERE id = NEW.store_id)
    LOOP
      PERFORM notify_push(
        v_rider.id,
        'rider',
        'New Delivery Available! 🏍️',
        'Earn from a new trip waiting at ' || COALESCE(v_store_name, 'GoPalengke') || '.',
        '/rider'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_rider_ready_pickup ON orders;
CREATE TRIGGER trg_notify_rider_ready_pickup
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_rider_ready_pickup();
