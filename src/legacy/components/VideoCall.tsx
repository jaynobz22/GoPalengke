// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Video, PhoneOff, AlertCircle, Coins, Clock } from 'lucide-react';
import { VIDEO_CREDIT_RATE_SECONDS } from '../lib/types';
import { useWebRTCCall } from '../lib/webrtc';
import { RtcVideoStage } from './RtcVideoStage';

interface VideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  autoAccept?: boolean;
  preWarmedStream?: MediaStream | null;
  onEnd: () => void;
}

export function VideoCall({ roomId, isCaller, otherName, preWarmedStream, onEnd }: VideoCallProps) {
  const { profile } = useAuth();
  const call = useWebRTCCall({ roomId, isCaller, preWarmedStream });
  const { phase, error, hangup } = call;

  const creditTimerRef = useRef<any>(null);
  const callTimerRef = useRef<any>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [showNoCreditsAlert, setShowNoCreditsAlert] = useState(false);

  const stopTimers = () => {
    if (creditTimerRef.current) { clearInterval(creditTimerRef.current); creditTimerRef.current = null; }
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
  };

  useEffect(() => {
    if (phase === 'connected' && !callTimerRef.current) {
      callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
      if (isCaller && !creditTimerRef.current) {
        setCreditsLeft(profile?.video_credits ?? 0);
        creditTimerRef.current = setInterval(async () => {
          const { data, error: rpcError } = await supabase.rpc('deduct_video_credit');
          if (rpcError) return;
          const bal = data as number;
          setCreditsLeft(bal);
          if (bal <= 0) { stopTimers(); setShowNoCreditsAlert(true); hangup(); }
        }, VIDEO_CREDIT_RATE_SECONDS * 1000);
      }
    }
    if (phase === 'ended' || phase === 'failed') stopTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => stopTimers(), []);

  const mm = String(Math.floor(callSeconds / 60)).padStart(2, '0');
  const ss = String(callSeconds % 60).padStart(2, '0');
  const connectedish = phase === 'connected' || phase === 'reconnecting';

  return (
    <div className="fixed inset-0 bg-gray-900" style={{ zIndex: 999 }}>
      {connectedish && !showNoCreditsAlert && (
        <RtcVideoStage
          call={call}
          statusText={`${otherName} · ${mm}:${ss}`}
          topRight={isCaller && creditsLeft !== null ? (
            <span className="bg-black/60 text-amber-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
              <Coins size={12} /> {creditsLeft} credits
            </span>
          ) : null}
        />
      )}

      {showNoCreditsAlert && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-5">
          <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center mb-4"><Coins size={40} className="text-white" /></div>
          <p className="text-white text-lg font-bold mb-2">Ubos na ang iyong video credits.</p>
          <p className="text-gray-400 text-sm mb-6">Mag-top up upang makatawag muli.</p>
          <button onClick={onEnd} className="px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold">Bumalik sa Chat</button>
        </div>
      )}

      {(phase === 'ended' || phase === 'failed') && !showNoCreditsAlert && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mb-4">
            {phase === 'failed' ? <AlertCircle size={36} className="text-amber-400" /> : <PhoneOff size={36} className="text-gray-400" />}
          </div>
          <p className="text-white text-lg font-semibold mb-1">{phase === 'failed' ? 'Hindi natuloy ang video call' : 'Natapos ang video call'}</p>
          <p className="text-gray-400 text-sm">{error || `Kay ${otherName}`}</p>
          {callSeconds > 0 && <p className="text-gray-500 text-xs mt-2 flex items-center gap-1"><Clock size={12} /> {mm}:{ss}</p>}
          <button onClick={onEnd} className="mt-8 px-8 py-3 bg-white text-gray-800 rounded-2xl font-semibold">Bumalik sa Chat</button>
        </div>
      )}

      {!connectedish && phase !== 'ended' && phase !== 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-gray-900">
          <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mb-6 animate-pulse"><Video size={48} className="text-white" /></div>
          <p className="text-white text-xl font-bold mb-1">{isCaller && phase !== 'connecting' ? `Tumatawag kay ${otherName}...` : 'Kumokonekta...'}</p>
          <p className="text-blue-200 text-sm">{isCaller && phase !== 'connecting' ? 'Naghihintay ng sagot' : 'Sandali lang'}</p>
          {error && <p className="text-red-300 text-sm mt-4 px-6 text-center">{error}</p>}
          <button onClick={() => { hangup(); onEnd(); }} className="mt-10 w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
          <p className="text-gray-400 text-xs mt-3">I-cancel ang tawag</p>
        </div>
      )}
    </div>
  );
}
