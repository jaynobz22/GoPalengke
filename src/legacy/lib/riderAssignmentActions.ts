import { supabase } from './supabase';
import { canCarryCargo, cargoWeight, canDeclineAssignment } from './riderAssignment';
import { declineRiderDelivery } from '../../lib/rider-decline.functions';

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
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || session.user.id !== riderId) throw new Error('Mag-login muli bago i-decline ang delivery.');
  await declineRiderDelivery({ data: { accessToken: session.access_token, orderId: order.id } });
}