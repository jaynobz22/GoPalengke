// Automatic order-status notices ("Tinanggap na ng seller ang order mo!", "Naihatid na ang order mo!")
// are written into the shared chat by the party who triggered them, but they are addressed to the
// OTHER party (usually the buyer). The sender must never see them as if they were incoming messages.

export type ChatNoticeMessage = {
  sender_id?: string | null;
  message_type?: string | null;
  body?: string | null;
};

const NOTICE_TEXT = /^(Nakuha na ng rider|Naihatid na ang order|Paparating na ang rider|Na-deliver na|Tinanggap na ng seller)/i;

export function isChatSystemNotice(msg: ChatNoticeMessage): boolean {
  return msg.message_type === 'system' || NOTICE_TEXT.test((msg.body || '').trim());
}

export function isNoticeHiddenForViewer(msg: ChatNoticeMessage, viewerId: string | null | undefined): boolean {
  return !!viewerId && msg.sender_id === viewerId && isChatSystemNotice(msg);
}

export function latestVisibleMessage<T extends ChatNoticeMessage>(messages: T[] | null | undefined, viewerId: string | null | undefined): T | null {
  return (messages || []).find(m => !isNoticeHiddenForViewer(m, viewerId)) || null;
}
