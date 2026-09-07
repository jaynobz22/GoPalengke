/*
# Fix conversations INSERT policy to allow riders

## Problem
The `conversations_insert_participants` policy only allowed `buyer_id` and `seller_id`
to match `auth.uid()` in the WITH CHECK. This blocked riders from creating
buyer_rider conversations, so riders could never start a chat with buyers.

## Changes
1. Drop the old `conversations_insert_participants` policy.
2. Recreate it with `rider_id` included in the WITH CHECK predicate, so riders
   can insert conversations where they are a participant.

## Security
- No new tables or columns.
- The INSERT policy now correctly allows all three participant roles (buyer,
  seller, rider) to create conversations where they are a participant.
- SELECT and UPDATE policies already include rider_id, so no changes needed there.
*/

DROP POLICY IF EXISTS "conversations_insert_participants" ON conversations;

CREATE POLICY "conversations_insert_participants"
ON conversations FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = buyer_id) OR (auth.uid() = seller_id) OR (auth.uid() = rider_id));
