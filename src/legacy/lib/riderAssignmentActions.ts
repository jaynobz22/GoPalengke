import { supabase } from './supabase';
import { canCarryCargo, cargoWeight, canDeclineAssignment } from './riderAssignment';

type AssignmentOrder = { id: string; delivery_group_id?: string | null; rider_id?: string | null; rider_accepted_at?: string | null; status?: string };

export async function readCargoWeight(order: AssignmentOrder): Promise<number> {
  const q = supabase.from('orders').select('id, status, items:order_items(quantity, unit)');
  const { data, error } = order.delivery_group_id ? await q.eq('delivery_group_id', order.delivery_group_id) : await q.eq('id', order.id);
  if (error || !data?.length) throw new Error('Hindi ma-check ang bigat ng order. Subukan muli.');
  return cargoWeight(data);
}

export async function checkAssignmentVehicle(order: AssignmentOrder, riderId: string) {
  const [kg, result] = await Promise.all([readCargoWeight(order), supabase.from('profiles').select('vehicle_type, is_approved, is_active').eq('id', riderId).maybeSingle()]);
  if (result.error || !result.data) throw new Error('Hindi ma-check ang sasakyan ng rider.');
  if (!result.data.is_approved || !result.data.is_active) throw new Error('Hindi pa available para sa delivery ang rider na ito.');
  if (!canCarryCargo(result.data.vehicle_type, kg)) throw new Error(`Hindi kaya ng sasakyan ng rider ang ${kg.toFixed(1)} kg na karga. Bao-Bao / Minivan ang kailangan kapag lampas 25 kg.`);
  return result.data.vehicle_type || 'motorcycle';
}

export async function declineAssignment(order: AssignmentOrder, riderId: string) {
  if (!canDeclineAssignment(order, riderId)) throw new Error('Tinanggap na o nagbago na ang delivery. I-refresh muna.');
  const read = supabase.from('orders').select('id, rider_id, rider_accepted_at, status').eq('rider_id', riderId);
  const group = order.delivery_group_id ? await read.eq('delivery_group_id', order.delivery_group_id) : await read.eq('id', order.id);
  if (group.error || !group.data?.length || group.data.some(o => !canDeclineAssignment(o, riderId))) throw new Error('May tinanggap na o nagbago nang delivery. I-refresh muna.');
  const q = supabase.from('orders').update({ rider_id: null, rider_accepted_at: null, rider_lat: null, rider_lng: null }).eq('rider_id', riderId).is('rider_accepted_at', null).in('status', ['pending', 'accepted', 'preparing', 'ready_for_pickup']);
  const scoped = order.delivery_group_id ? q.eq('delivery_group_id', order.delivery_group_id) : q.eq('id', order.id);
  const { data, error } = await scoped.select('id');
  if (error || !data?.length) throw new Error('Hindi na-save ang decline. I-refresh at subukan muli.');
}