/*
# Add System Welcome Messages and Order Flow Notifications

## Overview
This migration adds two automated messaging features:
1. A general welcome message sent to ALL users (buyer, seller, rider) on their first login
   after email verification, explaining what GoPalengke is and providing important links.
2. Database triggers on the `orders` table that auto-send system messages to notify:
   - Seller: when they receive a new order
   - Rider: when a delivery is assigned to them
   - Buyer: when their order status changes to "accepted" and "delivered"

## New Functions

### 1. send_general_welcome_message(p_user_id uuid)
- SECURITY DEFINER function that sends a welcome message via admin_messages.
- Idempotent: checks `welcome_sent_at` on the admin_conversation row.
- Message content is tailored per role (buyer, seller, rider) and includes:
  - What GoPalengke is
  - Links to video tutorials, affiliate program, and legal pages
- For sellers, it also includes the existing verification instructions.

### 2. notify_order_participants() — TRIGGER function on orders
- Runs AFTER UPDATE on the orders table.
- Sends system messages through the order's conversation when:
  - Status changes to "accepted" → notify buyer ("Tinanggap na ng seller ang order mo")
  - Status changes to "delivered" → notify buyer ("Naihatid na ang order mo")
- Sends admin_messages to seller when a NEW order is inserted (status = 'pending').
- Sends admin_messages to rider when rider_id is set (delivery assigned).

## Modified Objects
- `send_seller_welcome_message(uuid)` — replaced with a wrapper that calls
  send_general_welcome_message so existing callers still work.
- `admin_conversations.welcome_sent_at` — now used for all roles, not just sellers.

## New Column
- `admin_messages.message_type` (text, default 'text', CHECK in 'text', 'system')
  — distinguishes system-generated messages from human-written ones.

## Security
- All functions are SECURITY DEFINER with search_path = public.
- Functions only insert messages, never expose or modify user data beyond that.
- EXECUTE granted to authenticated role.
- No new RLS policies needed — messages are inserted by the system (definer),
  and existing SELECT policies already let participants read them.

## Important Notes
1. The welcome message is sent once per user, on first login after email verification.
2. Order notifications use the existing conversations table (buyer_seller and buyer_rider).
   If no conversation exists yet, the notification is skipped (created later by the app).
3. For seller new-order notifications, we use admin_messages since there is no
   order-based conversation for the seller alone.
4. The trigger is idempotent per status change — it checks the OLD status to avoid
   duplicate messages on no-op updates.
*/

-- ============= ADD message_type TO admin_messages =============
ALTER TABLE admin_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'system'));

