// Reliable Messenger sharing without a Facebook App ID.
// Phone: native share sheet (Messenger appears there), fallback fb-messenger:// deep link.
// Laptop: open messenger.com immediately (inside the click, so it's not blocked), copy link, tell user to paste.
function copySync(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function shareToMessenger(url: string, text = '') {
  const absUrl = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile && typeof navigator.share === 'function') {
    navigator.share(text ? { title: 'GoPalengke', text, url: absUrl } : { title: 'GoPalengke', url: absUrl }).catch((e) => {
      if ((e as Error)?.name !== 'AbortError') {
        window.location.href = `fb-messenger://share/?link=${encodeURIComponent(absUrl)}`;
      }
    });
    return;
  }
  if (isMobile) {
    copySync(absUrl);
    window.location.href = `fb-messenger://share/?link=${encodeURIComponent(absUrl)}`;
    return;
  }

  // Laptop: open first (synchronously in the click) so the popup is not blocked.
  const win = window.open('https://www.messenger.com/new', '_blank');
  if (!copySync(absUrl)) navigator.clipboard?.writeText(absUrl).catch(() => {});
  if (!win) window.location.assign('https://www.messenger.com/new');
  setTimeout(() => {
    alert('Nakopya na ang link! Sa Messenger, pumili ng kausap at i-paste (Ctrl+V) ang link, may kasamang larawan ito.');
  }, 300);
}
