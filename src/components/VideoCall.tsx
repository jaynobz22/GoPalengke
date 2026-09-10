import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Phone, Loader2, Camera, CameraOff } from 'lucide-react';

type CallPhase = 'outgoing' | 'connecting' | 'connected' | 'ended';
type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

interface VideoCallProps {
  roomId: string;
  isCaller: boolean;
  otherName: string;
  autoAccept?: boolean;
  onEnd: () => void;
}

async function checkPermission(name: 'camera' | 'microphone'): Promise<PermissionState> {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: name as PermissionName });
      return result.state as PermissionState;
    }
  } catch {
    // navigator.permissions not supported (e.g., iOS Safari) — fall through
  }
  return 'unknown';
}

async function requestCameraAndMic(): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };

  // Check current permission states
  const [camPerm, micPerm] = await Promise.all([
    checkPermission('camera'),
    checkPermission('microphone'),
  ]);

  // If either is explicitly denied, try requesting anyway — the browser may
  // re-prompt in some WebView contexts. If it throws, we catch and guide the user.
  if (camPerm === 'denied' || micPerm === 'denied') {
    // Try anyway — some WebView contexts report 'denied' but still allow re-prompt
  }

  // First attempt: request both together
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err: any) {
    // If combined request failed, try audio-only then video-only
    // This helps in cases where one device is unavailable
    if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
      // No devices found — try with just what's available
    }

    // Try audio only first (camera might be blocked but mic works)
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });

      // Then try to add video
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        // Combine both streams
        const combined = new MediaStream();
        audioStream.getAudioTracks().forEach(t => combined.addTrack(t));
        videoStream.getVideoTracks().forEach(t => combined.addTrack(t));
        return combined;
      } catch {
        // Video failed — return audio-only stream
        return audioStream;
      }
    } catch (audioErr) {
      // Audio also failed — try video only
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        return videoStream;
      } catch {
        // Both failed — rethrow the original error
        throw err;
      }
    }
  }
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
  const retryCountRef = useRef(0);

  const [phase, setPhase] = useState<CallPhase>(isCaller ? 'outgoing' : 'connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permStatus, setPermStatus] = useState<{ camera: PermissionState; mic: PermissionState }>({
    camera: 'unknown',
    mic: 'unknown',
  });
  const [showPermGuide, setShowPermGuide] = useState(false);

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    supabase.from('call_signals').delete().eq('room_id', roomId).then(() => {});
    gotCameraRef.current = false;
    remoteDescriptionSetRef.current = false;
    pendingOfferRef.current = null;
    iceCandidatesRef.current = [];
    processedSignalIdsRef.current.clear();
    retryCountRef.current = 0;
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

    // Check permissions first
    const [camPerm, micPerm] = await Promise.all([
      checkPermission('camera'),
      checkPermission('microphone'),
    ]);
    setPermStatus({ camera: camPerm, mic: micPerm });

    try {
      const stream = await requestCameraAndMic();
      localStreamRef.current = stream;
      gotCameraRef.current = true;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Update permission status after successful access
      setPermStatus({ camera: 'granted', mic: 'granted' });
      return stream;
    } catch (err: any) {
      const errName = err?.name || '';
      const errMsg = err?.message || String(err);

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setError('Hindi pinapayagan ang camera/microphone. Pumunta sa browser o app settings at i-allow ang camera at microphone para sa GoPalengke, then try again.');
        setShowPermGuide(true);
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setError('Walang nakitang camera o microphone ang device. Siguraduhing may camera/mic ang device at naka-connect properly.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        // Camera/mic in use by another app — retry after brief delay
        if (retryCountRef.current < 3) {
          retryCountRef.current++;
          await new Promise(r => setTimeout(r, 500));
          return getCamera();
        }
        setError('Ginagamit ng ibang app ang camera/microphone. Isara ang ibang app na gumagamit ng camera then try again.');
      } else if (errName === 'OverconstrainedError') {
        // Try with less strict constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStreamRef.current = stream;
          gotCameraRef.current = true;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          return stream;
        } catch {
          setError(`Hindi ma-access ang camera/mic: ${errMsg}`);
        }
      } else {
        setError(`Hindi ma-access ang camera/mic: ${errMsg}`);
      }
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

  const createAndSendOffer = useCallback(async () => {
    const stream = await getCamera();
    if (!stream) return;
    setupPeerConnection(stream);
    const pc = pcRef.current!;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal('offer', { sdp: offer.toJSON() });
  }, [getCamera, setupPeerConnection, sendSignal]);

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

  const handleSignal = useCallback(async (signal: { id: string; event: string; payload: any; sender_id: string }) => {
    if (signal.sender_id === myUserIdRef.current) return;
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

  useEffect(() => {
    if (!profile?.id) return;
    myUserIdRef.current = profile.id;

    let subscription: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
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

  async function retryCamera() {
    setError(null);
    setShowPermGuide(false);
    gotCameraRef.current = false;
    retryCountRef.current = 0;
    const stream = await getCamera();
    if (stream && pcRef.current) {
      // Replace tracks on existing peer connection
      stream.getTracks().forEach(track => {
        const sender = pcRef.current!.getSenders().find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pcRef.current!.addTrack(track, stream);
        }
      });
    }
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
        {error && (
          <div className="mt-4 px-6 max-w-sm">
            <p className="text-red-300 text-sm text-center">{error}</p>
            {showPermGuide && (
              <button onClick={retryCamera} className="mt-3 px-6 py-2 bg-white/15 text-white rounded-xl text-sm font-semibold active:scale-95 transition">
                Subukang Muli
              </button>
            )}
          </div>
        )}
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
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-red-500/90 text-white text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
            {showPermGuide && (
              <button onClick={retryCamera} className="mt-2 w-full px-6 py-2 bg-white/15 text-white rounded-xl text-sm font-semibold active:scale-95 transition">
                Subukang Muli
              </button>
            )}
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
        <div className="absolute top-4 left-4 right-4 z-20">
          <div className="bg-red-500/90 text-white text-sm px-4 py-3 rounded-xl flex items-start gap-2">
            <span className="flex-1">{error}</span>
            {showPermGuide && (
              <button onClick={retryCamera} className="text-white font-semibold underline text-xs whitespace-nowrap">
                Retry
              </button>
            )}
          </div>
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