-- ============= GENERAL WELCOME MESSAGE FUNCTION =============
CREATE OR REPLACE FUNCTION send_general_welcome_message(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_admin_id uuid;
  v_role text;
  v_welcome_text text;
BEGIN
  -- Get the user's role
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RETURN;
  END IF;

  -- Get or check the admin conversation for this user
  SELECT id, admin_id INTO v_conv_id, v_admin_id
  FROM admin_conversations
  WHERE user_id = p_user_id
  ORDER BY created_at
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    RETURN;
  END IF;

  -- Already sent? Skip (idempotent)
  IF EXISTS (
    SELECT 1 FROM admin_conversations
    WHERE id = v_conv_id AND welcome_sent_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  -- Build role-specific welcome message
  IF v_role = 'seller' THEN
    v_welcome_text := 'Mabuhay! Welcome to GoPalengke!' || E'\n\n' ||
      'Ang GoPalengke ang unang online wet market platform sa Pilipinas — nag-uugnay ng mga tindahan sa palengke at farm sa mga buyers sa pamamagitan ng app.' || E'\n\n' ||
      'Para makumpleto ang verification mo bilang seller, mangyari magpadala ng mga sumusunod na larawan dito sa chat:' || E'\n\n' ||
      '1. Larawan ng tindahan mo (makikita ang mga paninda)' || E'\n' ||
      '2. Larawan ng Valid ID mo' || E'\n' ||
      '3. Selfie mo na hawak mo ang Valid ID mo' || E'\n' ||
      '4. Business Permit sa palengke (kung may pwesto ka sa palengke)' || E'\n\n' ||
      'Kung wala kang pwesto sa palengke at may farm ka (gulayan, fishpond, manukan, o kahit anong farm), magpadala ng:' || E'\n\n' ||
      '1. Larawan ng farm mo' || E'\n' ||
      '2. Larawan ng Valid ID mo' || E'\n' ||
      '3. Selfie mo na hawak mo ang Valid ID mo' || E'\n\n' ||
      'I-send o i-reply ang mga larawan dito mismo sa message section para ma-verify ka ng admin bago ka ma-approve bilang seller. Salamat!' || E'\n\n' ||
      '--- Mga Mahalagang Link ---' || E'\n' ||
      'Video Tutorial: https://gopalengke.net/tutorial' || E'\n' ||
      'Affiliate Program: https://gopalengke.net/affiliate' || E'\n' ||
      'Terms of Service: https://gopalengke.net/terms' || E'\n' ||
      'Privacy Policy: https://gopalengke.net/privacy';
  ELSIF v_role = 'rider' THEN
    v_welcome_text := 'Mabuhay! Welcome to GoPalengke!' || E'\n\n' ||
      'Ang GoPalengke ang unang online wet market platform sa Pilipinas. Bilang rider, ikaw ang magdadala ng mga paninda mula sa tindahan patungo sa buyer.' || E'\n\n' ||
      'Para makapag-deliver ka na:' || E'\n' ||
      '1. I-set ang iyong availability sa Deliveries tab' || E'\n' ||
      '2. Pumili ng available na delivery na malapit sa iyo' || E'\n' ||
      '3. Kunin ang paninda sa tindahan at ihatid sa buyer' || E'\n' ||
      '4. Kumita ng delivery fee sa bawat successful delivery!' || E'\n\n' ||
      '--- Mga Mahalagang Link ---' || E'\n' ||
      'Video Tutorial: https://gopalengke.net/tutorial' || E'\n' ||
      'Affiliate Program: https://gopalengke.net/affiliate' || E'\n' ||
      'Terms of Service: https://gopalengke.net/terms' || E'\n' ||
      'Privacy Policy: https://gopalengke.net/privacy';
  ELSE
    -- buyer (default)
    v_welcome_text := 'Mabuhay! Welcome to GoPalengke!' || E'\n\n' ||
      'Ang GoPalengke ang unang online wet market platform sa Pilipinas — mag-order ka ng sariwang isda, karne, gulay, at iba pang paninda mula sa mga tindahan sa palengke at farm, at idedeliver diretso sa iyong bahay!' || E'\n\n' ||
      'Paano mag-order:' || E'\n' ||
      '1. Mag-browse ng mga tindahan sa homepage' || E'\n' ||
      '2. Piliin ang paninda at dagdagan sa cart' || E'\n' ||
      '3. Checkout at hintayin ang seller na tanggapin ang order' || E'\n' ||
      '4. Magbayad via QR code o cash on delivery' || E'\n' ||
      '5. Ihatid ng rider ang order mo sa iyong address!' || E'\n\n' ||
      '--- Mga Mahalagang Link ---' || E'\n' ||
      'Video Tutorial: https://gopalengke.net/tutorial' || E'\n' ||
      'Affiliate Program: https://gopalengke.net/affiliate' || E'\n' ||
      'Terms of Service: https://gopalengke.net/terms' || E'\n' ||
      'Privacy Policy: https://gopalengke.net/privacy';
  END IF;

  -- Insert the welcome message from the admin
  INSERT INTO admin_messages (conversation_id, sender_id, body, image_url, message_type)
  VALUES (v_conv_id, v_admin_id, v_welcome_text, NULL, 'system');

  -- Mark welcome as sent
  UPDATE admin_conversations
  SET welcome_sent_at = now(), updated_at = now()
  WHERE id = v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_general_welcome_message(uuid) TO authenticated;

-- ============= BACKWARD-COMPATIBLE WRAPPER =============
-- Keep send_seller_welcome_message working for existing callers
CREATE OR REPLACE FUNCTION send_seller_welcome_message(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM send_general_welcome_message(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION send_seller_welcome_message(uuid) TO authenticated;

-- ============= ORDER NOTIFICATION TRIGGER FUNCTION =============
CREATE OR REPLACE FUNCTION notify_order_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_admin_id uuid;
  v_seller_id uuid;
  v_msg text;
BEGIN
  -- Get seller_id from the store
  SELECT seller_id INTO v_seller_id FROM stores WHERE id = NEW.store_id;
  IF v_seller_id IS NULL THEN RETURN NEW; END IF;

  -- Get an admin id for sending admin_messages
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' AND (is_active = true OR is_active IS NULL) ORDER BY created_at LIMIT 1;

  -- ============= ON INSERT: notify seller of new order =============
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    IF v_admin_id IS NOT NULL THEN
      -- Get or create admin conversation for seller
      SELECT id INTO v_conv_id FROM admin_conversations WHERE user_id = v_seller_id LIMIT 1;
      IF v_conv_id IS NOT NULL THEN
        v_msg := 'May bagong order ka! Order #' || substr(NEW.id::text, 1, 8) || E'\n' ||
          'Total: ₱' || round(NEW.total::numeric, 2)::text || E'\n' ||
          'Payment: ' || CASE WHEN NEW.payment_method = 'cod' THEN 'Cash on Delivery' ELSE 'QR Code' END || E'\n' ||
          'Tingnan ang detalye sa Orders tab mo.';
        INSERT INTO admin_messages (conversation_id, sender_id, body, message_type)
        VALUES (v_conv_id, v_admin_id, v_msg, 'system');
        UPDATE admin_conversations SET updated_at = now() WHERE id = v_conv_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ============= ON UPDATE: notify buyer of status changes =============
  IF TG_OP = 'UPDATE' THEN
    -- Status changed to "accepted" → notify buyer
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      SELECT id INTO v_conv_id FROM conversations WHERE order_id = NEW.id AND type = 'buyer_seller' LIMIT 1;
      IF v_conv_id IS NOT NULL THEN
        v_msg := 'Tinanggap na ng seller ang order mo! Inihahanda na ang iyong paninda.';
        INSERT INTO messages (conversation_id, sender_id, body, message_type)
        VALUES (v_conv_id, v_seller_id, v_msg, 'system');
      END IF;
    END IF;

    -- Status changed to "picked_up" and rider assigned → notify buyer
    IF OLD.status IN ('accepted','preparing','ready_for_pickup') AND NEW.status = 'picked_up' AND NEW.rider_id IS NOT NULL THEN
      SELECT id INTO v_conv_id FROM conversations WHERE order_id = NEW.id AND type = 'buyer_rider' LIMIT 1;
      IF v_conv_id IS NOT NULL THEN
        v_msg := 'Nakuha na ng rider ang order mo! Paparating na sa iyo.';
        INSERT INTO messages (conversation_id, sender_id, body, message_type)
        VALUES (v_conv_id, NEW.rider_id, v_msg, 'system');
      END IF;
    END IF;

    -- Status changed to "delivered" → notify buyer
    IF OLD.status IN ('picked_up','ready_for_pickup') AND NEW.status = 'delivered' THEN
      SELECT id INTO v_conv_id FROM conversations WHERE order_id = NEW.id AND type = 'buyer_seller' LIMIT 1;
      IF v_conv_id IS NOT NULL THEN
        v_msg := 'Naihatid na ang order mo! Salamat sa pag-order sa GoPalengke.';
        INSERT INTO messages (conversation_id, sender_id, body, message_type)
        VALUES (v_conv_id, v_seller_id, v_msg, 'system');
      END IF;
      -- Also notify via buyer_rider conversation if exists
      SELECT id INTO v_conv_id FROM conversations WHERE order_id = NEW.id AND type = 'buyer_rider' LIMIT 1;
      IF v_conv_id IS NOT NULL AND NEW.rider_id IS NOT NULL THEN
        v_msg := 'Naihatid na ang order! Salamat sa pag-deliver.';
        INSERT INTO messages (conversation_id, sender_id, body, message_type)
        VALUES (v_conv_id, NEW.rider_id, v_msg, 'system');
      END IF;
    END IF;

    -- rider_id was NULL and now set → notify rider of new delivery assignment
    IF OLD.rider_id IS NULL AND NEW.rider_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
      SELECT id INTO v_conv_id FROM admin_conversations WHERE user_id = NEW.rider_id LIMIT 1;
      IF v_conv_id IS NOT NULL THEN
        v_msg := 'May bagong delivery assignment sa iyo! Order #' || substr(NEW.id::text, 1, 8) || E'\n' ||
          'Kunin ang paninda sa tindahan at ihatid sa buyer.' || E'\n' ||
          'Tingnan ang detalye sa Deliveries tab mo.';
        INSERT INTO admin_messages (conversation_id, sender_id, body, message_type)
        VALUES (v_conv_id, v_admin_id, v_msg, 'system');
        UPDATE admin_conversations SET updated_at = now() WHERE id = v_conv_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============= TRIGGERS =============
DROP TRIGGER IF EXISTS trigger_notify_order_insert ON orders;
CREATE TRIGGER trigger_notify_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_participants();

DROP TRIGGER IF EXISTS trigger_notify_order_update ON orders;
CREATE TRIGGER trigger_notify_order_update
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_participants();

-- ============= ADD message_type TO messages TABLE =============
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'system', 'video_call'));

-- Update the existing constraint to include 'system'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'system', 'video_call'));
