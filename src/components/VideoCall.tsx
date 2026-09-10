import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Phone, Loader2, ExternalLink, AlertCircle } from 'lucide-react';

type CallPhase = 'outgoing' | 'connecting' | 'connected' | 'ended';

interface VideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  autoAccept?: boolean;
  preWarmedStream?: MediaStream | null;
  onEnd: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayprojectsecret' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayprojectsecret' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayprojectsecret' },
];

function log(...args: unknown[]) {
  console.log('%c[VideoCall]', 'color:#3b82f6;font-weight:bold', ...args);
}

function isStandalonePWA(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  } catch { return false; }
}

function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
}

async function acquireStream(): Promise<MediaStream> {
  if (!hasMediaDevices()) throw new Error('Camera not available');
  const constraints: MediaStreamConstraints = {
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err: any) {
    if (err?.name === 'NotAllowedError' || err?.name === 'NotReadableError' || err?.name === 'OverconstrainedError') {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
          const combined = new MediaStream();
          audioStream.getAudioTracks().forEach(t => combined.addTrack(t));
          videoStream.getVideoTracks().forEach(t => combined.addTrack(t));
          return combined;
        } catch { return audioStream; }
      } catch {
        try { return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); }
        catch { throw err; }
      }
    }
    throw err;
  }
}

