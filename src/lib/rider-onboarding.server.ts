import type { SupabaseClient } from '@supabase/supabase-js';

export const RIDER_APPROVAL_MESSAGE = `Mabuhay! Welcome sa GoPalengke, Rider! 🛵

Salamat sa pag-submit ng iyong kumpletong profile at mga detalye. Hintayin lamang ang approval ng admin bago ka makapagsimulang tumanggap ng delivery.

📍 Kapag humingi ang GoPalengke ng location access, piliin ang Allow / Payagan para ma-detect ang iyong GPS location at gumana nang maayos ang delivery navigation at live tracking.

Maraming salamat sa pagsali sa GoPalengke!`;

export async function sendRiderApprovalReminder(client: SupabaseClient, conversation: { id: string; admin_id: string }) {
  // Stable UUID per conversation makes simultaneous loads/retries safe.
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rider-approval:${conversation.id}`)));
  const bytes = Array.from(digest.slice(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 15) | 80;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const { error } = await client.from('admin_messages').upsert({
    id, conversation_id: conversation.id, sender_id: conversation.admin_id,
    body: RIDER_APPROVAL_MESSAGE, message_type: 'text',
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('Hindi maipadala ang rider approval reminder.');
}