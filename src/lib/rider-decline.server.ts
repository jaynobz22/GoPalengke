import type { SupabaseClient } from '@supabase/supabase-js';
import { canDeclineAssignment } from '../legacy/lib/riderAssignment';

// This narrowly authorized operation must clear rider_id, which cannot satisfy
// a rider-owned UPDATE WITH CHECK policy after the update.
export async function releaseRiderAssignment(client: SupabaseClient, orderId: string, riderId: string) {
  const { data: order, error: readError } = await client.from('orders')
    .select('id, delivery_group_id, rider_id, rider_accepted_at, status').eq('id', orderId).maybeSingle();
  if (readError) throw new Error('Hindi mabasa ang delivery. Subukan muli.');
  if (!order || !canDeclineAssignment(order, riderId)) throw new Error('Tinanggap na o nagbago na ang delivery. I-refresh muna.');

  const read = client.from('orders').select('id, rider_id, rider_accepted_at, status').eq('rider_id', riderId);
  const { data: assigned, error: groupError } = order.delivery_group_id
    ? await read.eq('delivery_group_id', order.delivery_group_id) : await read.eq('id', orderId);
  if (groupError || !assigned?.length || assigned.some(row => !canDeclineAssignment(row, riderId))) {
    throw new Error('May tinanggap na o nagbago nang delivery. I-refresh muna.');
  }

  // Use freshly read IDs, never a group or rider supplied by the browser.
  // Conditional filters also protect against acceptance/reassignment during the request.
  const { data: released, error } = await client.from('orders')
    .update({ rider_id: null, rider_accepted_at: null, rider_lat: null, rider_lng: null })
    .in('id', assigned.map(row => row.id)).eq('rider_id', riderId)
    .is('rider_accepted_at', null).in('status', ['pending', 'accepted', 'preparing', 'ready_for_pickup'])
    .select('id');
  if (error) {
    console.error('Rider decline save failed', { code: error.code });
    throw new Error('Hindi na-save ang decline. Subukan muli.');
  }
  if (!released?.length || released.length !== assigned.length) throw new Error('Nagbago ang assignment. I-refresh para makita ang pinakabagong delivery.');
  return { releasedIds: released.map(row => row.id) };
}