export function VideoCall({ roomId, isCaller, otherName, autoAccept, preWarmedStream, onEnd }: VideoCallProps) {
  const { profile } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  const pendingOfferRef = useRef<any>(null);
  const gotCameraRef = useRef(false);
  const myUserIdRef = useRef<string | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const relayAttemptedRef = useRef(false);
  const offerCreatedRef = useRef(false);
  const phaseRef = useRef<CallPhase>(isCaller ? 'outgoing' : 'connecting');

  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const setPhaseSafe = (p: CallPhase) => {
    phaseRef.current = p;
    if (mountedRef.current) setPhase(p);
  };

  const sendSignal = async (event: string, payload: Record<string, unknown>) => {
    if (!myUserIdRef.current) return;
    log('SEND', event);
    try {
      await supabase.from('call_signals').insert({ room_id: roomId, sender_id: myUserIdRef.current, event, payload });
    } catch (e) { log('SEND ERROR', event, e); }
  };

  const getCamera = async (): Promise<MediaStream | null> => {
    if (gotCameraRef.current && localStreamRef.current) return localStreamRef.current;
    if (preWarmedStream) {
      localStreamRef.current = preWarmedStream;
      gotCameraRef.current = true;
      if (localVideoRef.current) localVideoRef.current.srcObject = preWarmedStream;
      return preWarmedStream;
    }
    if (!hasMediaDevices()) {
      if (isStandalonePWA()) setShowFallback(true);
      setError('Hindi available ang camera sa device na ito.');
      return null;
    }
    try {
      const stream = await acquireStream();
      localStreamRef.current = stream;
      gotCameraRef.current = true;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err: any) {
      const n = err?.name || '', m = err?.message || String(err);
      log('CAMERA ERROR', n, m);
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
        if (isStandalonePWA()) setShowFallback(true);
        setError('Hindi pinapayagan ang camera/microphone. I-allow sa settings o buksan sa browser.');
      } else if (n === 'NotReadableError' || n === 'TrackStartError') {
        if (retryCountRef.current < 3) { retryCountRef.current++; await new Promise(r => setTimeout(r, 500)); return getCamera(); }
        if (isStandalonePWA()) setShowFallback(true);
        setError('Ginagamit ng ibang app ang camera. Isara o buksan sa browser.');
      } else if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
        setError('Walang camera o microphone ang device.');
      } else {
        if (isStandalonePWA()) setShowFallback(true);
        setError(`Hindi ma-access ang camera/mic: ${m}`);
      }
      return null;
    }
  };

  const flushPendingCandidates = async () => {
    if (!pcRef.current || !remoteDescriptionSetRef.current) return;
    const queue = [...remoteCandidatesQueueRef.current];
    remoteCandidatesQueueRef.current = [];
    log('FLUSH', `${queue.length} queued ICE candidates`);
    for (const c of queue) {
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { log('FLUSH ERROR', e); }
    }
  };

  const createPeerConnection = (stream: MediaStream, forceRelay = false): RTCPeerConnection | null => {
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    remoteDescriptionSetRef.current = false;
    remoteCandidatesQueueRef.current = [];
    try {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceTransportPolicy: forceRelay ? 'relay' : 'all' });
      pcRef.current = pc;
      log('PC CREATED', `forceRelay=${forceRelay}`);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = (e) => {
        log('ONTRACK', e.track.kind);
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          remoteVideoRef.current.play().catch(() => setTimeout(() => remoteVideoRef.current?.play().catch(() => {}), 200));
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          log('ICE CANDIDATE', e.candidate.candidate?.substring(0, 50));
          sendSignal('ice', { candidate: e.candidate.toJSON() });
        } else {
          log('ICE GATHERING COMPLETE');
        }
      };
      pc.oniceconnectionstatechange = () => {
        log('ICE STATE', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' && !relayAttemptedRef.current && phaseRef.current !== 'connected') {
          relayAttemptedRef.current = true;
          log('ICE FAILED → relay fallback');
          const s = localStreamRef.current;
          if (s) {
            const newPc = createPeerConnection(s, true);
            if (newPc) {
              if (isCaller) doCreateOffer();
              else doAcceptCall();
            }
          }
        }
      };
      pc.onconnectionstatechange = () => {
        log('CONN STATE', pc.connectionState);
        if (pc.connectionState === 'connected') relayAttemptedRef.current = false;
      };
      pc.onsignalingstatechange = () => log('SIGNALING STATE', pc.signalingState);
      return pc;
    } catch (e) { log('PC CREATE ERROR', e); return null; }
  };

  const doCreateOffer = async () => {
    if (offerCreatedRef.current) { log('OFFER ALREADY CREATED, skip'); return; }
    log('CREATE OFFER START');
    const stream = await getCamera();
    if (!stream) return;
    let pc = pcRef.current;
    if (!pc) pc = createPeerConnection(stream);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      offerCreatedRef.current = true;
      log('OFFER CREATED, sending');
      await sendSignal('offer', { sdp: offer.toJSON() });
    } catch (e) { log('CREATE OFFER ERROR', e); }
  };

  const doAcceptCall = async () => {
    log('ACCEPT CALL START');
    const stream = await getCamera();
    if (!stream) return;
    let pc = pcRef.current;
    if (!pc) pc = createPeerConnection(stream);
    if (!pc) return;
    if (pendingOfferRef.current) {
      const offer = pendingOfferRef.current;
      pendingOfferRef.current = null;
      await processOffer(pc, offer);
    }
  };

  const processOffer = async (pc: RTCPeerConnection, payload: any) => {
    if (remoteDescriptionSetRef.current) return;
    try {
      log('SET REMOTE DESCRIPTION (offer)');
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteDescriptionSetRef.current = true;
      log('REMOTE DESCRIPTION SET (offer)');
      await flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      log('ANSWER CREATED, sending');
      await sendSignal('answer', { sdp: answer.toJSON() });
      setPhaseSafe('connected');
    } catch (e) { log('PROCESS OFFER ERROR', e); }
  };

  const processAnswer = async (pc: RTCPeerConnection, payload: any) => {
    if (remoteDescriptionSetRef.current) return;
    try {
      log('SET REMOTE DESCRIPTION (answer)');
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteDescriptionSetRef.current = true;
      log('REMOTE DESCRIPTION SET (answer)');
      await flushPendingCandidates();
      setPhaseSafe('connected');
    } catch (e) { log('PROCESS ANSWER ERROR', e); }
  };

  const handleSignal = async (sig: { id: string; event: string; payload: any; sender_id: string }) => {
    if (sig.sender_id === myUserIdRef.current) return;
    if (processedIdsRef.current.has(sig.id)) return;
    processedIdsRef.current.add(sig.id);
    const { event, payload } = sig;
    log('RECV', event);

    try {
      if (event === 'offer') {
        if (!isCaller) {
          const pc = pcRef.current;
          if (!pc) { log('OFFER buffered (no PC yet)'); pendingOfferRef.current = payload; }
          else await processOffer(pc, payload);
        }
      } else if (event === 'answer') {
        if (isCaller) {
          const pc = pcRef.current;
          if (pc) await processAnswer(pc, payload);
        }
      } else if (event === 'ice') {
        try {
          if (pcRef.current && remoteDescriptionSetRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            log('ICE ADDED immediately');
          } else {
            remoteCandidatesQueueRef.current.push(payload.candidate);
            log('ICE QUEUED', `queue size=${remoteCandidatesQueueRef.current.length}`);
          }
        } catch (e) { log('ICE ERROR', e); }
      } else if (event === 'end') {
        log('REMOTE ENDED');
        setPhaseSafe('ended');
      }
    } catch (e) { log('HANDLE SIGNAL ERROR', event, e); }
  };

  const cleanup = () => {
    log('CLEANUP');
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    try { supabase.from('call_signals').delete().eq('room_id', roomId).then(() => {}); } catch {}
    gotCameraRef.current = false; remoteDescriptionSetRef.current = false; pendingOfferRef.current = null;
    remoteCandidatesQueueRef.current = []; processedIdsRef.current.clear(); retryCountRef.current = 0;
    relayAttemptedRef.current = false; offerCreatedRef.current = false;
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!profile?.id) return;
    myUserIdRef.current = profile.id;
    log('MOUNT', `roomId=${roomId} isCaller=${isCaller}`);

    let sub: ReturnType<typeof supabase.channel> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const pollSignals = async () => {
      if (cancelled) return;
      try {
        const { data } = await supabase.from('call_signals').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
        if (data) for (const s of data) await handleSignal(s);
      } catch (e) { log('POLL ERROR', e); }
    };

    (async () => {
      try {
        // Query existing signals
        await pollSignals();
        if (cancelled) return;

        // Subscribe to realtime
        await new Promise<void>((resolve) => {
          sub = supabase.channel(`call-${roomId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `room_id=eq.${roomId}` }, (p: any) => handleSignal(p.new))
            .subscribe((status: string) => { log('SUB STATUS', status); resolve(); });
        });
        if (cancelled) return;

        // Re-query after subscription
        await pollSignals();

        // Start polling every 800ms as fallback to realtime
        pollTimer = setInterval(pollSignals, 800);

        // Start call flow
        if (isCaller) {
          log('CALLER: creating offer immediately');
          await doCreateOffer();
        } else if (autoAccept) {
          log('RECEIVER: accepting call');
          await doAcceptCall();
        }
      } catch (e) { log('LIFECYCLE ERROR', e); }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (sub) supabase.removeChannel(sub);
      if (pollTimer) clearInterval(pollTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profile?.id]);

  function toggleMic() { if (localStreamRef.current) { localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !micOn; }); setMicOn(!micOn); } }
  function toggleCam() { if (localStreamRef.current) { localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !camOn; }); setCamOn(!camOn); } }
  function endCall() { sendSignal('end', {}); setPhaseSafe('ended'); cleanup(); onEnd(); }
  function openInBrowser() { window.open(window.location.href, '_blank', 'noopener,noreferrer'); }

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

  if (phase === 'outgoing') {
    return (
      <div className="fixed inset-0 z-[80] bg-gradient-to-b from-blue-900 to-gray-900 flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="w-28 h-28 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6 animate-pulse"><Video size={48} className="text-white" /></div>
          <p className="text-white text-xl font-bold mb-1">Tumatawag kay {otherName}...</p><p className="text-blue-200 text-sm">Naghihintay ng sagot</p>
        </div>
        <div className="mt-2 flex gap-2 items-center">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        {error && <div className="mt-4 px-6 max-w-sm"><p className="text-red-300 text-sm text-center">{error}</p>
          {showFallback && <button onClick={openInBrowser} className="mt-3 px-6 py-2 bg-white text-gray-800 rounded-xl text-sm font-semibold active:scale-95 transition flex items-center gap-2 mx-auto"><ExternalLink size={16} /> Open in Browser</button>}
        </div>}
        <button onClick={endCall} className="mt-10 w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg"><PhoneOff size={28} className="text-white" /></button>
        <p className="text-gray-400 text-xs mt-3">I-cancel ang tawag</p>
      </div>
    );
  }

  if (phase === 'connecting') {
    return (
      <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col max-w-md mx-auto">
        <div className="flex-1 relative flex items-center justify-center">
          <div className="text-center"><Loader2 size={48} className="text-blue-400 animate-spin mx-auto mb-4" /><p className="text-white text-lg font-semibold">Kumokonekta...</p><p className="text-gray-400 text-sm mt-1">Naghihintay kay {otherName}</p></div>
          <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border-2 border-white/20 shadow-lg z-10"><video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" /></div>
        </div>
        {error && <div className="absolute top-4 left-4 right-4 z-10"><div className="bg-red-500/90 text-white text-sm px-4 py-3 rounded-xl">{error}</div>
          {showFallback && <button onClick={openInBrowser} className="mt-2 w-full px-6 py-2 bg-white text-gray-800 rounded-xl text-sm font-semibold active:scale-95 transition flex items-center justify-center gap-2"><ExternalLink size={16} /> Open in System Browser</button>}
        </div>}
        <div className="pb-8 pt-4 px-6 flex items-center justify-center"><button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg"><PhoneOff size={28} className="text-white" /></button></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col max-w-md mx-auto">
      {error && <div className="absolute top-4 left-4 right-4 z-20"><div className="bg-red-500/90 text-white text-sm px-4 py-3 rounded-xl flex items-start gap-2"><span className="flex-1">{error}</span>
        {showFallback && <button onClick={openInBrowser} className="text-white font-semibold underline text-xs whitespace-nowrap">Open in Browser</button>}</div></div>}
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-center"><div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3"><Video size={36} className="text-gray-500" /></div><p className="text-gray-400 text-sm">Naghihintay ng video ni {otherName}...</p></div></div>
      </div>
      <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border-2 border-white/20 shadow-lg z-10">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        {!camOn && <div className="absolute inset-0 bg-gray-800 flex items-center justify-center"><VideoOff size={20} className="text-gray-500" /></div>}
      </div>
      <div className="absolute top-4 left-4 z-10"><p className="text-white font-semibold text-sm drop-shadow-lg">{otherName}</p><p className="text-white/60 text-xs">Live na video call</p></div>
      <div className="pb-8 pt-4 px-6 flex items-center justify-center gap-5 bg-gradient-to-t from-gray-900 to-transparent">
        <button onClick={toggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition shadow-lg ${micOn ? 'bg-white/15' : 'bg-white'}`}>{micOn ? <Mic size={24} className="text-white" /> : <MicOff size={24} className="text-gray-800" />}</button>
        <button onClick={toggleCam} className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition shadow-lg ${camOn ? 'bg-white/15' : 'bg-white'}`}>{camOn ? <Video size={24} className="text-white" /> : <VideoOff size={24} className="text-gray-800" />}</button>
        <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg"><PhoneOff size={28} className="text-white" /></button>
      </div>
    </div>
  );
}
