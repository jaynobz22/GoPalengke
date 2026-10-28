-- GoPalengke: ang order-status notices ("Tinanggap na ng seller...", "Naihatid na ang order mo!", atbp.)
-- ay ipapadala ng GoPalengke Admin sa Admin Chat ng buyer, HINDI sa buyer–seller chat.
-- Safe i-run nang paulit-ulit.

CREATE OR REPLACE FUNCTION public.route_order_notice_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid;
  v_admin uuid;
  v_conv uuid;
BEGIN
  IF NEW.body IS NULL OR NEW.body !~* '^(Nakuha na ng rider|Naihatid na ang order|Paparating na ang rider|Na-deliver na|Tinanggap na ng seller)' THEN
    RETURN NEW;
  END IF;

  SELECT buyer_id INTO v_buyer FROM conversations WHERE id = NEW.conversation_id;
  -- Kung ang buyer mismo ang nagsulat nito, hayaan lang
  IF v_buyer IS NULL OR v_buyer = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_admin FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_admin IS NULL THEN
    RETURN NULL; -- walang admin: huwag na lang ilagay sa seller chat
  END IF;

  SELECT id INTO v_conv FROM admin_conversations WHERE user_id = v_buyer ORDER BY created_at LIMIT 1;
  IF v_conv IS NULL THEN
    INSERT INTO admin_conversations (admin_id, user_id) VALUES (v_admin, v_buyer) RETURNING id INTO v_conv;
  END IF;

  INSERT INTO admin_messages (conversation_id, sender_id, body) VALUES (v_conv, v_admin, NEW.body);
  UPDATE admin_conversations SET updated_at = now() WHERE id = v_conv;

  RETURN NULL; -- hindi na isasave sa buyer–seller chat
END;
$$;

DROP TRIGGER IF EXISTS trg_route_order_notice_to_admin ON public.messages;
CREATE TRIGGER trg_route_order_notice_to_admin
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.route_order_notice_to_admin();

-- Linisin ang mga lumang notice na nasa buyer–seller chat (nailipat na ang mga bago sa Admin Chat)
DELETE FROM public.messages m
USING public.conversations c
WHERE m.conversation_id = c.id
  AND m.sender_id <> c.buyer_id
  AND m.body ~* '^(Nakuha na ng rider|Naihatid na ang order|Paparating na ang rider|Na-deliver na|Tinanggap na ng seller)';
