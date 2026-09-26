// Reliable Messenger sharing without a Facebook App ID.
// 1) Phone: native share sheet (Messenger appears there) with the full link.
// 2) Fallback phone: fb-messenger:// deep link.
// 3) Laptop: copy link then open messenger.com so user can paste.
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export async function shareToMessenger(url: string, text = '') {
  const absUrl = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  await copy(absUrl);

  if (isMobile && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'GoPalengke', text: text ? `${text}\n${absUrl}` : absUrl, url: absUrl });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
  }
  if (isMobile) {
    window.location.href = `fb-messenger://share/?link=${encodeURIComponent(absUrl)}`;
    return;
  }
  window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
  alert('Nakopya na ang link ng tindahan! I-paste (Ctrl+V) lang sa chat sa Messenger.');
}
