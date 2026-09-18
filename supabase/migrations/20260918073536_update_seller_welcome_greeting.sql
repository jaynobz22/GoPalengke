-- Update the seller welcome message opening greeting
CREATE OR REPLACE FUNCTION send_seller_welcome_message(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_admin_id uuid;
  v_welcome_text text;
BEGIN
  -- Get the admin conversation for this user
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

  v_welcome_text := 'Mabuhay! Welcome to GoPalengke!' || E'\n\n' ||
    'Para makumpleto ang verification mo bilang seller, mangyari magpadala ng mga sumusunod na larawan dito sa chat:' || E'\n\n' ||
    '1. Larawan ng tindahan mo (makikita ang mga paninda)' || E'\n' ||
    '2. Larawan ng Valid ID mo' || E'\n' ||
    '3. Selfie mo na hawak mo ang Valid ID mo' || E'\n' ||
    '4. Business Permit sa palengke (kung may pwesto ka sa palengke)' || E'\n\n' ||
    'Kung wala kang pwesto sa palengke at may farm ka (gulayan, fishpond, manukan, o kahit anong farm), magpadala ng:' || E'\n\n' ||
    '1. Larawan ng farm mo' || E'\n' ||
    '2. Larawan ng Valid ID mo' || E'\n' ||
    '3. Selfie mo na hawak mo ang Valid ID mo' || E'\n\n' ||
    'I-send o i-reply ang mga larawan dito mismo sa message section para ma-verify ka ng admin bago ka ma-approve bilang seller. Salamat!';

  -- Insert the welcome message from the admin
  INSERT INTO admin_messages (conversation_id, sender_id, body, image_url)
  VALUES (v_conv_id, v_admin_id, v_welcome_text, NULL);

  -- Mark welcome as sent
  UPDATE admin_conversations
  SET welcome_sent_at = now(), updated_at = now()
  WHERE id = v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_seller_welcome_message(uuid) TO authenticated;
