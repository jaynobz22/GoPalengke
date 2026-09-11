import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Video, PhoneOff, ExternalLink, AlertCircle, Coins, Clock } from 'lucide-react';
import { VIDEO_CREDIT_RATE_SECONDS } from '@/lib/types';
import { loadZegoSDK } from '@/lib/zego';

const ZEGO_APP_ID = 859723970;
const ZEGO_SERVER_SECRET = 'b09d6611fd4974338195c5e40cb94eb8';

// Fixed test room ID — guarantees both caller and receiver join the exact same room
const TEST_ROOM_ID = 'gopalengke_global_test_room';

type CallPhase = 'outgoing' | 'connecting' | 'connected' | 'ended';

interface VideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  autoAccept?: boolean;
  preWarmedStream?: MediaStream | null;
  onEnd: () => void;
}

function log(...args: unknown[]) {
  console.log('%c[VideoCall]', 'color:#3b82f6;font-weight:bold', ...args);
}

export function VideoCall({ roomId, isCaller, otherName, onEnd }: VideoCallProps) {
  const { profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const creditTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'connecting');
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [showNoCreditsAlert, setShowNoCreditsAlert] = useState(false);

  function hasMediaDevices(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function';
  }

  function isStandalonePWA(): boolean {
    try {
      return window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;
    } catch { return false; }
  }

  const stopCreditDeduction = () => {
    if (creditTimerRef.current) { clearInterval(creditTimerRef.current); creditTimerRef.current = null; }
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
  };

  const startCreditDeduction = () => {
    if (!isCaller) return;
    stopCreditDeduction();
    setCreditsLeft(profile?.video_credits ?? 0);

    callTimerRef.current = setInterval(() => {
      setCallSeconds(s => s + 1);
    }, 1000);

    creditTimerRef.current = setInterval(async () => {
      log('DEDUCTING 1 credit');
      const { data, error: rpcError } = await supabase.rpc('deduct_video_credit');
      if (rpcError) { log('CREDIT DEDUCT ERROR', rpcError.message); return; }
      const newBalance = data as number;
      if (newBalance <= 0) {
        stopCreditDeduction();
        setShowNoCreditsAlert(true);
        try { zpRef.current?.destroy(); } catch { /* ignore */ }
        zpRef.current = null;
        (window as any).zegoInitialized = false;
      }
    }, VIDEO_CREDIT_RATE_SECONDS * 1000);
  };

  useEffect(() => {
    if (!profile?.id) return;

    // Use the fixed test room ID — both sides join the exact same room
    const effectiveRoomId = TEST_ROOM_ID;
    log('MOUNT', `effectiveRoomId="${effectiveRoomId}" isCaller=${isCaller} window.zegoInitialized=${(window as any).zegoInitialized}`);

    if (!hasMediaDevices()) {
      if (isStandalonePWA()) setShowFallback(true);
      setError('Hindi available ang camera sa device na ito.');
      return;
    }

    // Block double-init via window property — survives React re-renders and StrictMode
    if ((window as any).zegoInitialized) {
      log('window.zegoInitialized is true — skipping duplicate init');
      return;
    }
    (window as any).zegoInitialized = true;
    log('Set window.zegoInitialized = true');

    let asyncCancelled = false;

    const initZego = async () => {
      try {
        log('Loading ZEGOCLOUD SDK...');
        const ZegoUIKitPrebuilt = await loadZegoSDK();
        if (asyncCancelled) { log('Cancelled after SDK load'); return; }

        const appIdNum = Number(ZEGO_APP_ID);
        const serverSecretStr = String(ZEGO_SERVER_SECRET);
        if (!appIdNum || isNaN(appIdNum) || appIdNum <= 0) throw new Error(`Invalid AppID: ${ZEGO_APP_ID}`);
        if (!serverSecretStr || serverSecretStr.length < 10) throw new Error('Invalid ServerSecret');

        // Poll for container — it's always rendered, so this should resolve immediately
        let container = containerRef.current;
        let retries = 0;
        while (!container && retries < 30 && !asyncCancelled) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          container = containerRef.current;
          retries++;
        }
        if (asyncCancelled || !container) {
          console.error('ZEGO_INIT_FAILED: Container not available');
          (window as any).zegoInitialized = false;
          return;
        }

        // Small settle delay for DOM paint
        await new Promise<void>(resolve => setTimeout(resolve, 200));
        if (asyncCancelled) { (window as any).zegoInitialized = false; return; }

        const userID = profile.id;
        const userName = profile.full_name || `user_${userID.slice(0, 6)}`;

        log('Generating kit token for room:', effectiveRoomId);
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appIdNum, serverSecretStr, effectiveRoomId, userID, userName,
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        log('Calling zp.joinRoom...');
        zp.joinRoom({
          container,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          showScreenSharingButton: false,
          showMyCameraToggleButton: false,
          showMyMicrophoneToggleButton: false,
          showTextChat: false,
          showUserList: false,
          turnOnCameraWhenJoining: true,
          turnOnMicrophoneWhenJoining: true,
          onJoinRoom: () => {
            log('onJoinRoom — connected!');
            setPhase('connected');
            setError(null);
            startCreditDeduction();
          },
          onLeaveRoom: () => {
            log('onLeaveRoom — ended');
            stopCreditDeduction();
            setPhase('ended');
          },
        });
      } catch (err: any) {
        console.error('ZEGO_INIT_FAILED:', err);
        (window as any).zegoInitialized = false;
        setError(`Hindi ma-start ang video call: ${err?.message || String(err)}`);
      }
    };

    initZego();

    // Cleanup: do NOT destroy on React re-render / StrictMode remount.
    // Only destroy when the component is truly leaving (navigation away).
    return () => {
      asyncCancelled = true;
      // Intentionally NOT calling zp.destroy() here.
      // The ZEGO session survives React's internal re-renders.
      // It is cleaned up via endCall() or the credits-exhausted path.
      log('useEffect cleanup — keeping ZEGO session alive (no destroy)');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profile?.id]);

  function openInBrowser() {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }

  function endCall() {
    log('endCall — explicit destroy');
    stopCreditDeduction();
    try { zpRef.current?.destroy(); } catch { /* ignore */ }
    zpRef.current = null;
    (window as any).zegoInitialized = false;
    setPhase('ended');
  }

  // SINGLE RETURN — container div is always in the DOM, overlays layered on top.
  // The container is never conditionally removed, only its CSS visibility changes.
  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 max-w-md mx-auto overflow-hidden">

      {/* ZEGO injects its UI here. Always rendered, never unmounted by React.
          Uses inline styles to guarantee dimensions regardless of CSS load order. */}
      <div
        ref={containerRef}
        id="zego-video-container"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          // Hide the container visually until connected, but keep it in the DOM
          // so ZEGO can inject into it. Once connected, show it.
          visibility: phase === 'connected' ? 'visible' : 'hidden',
          zIndex: phase === 'connected' ? 5 : 0,
        }}
      />

      {/* ── NO CREDITS ── */}
      {showNoCreditsAlert && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-5" style={{ zIndex: 30 }}>
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-4">
              <Coins size={40} className="text-white" />
            </div>
            <p className="text-white text-lg font-bold mb-2">Ubos na ang iyong video credits.</p>
            <p className="text-gray-400 text-sm mb-6">Mag-top up upang makatawag muli.</p>
          </div>
          <button onClick={onEnd} className="px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition">
            Bumalik sa Chat
          </button>
        </div>
      )}

      {/* ── PWA FALLBACK ── */}
      {showFallback && !showNoCreditsAlert && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900 px-5" style={{ zIndex: 30 }}>
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={48} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-2">Hindi ma-access ang camera</p>
            <p className="text-amber-200 text-sm mb-6 max-w-xs">Buksan ang GoPalengke sa browser para gumana ang video call.</p>
          </div>
          <button onClick={openInBrowser} className="px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition flex items-center gap-2">
            <ExternalLink size={18} /> Open in System Browser
          </button>
          <button onClick={() => { setShowFallback(false); endCall(); }} className="mt-3 text-gray-400 text-sm">
            Cancel Call
          </button>
        </div>
      )}

      {/* ── CALL ENDED ── */}
      {phase === 'ended' && !showNoCreditsAlert && !showFallback && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900" style={{ zIndex: 30 }}>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <PhoneOff size={36} className="text-gray-400" />
            </div>
            <p className="text-white text-lg font-semibold mb-1">Natapos ang video call</p>
            <p className="text-gray-400 text-sm">Kay {otherName}</p>
          </div>
          <button onClick={onEnd} className="mt-8 px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition">
            Bumalik sa Chat
          </button>
        </div>
      )}

      {/* ── CONNECTING / OUTGOING OVERLAY ──
          This overlay sits on top of the (hidden) ZEGO container.
          When phase becomes 'connected', this overlay disappears and the
          container becomes visible — so ZEGO's UI is never blocked. */}
      {phase !== 'connected' && phase !== 'ended' && !showFallback && !showNoCreditsAlert && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900" style={{ zIndex: 20 }}>
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Video size={48} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-1">
              {phase === 'outgoing' ? `Tumatawag kay ${otherName}...` : 'Kumokonekta...'}
            </p>
            <p className="text-blue-200 text-sm">
              {phase === 'outgoing' ? 'Naghihintay ng sagot' : 'Sandali lang'}
            </p>
          </div>
          <div className="mt-2 flex gap-2 items-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {error && (
            <div className="mt-4 px-6 max-w-sm">
              <p className="text-red-300 text-sm text-center">{error}</p>
            </div>
          )}
          <button onClick={endCall} className="mt-10 w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
          <p className="text-gray-400 text-xs mt-3">I-cancel ang tawag</p>
        </div>
      )}

      {/* ── CREDIT + TIMER (caller, when connected) ── */}
      {phase === 'connected' && isCaller && creditsLeft !== null && (
        <div className="absolute top-4 left-4 flex items-center gap-2" style={{ zIndex: 25 }}>
          <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            <Coins size={12} /> {creditsLeft} credits
          </span>
          <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            <Clock size={12} /> {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* ── END CALL BUTTON (when connected) ── */}
      {phase === 'connected' && (
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center" style={{ zIndex: 25 }}>
          <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
