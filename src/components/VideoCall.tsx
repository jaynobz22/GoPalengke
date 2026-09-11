import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Video, PhoneOff, ExternalLink, AlertCircle, Coins, Clock } from 'lucide-react';
import { VIDEO_CREDIT_RATE_SECONDS } from '@/lib/types';
import { isZegoLoaded, getZegoUIKitPrebuilt } from '@/lib/zego';

const ZEGO_APP_ID = 859723970;
const ZEGO_SERVER_SECRET = 'b09d6611fd4974338195c5e40cb94eb8';

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

const MAX_INIT_RETRIES = 50;
const RETRY_DELAY_MS = 100;

export function VideoCall({ roomId, isCaller, otherName, onEnd }: VideoCallProps) {
  const { profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);

  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'connecting');
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [showNoCreditsAlert, setShowNoCreditsAlert] = useState(false);

  const creditTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  function isStandalonePWA(): boolean {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    } catch { return false; }
  }

  function hasMediaDevices(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
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
      if (rpcError) {
        log('CREDIT DEDUCT ERROR', rpcError.message);
        return;
      }
      const newBalance = data as number;
      log('NEW CREDIT BALANCE', newBalance);
      if (mountedRef.current) setCreditsLeft(newBalance);
      if (newBalance <= 0) {
        log('CREDITS EXHAUSTED — auto-disconnecting via ZEGOCLOUD');
        stopCreditDeduction();
        if (mountedRef.current) setShowNoCreditsAlert(true);
        try { zpRef.current?.destroy(); } catch (e) { log('ZEGO destroy error', e); }
      }
    }, VIDEO_CREDIT_RATE_SECONDS * 1000);
  };

  const cleanup = () => {
    log('CLEANUP');
    stopCreditDeduction();
    try { zpRef.current?.destroy(); } catch { /* already destroyed */ }
    zpRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;

    if (!profile?.id) return;

    log('MOUNT', `roomId=${roomId} isCaller=${isCaller}`);

    if (!hasMediaDevices()) {
      if (isStandalonePWA()) setShowFallback(true);
      setError('Hindi available ang camera sa device na ito.');
      return;
    }

    let retryCount = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tryInit = () => {
      if (cancelled || !mountedRef.current) return;

      if (!isZegoLoaded()) {
        log('SDK not loaded yet, retry', retryCount);
        retryCount++;
        if (retryCount >= MAX_INIT_RETRIES) {
          log('SDK failed to load after max retries');
          if (mountedRef.current) setError('Hindi ma-load ang video call SDK. Paki-refresh ang page at subukang muli.');
          return;
        }
        timeoutId = setTimeout(tryInit, RETRY_DELAY_MS);
        return;
      }

      const container = containerRef.current;
      if (!container) {
        log('Container not ready, retrying');
        timeoutId = setTimeout(tryInit, RETRY_DELAY_MS);
        return;
      }

      const userID = profile.id;
      const userName = profile.full_name || `user_${userID.slice(0, 6)}`;

      setTimeout(() => {
        if (cancelled || !mountedRef.current) return;

        try {
          const ZegoUIKitPrebuilt = getZegoUIKitPrebuilt();
          log('Generating ZEGOCLOUD Kit Token');
          const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
            ZEGO_APP_ID,
            ZEGO_SERVER_SECRET,
            roomId,
            userID,
            userName,
          );

          const zp = ZegoUIKitPrebuilt.create(kitToken);
          zpRef.current = zp;

          log('Joining ZEGOCLOUD room', roomId);

          zp.joinRoom({
            container,
            scenario: {
              mode: ZegoUIKitPrebuilt.OneONoneCall,
            },
            showScreenSharingButton: false,
            showMyCameraToggleButton: false,
            showMyMicrophoneToggleButton: false,
            showTextChat: false,
            showUserList: false,
            turnOnCameraWhenJoining: true,
            turnOnMicrophoneWhenJoining: true,
            onJoinRoom: () => {
              log('ZEGO onJoinRoom — call connected');
              if (mountedRef.current) {
                setPhase('connected');
                setError(null);
              }
              startCreditDeduction();
            },
            onLeaveRoom: () => {
              log('ZEGO onLeaveRoom — call ended');
              stopCreditDeduction();
              if (mountedRef.current) setPhase('ended');
            },
          });
        } catch (err: any) {
          log('ZEGO INIT ERROR', err);
          if (mountedRef.current) setError(`Hindi ma-start ang video call: ${err?.message || String(err)}`);
        }
      }, 100);
    };

    timeoutId = setTimeout(tryInit, 100);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearTimeout(timeoutId);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profile?.id]);

  function openInBrowser() {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }

  function endCall() {
    log('endCall — destroying ZEGO session');
    stopCreditDeduction();
    try { zpRef.current?.destroy(); } catch { /* ignore */ }
    zpRef.current = null;
    if (mountedRef.current) setPhase('ended');
  }

  if (showFallback) {
    return (
      <div className="fixed inset-0 z-[90] bg-gradient-to-b from-blue-900 to-gray-900 flex flex-col items-center justify-center max-w-md mx-auto px-5">
        <div className="text-center">
          <div className="w-28 h-28 rounded-full bg-amber-600 flex items-center justify-center mx-auto mb-4"><AlertCircle size={48} className="text-white" /></div>
          <p className="text-white text-xl font-bold mb-2">Hindi ma-access ang camera</p>
          <p className="text-amber-200 text-sm mb-6 max-w-xs">Buksan ang GoPalengke sa browser para gumana ang video call.</p>
        </div>
        <button onClick={openInBrowser} className="px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition flex items-center gap-2"><ExternalLink size={18} /> Open in System Browser</button>
        <button onClick={() => { setShowFallback(false); endCall(); }} className="mt-3 text-gray-400 text-sm">Cancel Call</button>
      </div>
    );
  }

  if (showNoCreditsAlert) {
    return (
      <div className="fixed inset-0 z-[85] bg-gray-900 flex flex-col items-center justify-center max-w-md mx-auto px-5">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-4"><Coins size={40} className="text-white" /></div>
          <p className="text-white text-lg font-bold mb-2">Ubos na ang iyong video credits.</p>
          <p className="text-gray-400 text-sm mb-6">Mag-top up upang makatawag muli.</p>
        </div>
        <button onClick={onEnd} className="px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition">Bumalik sa Chat</button>
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4"><PhoneOff size={36} className="text-gray-400" /></div>
          <p className="text-white text-lg font-semibold mb-1">Natapos ang video call</p><p className="text-gray-400 text-sm">Kay {otherName}</p>
        </div>
        <button onClick={onEnd} className="mt-8 px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition">Bumalik sa Chat</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col max-w-md mx-auto">
      {/* ZEGOCLOUD SDK renders the video call UI inside this container.
          Always rendered so the ref is available when the effect runs. */}
      <div ref={containerRef} className="flex-1 w-full h-full" />

      {/* Connecting / outgoing overlay shown until ZEGOCLOUD calls onJoinRoom */}
      {phase !== 'connected' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900">
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
              {showFallback && (
                <button onClick={openInBrowser} className="mt-3 px-6 py-2 bg-white text-gray-800 rounded-xl text-sm font-semibold active:scale-95 transition flex items-center gap-2 mx-auto">
                  <ExternalLink size={16} /> Open in Browser
                </button>
              )}
            </div>
          )}
          <button onClick={endCall} className="mt-10 w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
          <p className="text-gray-400 text-xs mt-3">I-cancel ang tawag</p>
        </div>
      )}

      {/* Credit + timer overlay (caller only) */}
      {phase === 'connected' && isCaller && creditsLeft !== null && (
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              <Coins size={12} /> {creditsLeft} credits
            </span>
            <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              <Clock size={12} /> {Math.floor(callSeconds / 60)}:{String(callSeconds % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {/* Custom end call button overlay */}
      {phase === 'connected' && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex items-center justify-center">
          <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
