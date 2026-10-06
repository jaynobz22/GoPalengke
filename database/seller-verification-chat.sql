-- GoPalengke: awtomatikong verification message sa chat ng bagong seller
-- + pahintulot sa admin na burahin ang chat images (auto-delete).
-- I-run nang isang beses sa SQL Editor.

CREATE OR REPLACE FUNCTION public.send_seller_welcome_message(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
  v_conv uuid;
  v_role text;
BEGIN
  -- Ang seller lang mismo (o admin) ang pwedeng tumawag nito
  IF auth.uid() IS NULL OR (auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')) THEN
    RETURN;
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'seller' THEN RETURN; END IF;

  SELECT id INTO v_admin FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_admin IS NULL THEN RETURN; END IF;

  SELECT id INTO v_conv FROM admin_conversations WHERE user_id = p_user_id ORDER BY created_at LIMIT 1;
  IF v_conv IS NULL THEN
    INSERT INTO admin_conversations (admin_id, user_id) VALUES (v_admin, p_user_id) RETURNING id INTO v_conv;
  END IF;

  -- Isang beses lang ipapadala
  IF EXISTS (SELECT 1 FROM admin_messages WHERE conversation_id = v_conv AND sender_id = v_admin AND body LIKE 'Mabuhay! Welcome to GoPalengke!%') THEN
    RETURN;
  END IF;

  INSERT INTO admin_messages (conversation_id, sender_id, body) VALUES (v_conv, v_admin,
'Mabuhay! Welcome to GoPalengke! 🛒

Upang ma-verify at ma-approve ang iyong tindahan bago makapagtinda, mangyaring i-send dito sa ating chat ang mga sumusunod na requirements:

🪪 Picture ng Valid ID (Driver''s License, PhilSys National ID, UMID, Postal ID, Passport, Voter''s ID, atbp.)

🤳 Selfie habang hawak ang iyong Valid ID (para sa identity verification)

🏪 Picture ng iyong tindahan / pwesto o mga paninda

📄 Business permit, DTI, o Barangay permit (kung mayroon)

Kung walang pwesto sa palengke at sa farm galing ang mga paninda, mag-submit ng isa sa mga valid IDs na nabanggit, selfie na hawak ang valid ID at picture ng iyong farm (gulayan, prutasan, fishpond, manukan, babuyan, kambingan etc.)

Paalala: I-click lamang ang camera o image icon dito sa ibaba ng chat para i-upload ang mga litrato. Ligtas ang iyong mga dokumento at awtomatiko itong mabubura sa aming system sa sandaling ma-verify at ma-activate na ang iyong account.

I-re-review namin ito agad upang makapagsimula ka nang magbenta. Maraming salamat!');

  UPDATE admin_conversations SET updated_at = now() WHERE id = v_conv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_seller_welcome_message(uuid) TO authenticated;

-- Admin: pwedeng burahin ang chat images at chat rows para sa auto-delete
DROP POLICY IF EXISTS "Admin can delete chat images" ON storage.objects;
CREATE POLICY "Admin can delete chat images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can delete messages" ON public.messages;
CREATE POLICY "Admin can delete messages" ON public.messages FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can delete admin messages" ON public.admin_messages;
CREATE POLICY "Admin can delete admin messages" ON public.admin_messages FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
