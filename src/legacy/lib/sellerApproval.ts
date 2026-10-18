import type { SupabaseClient } from '@supabase/supabase-js';

const VERIFICATION_REQUEST_PREFIX = 'Mabuhay! Welcome to GoPalengke!';
const APPROVAL_MESSAGE = `🎉 Congratulations! Approved na ang iyong online store sa GoPalengke!

Pwede ka nang magsimulang magtinda at tumanggap ng orders. Maraming salamat sa pagkumpleto ng verification requirements!

📍 Paalala: Kapag humingi ang system ng location access, piliin ang Allow / Payagan at i-on ang location o GPS ng iyong device para ma-detect agad ang iyong lokasyon.

Para sa iyong privacy, binura na ang verification request at mga dokumentong isinumite mo sa chat.`;

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Uses the signed-in admin's existing client; database permissions still apply. */
export async function approveSellerAccount(client: SupabaseClient, sellerId: string, adminId: string) {
  const { data: seller, error: sellerError } = await client.from('profiles')
    .select('id,role').eq('id', sellerId).single();
  check(sellerError);
  if (seller?.role !== 'seller') throw new Error('Hindi seller ang account na ito.');

  const { error: storeError } = await client.from('stores').update({ is_verified: true }).eq('seller_id', sellerId);
  check(storeError);
  const { error: profileError } = await client.from('profiles').update({ is_approved: true }).eq('id', sellerId);
  check(profileError);

  try {
    await completeSellerApproval(client, sellerId, adminId);
  } catch (error) {
    throw new Error(`Approved na ang seller pero hindi pa tapos ang document cleanup o congratulations message. Pindutin ulit para subukan muli. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function completeSellerApproval(client: SupabaseClient, sellerId: string, adminId: string) {
  const { data: conversations, error: conversationError } = await client.from('admin_conversations')
    .select('id,admin_id').eq('user_id', sellerId).order('created_at', { ascending: true });
  check(conversationError);
  let conversationId = conversations?.[0]?.id;
  if (!conversationId) {
    const { data, error } = await client.from('admin_conversations')
      .insert({ admin_id: adminId, user_id: sellerId }).select('id').single();
    check(error);
    if (!data) throw new Error('Hindi mabuksan ang admin chat.');
    conversationId = data.id;
  }
  const ids = conversations?.length ? conversations.map(c => c.id) : [conversationId];
  const { data: messages, error: messageError } = await client.from('admin_messages')
    .select('id,sender_id,body,image_url,is_verification_image').in('conversation_id', ids);
  check(messageError);
  const documents = (messages || []).filter(m => m.sender_id === sellerId && m.is_verification_image === true && m.image_url);
  const paths = documents.map(m => {
    const url = new URL(m.image_url);
    const marker = '/storage/v1/object/public/chat-images/';
    if (!url.pathname.startsWith(marker)) throw new Error('Hindi makilala ang verification document.');
    const path = decodeURIComponent(url.pathname.slice(marker.length));
    if (!path.startsWith(`${sellerId}/`)) throw new Error('Hindi tugma ang may-ari ng verification document.');
    return path;
  });
  // Keep the message references until every file deletion succeeds, so retries remain possible.
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await client.storage.from('chat-images').remove(paths.slice(i, i + 100));
    check(error);
  }
  const requestIds = (messages || []).filter(m => m.sender_id !== sellerId && !m.image_url
    && m.body?.startsWith(VERIFICATION_REQUEST_PREFIX)).map(m => m.id);
  const deleteIds = [...documents.map(m => m.id), ...requestIds];
  for (let i = 0; i < deleteIds.length; i += 100) {
    const { error } = await client.from('admin_messages').delete().in('id', deleteIds.slice(i, i + 100));
    check(error);
  }
  // A repeated completion attempt reuses the existing congratulations message.
  if (!(messages || []).some(m => m.sender_id !== sellerId && m.body === APPROVAL_MESSAGE)) {
    const { error } = await client.from('admin_messages').insert({
      conversation_id: conversationId, sender_id: adminId, body: APPROVAL_MESSAGE,
    });
    check(error);
  }
  const { error } = await client.from('admin_conversations')
    .update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  check(error);
}