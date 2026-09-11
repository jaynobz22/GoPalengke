import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Video, PhoneOff, Phone, AlertCircle } from 'lucide-react';
import { loadZegoSDK } from '@/lib/zego';

const ZEGO_APP_ID = 859723970;
const ZEGO_SERVER_SECRET = 'b09d6611fd4974338195c5e40cb94eb8';

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
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'incoming');
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const updateCallStatus = async (status: string) => {
    if (!callId) return;
    await supabase.from('admin_calls').update({ status }).eq('id', callId);
  };

  const cleanup = () => {
    try { zpRef.current?.destroy(); } catch { /* already destroyed */ }
    zpRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;

    if (!profile?.id) return;

    let cancelled = false;

    const initZego = async () => {
      try {
        const ZegoUIKitPrebuilt = await loadZegoSDK();

        if (cancelled || !mountedRef.current) return;

        const appIdNum = Number(ZEGO_APP_ID);
        const serverSecretStr = String(ZEGO_SERVER_SECRET);

        if (!appIdNum || isNaN(appIdNum) || appIdNum <= 0) {
          throw new Error(`Invalid ZEGO AppID: ${ZEGO_APP_ID}`);
        }
        if (!serverSecretStr || serverSecretStr.length < 10) {
          throw new Error(`Invalid ZEGO ServerSecret`);
        }

        const container = containerRef.current;
        if (!container) {
          if (mountedRef.current) setRetryKey(k => k + 1);
          return;
        }

        const userID = profile.id;
        const userName = profile.full_name || (isCaller ? 'Admin' : otherName);

        await new Promise<void>(resolve => setTimeout(resolve, 100));

        if (cancelled || !mountedRef.current) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appIdNum,
          serverSecretStr,
          roomId,
          userID,
          userName,
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        if (isCaller) {
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
              if (mountedRef.current) {
                setPhase('connected');
                setError(null);
              }
            },
            onLeaveRoom: () => {
              if (mountedRef.current) setPhase('ended');
              updateCallStatus('ended');
            },
          });
        }
      } catch (err: any) {
        console.error('ZEGO_INIT_FAILED:', err);
        if (mountedRef.current) setError(`Hindi ma-start ang video call: ${err?.message || String(err)}`);
      }
    };

    initZego();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profile?.id, retryKey]);

  async function acceptCall() {
    if (!zpRef.current || !containerRef.current) return;
    try {
      const ZegoUIKitPrebuilt = await loadZegoSDK();
      zpRef.current.joinRoom({
        container: containerRef.current,
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        showScreenSharingButton: false,
        showMyCameraToggleButton: false,
        showMyMicrophoneToggleButton: false,
        showTextChat: false,
        showUserList: false,
        turnOnCameraWhenJoining: true,
        turnOnMicrophoneWhenJoining: true,
        onJoinRoom: () => {
          if (mountedRef.current) {
            setPhase('connected');
            setError(null);
          }
        },
        onLeaveRoom: () => {
          if (mountedRef.current) setPhase('ended');
          updateCallStatus('ended');
        },
      });
      await updateCallStatus('accepted');
    } catch (err: any) {
      console.error('ZEGO_ACCEPT_FAILED:', err);
      setError(`Hindi ma-access ang camera o microphone: ${err?.message || String(err)}`);
    }
  }

  async function declineCall() {
    await updateCallStatus('declined');
    cleanup();
    onEnd();
  }

  async function endCall() {
    cleanup();
    await updateCallStatus('ended');
    if (mountedRef.current) setPhase('ended');
  }

  if (phase === 'ended') {
    return (
      <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col items-center justify-center max-w-md mx-auto">
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
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col max-w-md mx-auto">
      {/* ZEGOCLOUD SDK renders the video call UI inside this container.
          Always rendered so the ref is available when the effect runs. */}
      <div ref={containerRef} className="flex-1 w-full h-full" />

      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded-xl z-10 flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Outgoing overlay (caller waiting for answer) */}
      {phase === 'outgoing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900">
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Video size={48} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-1">Tumatawag kay {isCaller ? otherName : 'Admin'}...</p>
            <p className="text-blue-200 text-sm">Naghihintay ng sagot</p>
          </div>
          <div className="mt-2 flex gap-2 items-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <button onClick={endCall} className="mt-10 w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
          <p className="text-gray-400 text-xs mt-3">I-cancel ang tawag</p>
        </div>
      )}

      {/* Incoming overlay (callee sees accept/decline) */}
      {phase === 'incoming' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900">
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6 ring-4 ring-blue-400/50 animate-pulse">
              <Video size={48} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-1">Si {isCaller ? otherName : 'Admin'} (Admin) ang tumatawag</p>
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

      {/* Custom end call button overlay (only when connected) */}
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
