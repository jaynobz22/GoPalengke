-- GoPalengke: "Maghanap ng Karga" — buyer can message a bao-bao/minivan rider before ordering.
-- I-run nang isang beses sa SQL Editor. (Kapares ng store-inquiry-chat.sql pero para sa rider.)

-- Buyer lang mismo ang puwedeng magsimula ng inquiry, sa totoong rider
DROP POLICY IF EXISTS "Buyer can start rider inquiry" ON public.conversations;
CREATE POLICY "Buyer can start rider inquiry" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IS NULL
    AND type = 'buyer_rider'
    AND buyer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = conversations.rider_id AND p.role = 'rider')
  );

-- Makikita ng buyer at rider ang kanilang inquiry
DROP POLICY IF EXISTS "Rider inquiry participants can view" ON public.conversations;
CREATE POLICY "Rider inquiry participants can view" ON public.conversations
  FOR SELECT TO authenticated
  USING (order_id IS NULL AND type = 'buyer_rider' AND (auth.uid() = buyer_id OR auth.uid() = rider_id));

DROP POLICY IF EXISTS "Rider inquiry participants can update" ON public.conversations;
CREATE POLICY "Rider inquiry participants can update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (order_id IS NULL AND type = 'buyer_rider' AND (auth.uid() = buyer_id OR auth.uid() = rider_id));

-- Messages sa loob ng rider inquiry
DROP POLICY IF EXISTS "Rider inquiry participants read messages" ON public.messages;
CREATE POLICY "Rider inquiry participants read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id
    AND c.order_id IS NULL AND c.type = 'buyer_rider' AND (auth.uid() = c.buyer_id OR auth.uid() = c.rider_id)));

DROP POLICY IF EXISTS "Rider inquiry participants send messages" ON public.messages;
CREATE POLICY "Rider inquiry participants send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id
    AND c.order_id IS NULL AND c.type = 'buyer_rider' AND (auth.uid() = c.buyer_id OR auth.uid() = c.rider_id)));

DROP POLICY IF EXISTS "Rider inquiry participants update messages" ON public.messages;
CREATE POLICY "Rider inquiry participants update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id
    AND c.order_id IS NULL AND c.type = 'buyer_rider' AND (auth.uid() = c.buyer_id OR auth.uid() = c.rider_id)));
