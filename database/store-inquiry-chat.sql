-- GoPalengke: "Mag-chat sa Tindahan" — buyer can message a seller before ordering.
-- I-run nang isang beses sa SQL Editor.

-- Payagan ang usapan na walang order (store inquiry)
ALTER TABLE public.conversations ALTER COLUMN order_id DROP NOT NULL;

-- Buyer lang mismo ang puwedeng magsimula ng inquiry, sa totoong seller ng tindahan
DROP POLICY IF EXISTS "Buyer can start store inquiry" ON public.conversations;
CREATE POLICY "Buyer can start store inquiry" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IS NULL
    AND type = 'buyer_seller'
    AND buyer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.seller_id = conversations.seller_id)
  );

-- Makikita ng buyer at seller ang kanilang inquiry
DROP POLICY IF EXISTS "Inquiry participants can view" ON public.conversations;
CREATE POLICY "Inquiry participants can view" ON public.conversations
  FOR SELECT TO authenticated
  USING (order_id IS NULL AND (auth.uid() = buyer_id OR auth.uid() = seller_id));

DROP POLICY IF EXISTS "Inquiry participants can update" ON public.conversations;
CREATE POLICY "Inquiry participants can update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (order_id IS NULL AND (auth.uid() = buyer_id OR auth.uid() = seller_id));

-- Messages sa loob ng inquiry
DROP POLICY IF EXISTS "Inquiry participants read messages" ON public.messages;
CREATE POLICY "Inquiry participants read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id
    AND c.order_id IS NULL AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)));

DROP POLICY IF EXISTS "Inquiry participants send messages" ON public.messages;
CREATE POLICY "Inquiry participants send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id
    AND c.order_id IS NULL AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)));

DROP POLICY IF EXISTS "Inquiry participants update messages" ON public.messages;
CREATE POLICY "Inquiry participants update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id
    AND c.order_id IS NULL AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)));
