// @ts-nocheck
import { useEffect, useRef } from 'react';

// jitsi.riot.im (Element) allows embedding in other sites; meet.ffmuc.net blocks it (frame-ancestors).
export const JITSI_DOMAIN = (import.meta as any).env?.VITE_JITSI_DOMAIN || 'jitsi.riot.im';

let scriptPromise: Promise<void> | null = null;
function loadJitsi(): Promise<void> {
  if ((window as any).JitsiMeetExternalAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://${JITSI_DOMAIN}/external_api.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error('Hindi ma-load ang video call service')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  roomId: string;
  displayName?: string;
  onJoined?: () => void;
  onOtherJoined?: () => void;
  onOtherLeft?: () => void;
  onLeft?: () => void;
  onError?: (msg: string) => void;
  apiRef?: { current: any };
}

export function JitsiStage({ roomId, displayName, onJoined, onOtherJoined, onOtherLeft, onLeft, onError, apiRef }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onJoined, onOtherJoined, onOtherLeft, onLeft, onError });
  cbs.current = { onJoined, onOtherJoined, onOtherLeft, onLeft, onError };

  useEffect(() => {
    let api: any = null;
    let cancelled = false;
    loadJitsi().then(() => {
      if (cancelled || !el.current) return;
      const safeRoom = 'GoPalengke-' + String(roomId).replace(/[^a-zA-Z0-9]/g, '');
      api = new (window as any).JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: safeRoom,
        parentNode: el.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName: displayName || 'GoPalengke User' },
        configOverwrite: {
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          enableWelcomePage: false,
          enableClosePage: false,
          disableInviteFunctions: true,
          p2p: { enabled: true },
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
          SHOW_JITSI_WATERMARK: false,
          TOOLBAR_BUTTONS: ['microphone', 'camera', 'toggle-camera', 'hangup', 'tileview'],
        },
      });
      if (apiRef) apiRef.current = api;
      api.addListener('videoConferenceJoined', () => cbs.current.onJoined?.());
      api.addListener('participantJoined', () => cbs.current.onOtherJoined?.());
      api.addListener('participantLeft', () => cbs.current.onOtherLeft?.());
      api.addListener('readyToClose', () => cbs.current.onLeft?.());
      api.addListener('videoConferenceLeft', () => cbs.current.onLeft?.());
    }).catch(e => cbs.current.onError?.(e.message));
    return () => {
      cancelled = true;
      try { api?.dispose(); } catch {}
      if (apiRef) apiRef.current = null;
    };
  }, [roomId]);

  return <div ref={el} className="absolute inset-0 bg-black" />;
}
