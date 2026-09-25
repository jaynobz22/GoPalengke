// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Video, PhoneOff, Phone, AlertCircle } from 'lucide-react';
import { loadZegoSDK } from '../lib/zego';

const ZEGO_APP_ID = 859723970;
const ZEGO_SERVER_SECRET = 'b09d6611fd4974338195c5e40cb94eb8';

const TEST_ROOM_ID = 'gopalengke_global_test_room';

type CallPhase = 'outgoing' | 'incoming' | 'connected' | 'ended';

interface AdminVideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  callId?: string;
  onEnd: () => void;
}

export function AdminVideoCall({ roomId, isCaller, otherName, callId, onEnd }: AdminVideoCallProps) {
  const { profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);

  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'incoming');
  const [error, setError] = useState<string | null>(null);

  const updateCallStatus = async (status: string) => {
    if (!callId) return;
    await supabase.from('admin_calls').update({ status }).eq('id', callId);
  };

  useEffect(() => {
    if (!profile?.id) return;

    // Callee (incoming) waits for explicit acceptCall() — don't auto-join
    if (!isCaller) return;

    // Block double-init via window property
    if ((window as any).zegoInitialized) return;
    (window as any).zegoInitialized = true;

    const effectiveRoomId = TEST_ROOM_ID;
    let asyncCancelled = false;

    const initZego = async () => {
      try {
        const ZegoUIKitPrebuilt = await loadZegoSDK();
        if (asyncCancelled) return;

        const appIdNum = Number(ZEGO_APP_ID);
        const serverSecretStr = String(ZEGO_SERVER_SECRET);
        if (!appIdNum || isNaN(appIdNum)) throw new Error('Invalid ZEGO AppID');
        if (!serverSecretStr || serverSecretStr.length < 10) throw new Error('Invalid ZEGO ServerSecret');

        let container = containerRef.current;
        let retries = 0;
        while (!container && retries < 30 && !asyncCancelled) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          container = containerRef.current;
          retries++;
        }
        if (asyncCancelled || !container) { (window as any).zegoInitialized = false; return; }

        await new Promise<void>(resolve => setTimeout(resolve, 200));
        if (asyncCancelled) { (window as any).zegoInitialized = false; return; }

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appIdNum, serverSecretStr, effectiveRoomId, profile.id,
          profile.full_name || 'Admin',
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

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
          onJoinRoom: () => { setPhase('connected'); setError(null); },
          onLeaveRoom: () => { setPhase('ended'); updateCallStatus('ended'); },
        });
      } catch (err: any) {
        console.error('ZEGO_INIT_FAILED:', err);
        (window as any).zegoInitialized = false;
        setError(`Hindi ma-start ang video call: ${err?.message || String(err)}`);
      }
    };

    initZego();

    return () => {
      asyncCancelled = true;
      // No destroy — keep session alive across re-renders
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profile?.id]);

  async function acceptCall() {
    if (!containerRef.current || !profile) return;
    try {
      const ZegoUIKitPrebuilt = await loadZegoSDK();
      const effectiveRoomId = TEST_ROOM_ID;

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        Number(ZEGO_APP_ID), String(ZEGO_SERVER_SECRET),
        effectiveRoomId, profile.id, profile.full_name || otherName,
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;
      (window as any).zegoInitialized = true;

      zp.joinRoom({
        container: containerRef.current,
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        showScreenSharingButton: false,
        showMyCameraToggleButton: false,
        showMyMicrophoneToggleButton: false,
        showTextChat: false,
        showUserList: false,
        turnOnCameraWhenJoining: true,
        turnOnMicrophoneWhenJoining: true,
        onJoinRoom: () => { setPhase('connected'); setError(null); },
        onLeaveRoom: () => { setPhase('ended'); updateCallStatus('ended'); },
      });

      await updateCallStatus('accepted');
    } catch (err: any) {
      console.error('ZEGO_ACCEPT_FAILED:', err);
      setError(`Hindi ma-access ang camera o microphone: ${err?.message || String(err)}`);
    }
  }

  async function declineCall() {
    await updateCallStatus('declined');
    try { zpRef.current?.destroy(); } catch { /* ignore */ }
    zpRef.current = null;
    (window as any).zegoInitialized = false;
    onEnd();
  }

  async function endCall() {
    try { zpRef.current?.destroy(); } catch { /* ignore */ }
    zpRef.current = null;
    (window as any).zegoInitialized = false;
    await updateCallStatus('ended');
    setPhase('ended');
  }

  // Single return — container always in DOM, overlays layered on top
  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 max-w-md mx-auto overflow-hidden">

      {/* ZEGO injects here — always in DOM, visibility toggled */}
      <div
        ref={containerRef}
        id="zego-admin-container"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          visibility: phase === 'connected' ? 'visible' : 'hidden',
          zIndex: phase === 'connected' ? 5 : 0,
        }}
      />

      {/* ── CALL ENDED ── */}
      {phase === 'ended' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900" style={{ zIndex: 30 }}>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <PhoneOff size={36} className="text-gray-400" />
            </div>
            <p className="text-white text-lg font-semibold mb-1">Natapos ang video call</p>
            <p className="text-gray-400 text-sm">Kay {isCaller ? otherName : 'Admin'}</p>
          </div>
          <button onClick={onEnd} className="mt-8 px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold active:scale-95 transition">
            Bumalik
          </button>
        </div>
      )}

      {/* ── OUTGOING (caller waiting) ── */}
      {phase === 'outgoing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900" style={{ zIndex: 20 }}>
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Video size={48} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-1">Tumatawag kay {otherName}...</p>
            <p className="text-blue-200 text-sm">Naghihintay ng sagot</p>
          </div>
          <div className="mt-2 flex gap-2 items-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {error && <p className="text-red-300 text-sm mt-4 px-6 text-center">{error}</p>}
          <button onClick={endCall} className="mt-10 w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
          <p className="text-gray-400 text-xs mt-3">I-cancel ang tawag</p>
        </div>
      )}

      {/* ── INCOMING (callee accept/decline) ── */}
      {phase === 'incoming' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900" style={{ zIndex: 20 }}>
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6 ring-4 ring-blue-400/50 animate-pulse">
              <Video size={48} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-1">Ang Admin ay tumatawag</p>
            <p className="text-blue-200 text-sm">Verification video call</p>
          </div>
          <div className="mt-10 flex gap-8">
            <button onClick={declineCall} className="flex flex-col items-center gap-2 active:scale-95 transition">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                <PhoneOff size={28} className="text-white" />
              </div>
              <span className="text-red-300 text-xs font-medium">Tanggihan</span>
            </button>
            <button onClick={acceptCall} className="flex flex-col items-center gap-2 active:scale-95 transition">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                <Phone size={28} className="text-white" />
              </div>
              <span className="text-green-300 text-xs font-medium">Tanggapin</span>
            </button>
          </div>
          {error && <p className="text-red-300 text-sm mt-6 text-center px-6">{error}</p>}
        </div>
      )}

      {/* ── ERROR BANNER ── */}
      {error && phase !== 'incoming' && phase !== 'ended' && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded-xl flex items-start gap-2" style={{ zIndex: 25 }}>
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
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
