// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Video, PhoneOff, ExternalLink, AlertCircle, Coins, Clock } from 'lucide-react';
import { VIDEO_CREDIT_RATE_SECONDS } from '../lib/types';
import { loadZegoSDK } from '../lib/zego';

// ─── ZEGO Credentials (sanitized) ───────────────────────────────────────────
const ZEGO_APP_ID_RAW = 859723970;
const ZEGO_SERVER_SECRET_RAW = 'b09d6611fd4974338195c5e40cb94eb8';

// Strict casts — AppID must be a number, ServerSecret must be a trimmed string
const ZEGO_APP_ID = Number(ZEGO_APP_ID_RAW);
const ZEGO_SERVER_SECRET = String(ZEGO_SERVER_SECRET_RAW).trim();

// Hardcoded debug room — both caller and receiver join this exact string
const FINAL_ROOM_ID = 'gopalengke_debug_room_2026';

type CallPhase = 'outgoing' | 'connecting' | 'connected' | 'ended';

interface VideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  autoAccept?: boolean;
  preWarmedStream?: MediaStream | null;
  onEnd: () => void;
}

export function VideoCall({ isCaller, otherName, onEnd }: VideoCallProps) {
  const { profile } = useAuth();

  // ─── Refs: ZEGO instance + init guards survive React re-renders ──────────
  const zpInstance = useRef<any>(null);
  const hasJoined = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const creditTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── UI state only — never drives ZEGO lifecycle ─────────────────────────
  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'connecting');
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [showNoCreditsAlert, setShowNoCreditsAlert] = useState(false);

  // ─── Credit deduction helpers ────────────────────────────────────────────
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
      const { data, error: rpcError } = await supabase.rpc('deduct_video_credit');
      if (rpcError) return;
      const newBalance = data as number;
      setCreditsLeft(newBalance);
      if (newBalance <= 0) {
        stopCreditDeduction();
        setShowNoCreditsAlert(true);
        try { zpInstance.current?.destroy(); } catch { /* ignore */ }
        zpInstance.current = null;
        hasJoined.current = false;
      }
    }, VIDEO_CREDIT_RATE_SECONDS * 1000);
  };

  // ─── SINGLE EFFECT: init ZEGO once, never destroy on re-render ──────────
  useEffect(() => {
    if (!profile?.id) return;

    // Absolute guard: if ZEGO already joined, do nothing
    if (hasJoined.current) {
      console.log('[VideoCall] hasJoined already true — skipping init');
      return;
    }

    // Credential validation before anything else
    if (!ZEGO_APP_ID || isNaN(ZEGO_APP_ID) || ZEGO_APP_ID <= 0) {
      console.error('[VideoCall] Invalid AppID:', ZEGO_APP_ID);
      setError('Invalid ZEGO AppID configuration.');
      return;
    }
    if (!ZEGO_SERVER_SECRET || ZEGO_SERVER_SECRET.length < 10) {
      console.error('[VideoCall] Invalid ServerSecret');
      setError('Invalid ZEGO ServerSecret configuration.');
      return;
    }

    let cancelled = false;

    const init = async () => {
      hasJoined.current = true; // Set immediately to block any parallel run

      try {
        console.log('[VideoCall] Loading SDK...');
        const ZegoUIKitPrebuilt = await loadZegoSDK();
        if (cancelled) return;

        // Use getElementById to guarantee we target the exact DOM element,
        // independent of React ref timing.
        let targetEl = document.getElementById('zego-video-frame');
        let retries = 0;
        while (!targetEl && retries < 30 && !cancelled) {
          await new Promise<void>(r => requestAnimationFrame(() => r()));
          targetEl = document.getElementById('zego-video-frame');
          retries++;
        }
        if (cancelled || !targetEl) {
          console.error('[VideoCall] Container element never appeared');
          hasJoined.current = false;
          setError('Video container not available.');
          return;
        }

        // Brief settle for DOM paint
        await new Promise<void>(r => setTimeout(r, 200));
        if (cancelled) { hasJoined.current = false; return; }

        const userID = profile.id;
        const userName = profile.full_name || `user_${userID.slice(0, 6)}`;

        console.log('[VideoCall] Generating token for room:', FINAL_ROOM_ID);
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          ZEGO_APP_ID,
          ZEGO_SERVER_SECRET,
          FINAL_ROOM_ID,
          userID,
          userName,
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpInstance.current = zp;

        console.log('!!! GO_PALENGKE_JOINING_ROOM:', FINAL_ROOM_ID);

        zp.joinRoom({
          container: targetEl,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          showPreJoinView: false,
          showScreenSharingButton: false,
          showMyCameraToggleButton: false,
          showMyMicrophoneToggleButton: false,
          showTextChat: false,
          showUserList: false,
          turnOnCameraWhenJoining: true,
          turnOnMicrophoneWhenJoining: true,
          onJoinRoom: () => {
            console.log('[VideoCall] onJoinRoom — CONNECTED');
            setPhase('connected');
            setError(null);
            startCreditDeduction();
          },
          onLeaveRoom: () => {
            console.log('[VideoCall] onLeaveRoom — ENDED');
            stopCreditDeduction();
            setPhase('ended');
          },
        });
      } catch (err: any) {
        console.error('[VideoCall] INIT FAILED:', err);
        hasJoined.current = false;
        setError(`Hindi ma-start ang video call: ${err?.message || String(err)}`);
      }
    };

    init();

    // Cleanup: intentionally does NOT destroy the ZEGO session.
    // React may re-run this effect during state updates; we keep the session alive.
    return () => {
      cancelled = true;
      // No zp.destroy() here — session survives React re-renders.
      console.log('[VideoCall] effect cleanup — session preserved');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // ─── Explicit end call (user action) ────────────────────────────────────
  function endCall() {
    console.log('[VideoCall] endCall — destroying session');
    stopCreditDeduction();
    try { zpInstance.current?.destroy(); } catch { /* ignore */ }
    zpInstance.current = null;
    hasJoined.current = false;
    setPhase('ended');
  }

  function openInBrowser() {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }

  // ─── RENDER: single return, container always in DOM ─────────────────────
  // The ZEGO container div is NEVER conditionally removed.
  // Overlays are positioned absolutely on top of it.
  return (
    <>

      {/* ZEGO injects its video UI here. Always rendered. Always in DOM.
          Fixed positioning + forced styles so no parent container can clip it. */}
      <div
        ref={containerRef}
        id="zego-video-frame"
        style={{
          width: '100%',
          height: '100vh',
          display: 'block',
          zIndex: 999,
          position: 'fixed',
          top: 0,
          left: 0,
          background: '#000',
        }}
      />

      {/* ── OVERLAYS (absolute, layered on top of container) ── */}

      {/* No credits */}
      {showNoCreditsAlert && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 px-5" style={{ zIndex: 1001 }}>
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

      {/* PWA fallback */}
      {showFallback && !showNoCreditsAlert && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900 px-5" style={{ zIndex: 1001 }}>
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

      {/* Call ended */}
      {phase === 'ended' && !showNoCreditsAlert && !showFallback && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900" style={{ zIndex: 1001 }}>
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

      {/* Connecting / outgoing overlay — completely unmounts when phase === 'connected' */}
      {phase !== 'connected' && phase !== 'ended' && !showFallback && !showNoCreditsAlert && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900" style={{ zIndex: 1000 }}>
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

      {/* Credit + timer (caller, connected) */}
      {phase === 'connected' && isCaller && creditsLeft !== null && (
        <div className="fixed top-4 left-4 flex items-center gap-2" style={{ zIndex: 1001 }}>
          <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            <Coins size={12} /> {creditsLeft} credits
          </span>
          <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            <Clock size={12} /> {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* End call button (connected) */}
      {phase === 'connected' && (
        <div className="fixed bottom-8 left-0 right-0 flex items-center justify-center" style={{ zIndex: 1001 }}>
          <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
        </div>
      )}
    </>
  );
}
