import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Phone, Loader2 } from 'lucide-react';

type CallPhase = 'outgoing' | 'connecting' | 'connected' | 'ended';

interface VideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  autoAccept?: boolean;
  onEnd: () => void;
}

export function VideoCall({ roomId, isCaller, otherName, autoAccept, onEnd }: VideoCallProps) {
  const { profile } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  const pendingOfferRef = useRef<any>(null);
  const gotCameraRef = useRef(false);
  const myUserIdRef = useRef<string | null>(null);
  const processedSignalIdsRef = useRef<Set<string>>(new Set());

  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    // Delete all signals for this room
    supabase.from('call_signals').delete().eq('room_id', roomId).then(() => {});
    gotCameraRef.current = false;
    remoteDescriptionSetRef.current = false;
    pendingOfferRef.current = null;
    iceCandidatesRef.current = [];
    processedSignalIdsRef.current.clear();
  }, [roomId]);

  const sendSignal = useCallback(async (event: string, payload: Record<string, unknown>) => {
    if (!myUserIdRef.current) return;
    await supabase.from('call_signals').insert({
      room_id: roomId,
      sender_id: myUserIdRef.current,
      event,
      payload,
    });
  }, [roomId]);

  const getCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (gotCameraRef.current && localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      gotCameraRef.current = true;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err: any) {
      setError(`Hindi ma-access ang camera/mic: ${err?.message || err}. I-allow ang camera at microphone sa browser settings.`);
      return null;
    }
  }, []);

  const setupPeerConnection = useCallback((stream: MediaStream) => {
    if (pcRef.current) pcRef.current.close();
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayprojectsecret',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayprojectsecret',
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayprojectsecret',
        },
        {
          urls: 'turn:openrelay.metered.ca:80?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayprojectsecret',
        },
      ],
      iceTransportPolicy: 'all',
    });
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal('ice', { candidate: e.candidate.toJSON() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setPhase('ended');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPhase('ended');
      }
    };
  }, [sendSignal]);

  const flushPendingCandidates = useCallback(async () => {
    if (!pcRef.current || !remoteDescriptionSetRef.current) return;
    for (const c of iceCandidatesRef.current) {
      try { await pcRef.current.addIceCandidate(c); } catch { /* ignore */ }
    }
    iceCandidatesRef.current = [];
  }, []);

  // Caller: create and send offer
  const createAndSendOffer = useCallback(async () => {
    const stream = await getCamera();
    if (!stream) return;
    setupPeerConnection(stream);
    const pc = pcRef.current!;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal('offer', { sdp: offer.toJSON() });
  }, [getCamera, setupPeerConnection, sendSignal]);

  // Receiver: set up peer connection and process pending offer
  const acceptCallInternal = useCallback(async () => {
    const stream = await getCamera();
    if (!stream) return;
    setupPeerConnection(stream);
    await sendSignal('receiver_ready', {});

    if (pendingOfferRef.current) {
      const offer = pendingOfferRef.current;
      pendingOfferRef.current = null;
      const pc = pcRef.current!;
      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      remoteDescriptionSetRef.current = true;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', { sdp: answer.toJSON() });
      await flushPendingCandidates();
      setPhase('connected');
    }
  }, [getCamera, setupPeerConnection, sendSignal, flushPendingCandidates]);

  // Process incoming signal from database
  const handleSignal = useCallback(async (signal: { id: string; event: string; payload: any; sender_id: string }) => {
    // Skip our own signals
    if (signal.sender_id === myUserIdRef.current) return;
    // Skip already-processed signals
    if (processedSignalIdsRef.current.has(signal.id)) return;
    processedSignalIdsRef.current.add(signal.id);

    const { event, payload } = signal;

    if (event === 'receiver_ready') {
      if (isCaller) {
        await createAndSendOffer();
      }
    } else if (event === 'caller_present') {
      if (!isCaller && autoAccept && pcRef.current) {
        await sendSignal('receiver_ready', {});
      }
    } else if (event === 'offer') {
      if (!pcRef.current) {
        pendingOfferRef.current = payload;
        return;
      }
      const pc = pcRef.current;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteDescriptionSetRef.current = true;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', { sdp: answer.toJSON() });
      await flushPendingCandidates();
      setPhase('connected');
    } else if (event === 'answer') {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteDescriptionSetRef.current = true;
      setPhase('connected');
      await flushPendingCandidates();
    } else if (event === 'ice') {
      const candidate = new RTCIceCandidate(payload.candidate);
      if (pcRef.current && remoteDescriptionSetRef.current) {
        try { await pcRef.current.addIceCandidate(candidate); } catch { /* ignore */ }
      } else {
        iceCandidatesRef.current.push(candidate);
      }
    } else if (event === 'end') {
      setPhase('ended');
    }
  }, [isCaller, autoAccept, createAndSendOffer, sendSignal, flushPendingCandidates]);

  // Set up: load existing signals + subscribe to new ones
  useEffect(() => {
    if (!profile?.id) return;
    myUserIdRef.current = profile.id;

    let subscription: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // 1. Load any existing signals for this room (in case we joined late)
      const { data: existing } = await supabase
        .from('call_signals')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (existing) {
        for (const sig of existing) {
          await handleSignal(sig);
        }
      }

      // 2. Subscribe to new signals via realtime
      subscription = supabase
        .channel(`call-${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `room_id=eq.${roomId}` },
          (payload: any) => {
            handleSignal(payload.new);
          }
        )
        .subscribe();

      // 3. Start our role
      if (isCaller) {
        sendSignal('caller_present', {});
        getCamera();
      } else if (autoAccept) {
        acceptCallInternal();
      }
    })();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, profile?.id]);

  function toggleMic() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !micOn; });
      setMicOn(!micOn);
    }
  }

  function toggleCam() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !camOn; });
      setCamOn(!camOn);
    }
  }

  function endCall() {
    sendSignal('end', {});
    setPhase('ended');
    cleanup();
    onEnd();
  }

  // Ended state
  if (phase === 'ended') {
    return (
      <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col items-center justify-center max-w-md mx-auto">
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
    );
  }

  // Outgoing call — waiting for answer
  if (phase === 'outgoing') {
    return (
      <div className="fixed inset-0 z-[80] bg-gradient-to-b from-blue-900 to-gray-900 flex flex-col items-center justify-center max-w-md mx-auto">
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
        {error && <p className="text-red-300 text-sm mt-4 text-center px-6">{error}</p>}
        <button onClick={endCall} className="mt-10 w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
          <PhoneOff size={28} className="text-white" />
        </button>
        <p className="text-gray-400 text-xs mt-3">I-cancel ang tawag</p>
      </div>
    );
  }

  // Connecting — showing local video while waiting for remote
  if (phase === 'connecting') {
    return (
      <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col max-w-md mx-auto">
        <div className="flex-1 relative flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={48} className="text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">Kumokonekta...</p>
            <p className="text-gray-400 text-sm mt-1">Naghihintay kay {otherName}</p>
          </div>
          <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border-2 border-white/20 shadow-lg z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>
        </div>
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded-xl z-10">
            {error}
          </div>
        )}
        <div className="pb-8 pt-4 px-6 flex items-center justify-center">
          <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg">
            <PhoneOff size={28} className="text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Connected — active video call
  return (
    <div className="fixed inset-0 z-[80] bg-gray-900 flex flex-col max-w-md mx-auto">
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded-xl z-10">
          {error}
        </div>
      )}

      {/* Remote video (full screen) */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
              <Video size={36} className="text-gray-500" />
            </div>
            <p className="text-gray-400 text-sm">Naghihintay ng video ni {otherName}...</p>
          </div>
        </div>
      </div>

      {/* Local video (picture-in-picture) */}
      <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border-2 border-white/20 shadow-lg z-10">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {!camOn && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <VideoOff size={20} className="text-gray-500" />
          </div>
        )}
      </div>

      {/* Caller name */}
      <div className="absolute top-4 left-4 z-10">
        <p className="text-white font-semibold text-sm drop-shadow-lg">{otherName}</p>
        <p className="text-white/60 text-xs">Live na video call</p>
      </div>

      {/* Controls */}
      <div className="pb-8 pt-4 px-6 flex items-center justify-center gap-5 bg-gradient-to-t from-gray-900 to-transparent">
        <button
          onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition shadow-lg ${
            micOn ? 'bg-white/15' : 'bg-white'
          }`}
        >
          {micOn ? <Mic size={24} className="text-white" /> : <MicOff size={24} className="text-gray-800" />}
        </button>

        <button
          onClick={toggleCam}
          className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition shadow-lg ${
            camOn ? 'bg-white/15' : 'bg-white'
          }`}
        >
          {camOn ? <Video size={24} className="text-white" /> : <VideoOff size={24} className="text-gray-800" />}
        </button>

        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-90 transition shadow-lg"
        >
          <PhoneOff size={28} className="text-white" />
        </button>
      </div>
    </div>
  );
}
