/*
# Fix Conversations INSERT Policy for Sellers

## Problem
The original messaging system only allowed the **buyer** to INSERT into the
`conversations` table (`auth.uid() = buyer_id`). When a seller taps
"Chat with Buyer" from the order detail screen, the app calls
`getOrCreateConversation()` which tries to INSERT a new conversation row.
Because the seller's `auth.uid()` does not match `buyer_id`, the INSERT is
silently rejected by RLS, `conv` comes back null, and the chat window never
opens.

## Fix
Replace the buyer-only INSERT policy with one that allows **either** the buyer
**or** the seller (for `buyer_seller` type conversations) to create a
conversation. The `WITH CHECK` predicate verifies that the authenticated user
is a legitimate participant:

  - `auth.uid() = buyer_id` (buyer creating the conversation), OR
  - `auth.uid() = seller_id` (seller creating the conversation)

This does **not** loosen security: only the two parties linked to the order
can create the conversation, and the existing CHECK constraint on the table
already enforces that `buyer_seller` conversations have a non-null `seller_id`
and null `rider_id`.

## Security
- No new tables or columns.
- RLS remains enabled on `conversations`.
- SELECT and UPDATE policies are unchanged.
- The INSERT policy is tightened, not loosened: only buyer or seller
  participants can insert, not arbitrary authenticated users.
*/

-- Drop the old buyer-only INSERT policy
DROP POLICY IF EXISTS "conversations_insert_buyer" ON conversations;

-- New INSERT policy: buyer OR seller can create a conversation
DROP POLICY IF EXISTS "conversations_insert_participants" ON conversations;
CREATE POLICY "conversations_insert_participants" ON conversations FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
  );
