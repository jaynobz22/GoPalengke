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
    let others = 0;
    let everJoined = false;
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
          // Mobile data sa PH (Globe/Smart/DITO) ay naka-CGNAT: hindi umuubra ang direktang
          // phone-to-phone. Dumaan sa Jitsi bridge para laging kumonekta.
          p2p: { enabled: false },
          // Laging ipakita ang sariling camera (self-view), lalo na sa phone.
          disableSelfView: false,
          disableSelfViewSettings: true,
          disableFilmstripAutohiding: true,
          filmstrip: { disabled: false, disableResizable: true },
          tileView: { numberOfVisibleTiles: 4 },
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
          SHOW_JITSI_WATERMARK: false,
          TOOLBAR_BUTTONS: ['microphone', 'camera', 'toggle-camera', 'hangup', 'tileview', 'filmstrip'],
          FILM_STRIP_MAX_HEIGHT: 120,
          VERTICAL_FILMSTRIP: true,
        },
      });
      // Mobile browsers (iOS Safari / Android Chrome) need explicit iframe permissions.
      try {
        const frame = api.getIFrame?.();
        if (frame) {
          frame.setAttribute('allow', 'camera *; microphone *; autoplay *; display-capture *; fullscreen *; speaker-selection *');
          frame.setAttribute('allowfullscreen', 'true');
        }
      } catch {}
      if (apiRef) apiRef.current = api;
      api.addListener('videoConferenceJoined', () => {
        everJoined = true;
        // Tile view: makikita ang sarili at ang kausap nang sabay sa phone.
        try { api.executeCommand('setTileView', true); } catch {}
        cbs.current.onJoined?.();
      });
      api.addListener('participantJoined', () => { others += 1; try { api.executeCommand('setTileView', true); } catch {} cbs.current.onOtherJoined?.(); });
      api.addListener('participantLeft', () => {
        others = Math.max(0, others - 1);
        // Huwag agad ibaba ang tawag: baka moderator bot lang o pansamantalang network jitter.
        if (!everJoined) return;
        setTimeout(() => { if (!cancelled && others <= 0) cbs.current.onOtherLeft?.(); }, 4000);
      });
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
