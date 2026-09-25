// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Video, PhoneOff, Phone, AlertCircle } from 'lucide-react';
import { JitsiStage } from './JitsiStage';

type CallPhase = 'outgoing' | 'incoming' | 'connected' | 'ended';

interface AdminVideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  callId?: string;
  onEnd: () => void;
}

export function AdminVideoCall({ roomId, isCaller, otherName, callId, onEnd }: AdminVideoCallProps) {
  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'incoming');
  const [joined, setJoined] = useState(isCaller);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<any>(null);

  const updateCallStatus = async (status: string) => {
    if (!callId) return;
    await supabase.from('admin_calls').update({ status }).eq('id', callId);
  };

  async function acceptCall() {
    setJoined(true);
    await updateCallStatus('accepted');
  }

  async function declineCall() {
    await updateCallStatus('declined');
    onEnd();
  }

  async function endCall() {
    try { apiRef.current?.executeCommand('hangup'); } catch {}
    setJoined(false);
    setPhase('ended');
    await updateCallStatus('ended');
  }

  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 max-w-md mx-auto overflow-hidden">

      {joined && phase !== 'ended' && (
        <JitsiStage
          roomId={roomId}
          apiRef={apiRef}
          displayName={isCaller ? 'Admin' : undefined}
          onOtherJoined={() => setPhase('connected')}
          onOtherLeft={() => endCall()}
          onLeft={() => endCall()}
          onError={(m) => setError(m)}
        />
      )}

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

    </div>
  );
}
