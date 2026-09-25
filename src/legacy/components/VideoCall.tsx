// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PhoneOff, AlertCircle, Coins, Clock } from 'lucide-react';
import { VIDEO_CREDIT_RATE_SECONDS } from '../lib/types';
import { JitsiStage } from './JitsiStage';

interface VideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  autoAccept?: boolean;
  preWarmedStream?: MediaStream | null;
  onEnd: () => void;
}

type Phase = 'waiting' | 'connected' | 'ended' | 'failed';

export function VideoCall({ roomId, isCaller, otherName, preWarmedStream, onEnd }: VideoCallProps) {
  const { profile } = useAuth();
  const apiRef = useRef<any>(null);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [error, setError] = useState<string | null>(null);

  const creditTimerRef = useRef<any>(null);
  const callTimerRef = useRef<any>(null);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [showNoCreditsAlert, setShowNoCreditsAlert] = useState(false);

  // Release any pre-warmed camera so Jitsi can use it
  useEffect(() => { preWarmedStream?.getTracks().forEach(t => t.stop()); }, [preWarmedStream]);

  const stopTimers = () => {
    if (creditTimerRef.current) { clearInterval(creditTimerRef.current); creditTimerRef.current = null; }
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
  };

  const hangup = () => {
    try { apiRef.current?.executeCommand('hangup'); } catch {}
    stopTimers();
    setPhase(p => (p === 'failed' ? p : 'ended'));
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
          if (bal <= 0) { setShowNoCreditsAlert(true); hangup(); }
        }, VIDEO_CREDIT_RATE_SECONDS * 1000);
      }
    }
    if (phase === 'ended' || phase === 'failed') stopTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => stopTimers(), []);

  const mm = String(Math.floor(callSeconds / 60)).padStart(2, '0');
  const ss = String(callSeconds % 60).padStart(2, '0');
  const live = phase === 'waiting' || phase === 'connected';

  return (
    <div className="fixed inset-0 bg-gray-900" style={{ zIndex: 999 }}>
      {live && !showNoCreditsAlert && (
        <>
          <JitsiStage
            roomId={roomId}
            apiRef={apiRef}
            displayName={profile?.full_name || profile?.store_name || undefined}
            onOtherJoined={() => setPhase('connected')}
            onOtherLeft={() => hangup()}
            onLeft={() => { stopTimers(); setPhase(p => (p === 'failed' ? p : 'ended')); }}
            onError={(m) => { setError(m); setPhase('failed'); }}
          />
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none" style={{ zIndex: 5 }}>
            <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
              {phase === 'waiting' ? (isCaller ? `Tumatawag kay ${otherName}...` : `Kumokonekta kay ${otherName}...`) : `${otherName} · ${mm}:${ss}`}
            </span>
            {isCaller && creditsLeft !== null && (
              <span className="bg-black/60 text-amber-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
                <Coins size={12} /> {creditsLeft} credits
              </span>
            )}
          </div>
          {phase === 'waiting' && (
            <button onClick={() => { hangup(); onEnd(); }} className="absolute bottom-24 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg" style={{ zIndex: 5 }}>
              <PhoneOff size={24} className="text-white" />
            </button>
          )}
        </>
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
    </div>
  );
}
