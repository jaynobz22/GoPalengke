// @ts-nocheck
// Native WebRTC 1:1 calls using Supabase Realtime broadcast as signaling.
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export type RtcPhase = 'idle' | 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'failed';

interface Opts {
  roomId: string | null;
  isCaller: boolean;
  enabled?: boolean;
  preWarmedStream?: MediaStream | null;
  onRemoteHangup?: () => void;
}

export function useWebRTCCall({ roomId, isCaller, enabled = true, preWarmedStream, onRemoteHangup }: Opts) {
  const [phase, setPhase] = useState<RtcPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chRef = useRef<any>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const restartedRef = useRef(false);
  const endedRef = useRef(false);
  const hangupCb = useRef(onRemoteHangup);
  hangupCb.current = onRemoteHangup;

  const send = (event: string, payload: any = {}) =>
    chRef.current?.send({ type: 'broadcast', event, payload });

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    if (chRef.current) { supabase.removeChannel(chRef.current); chRef.current = null; }
  }, []);

  const hangup = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    try { send('hangup'); } catch {}
    setTimeout(cleanup, 300);
    setPhase('ended');
  }, [cleanup]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    endedRef.current = false;
    let cancelled = false;
    let readyTimer: any = null;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => { if (!remote.getTracks().includes(t)) remote.addTrack(t); });
      if (!e.streams[0] && !remote.getTracks().includes(e.track)) remote.addTrack(e.track);
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onicecandidate = (e) => { if (e.candidate) send('ice', { c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = async () => {
      const s = pc.connectionState;
      if (s === 'connected') { setPhase('connected'); setError(null); }
      else if (s === 'disconnected') setPhase('reconnecting');
      else if (s === 'failed') {
        if (isCaller && !restartedRef.current) {
          restartedRef.current = true;
          setPhase('reconnecting');
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          send('offer', { sdp: offer });
        } else if (!isCaller && !restartedRef.current) {
          restartedRef.current = true; setPhase('reconnecting');
        } else {
          setError('Hindi makakonekta ang video. Subukan muli.');
          setPhase('failed');
        }
      }
    };

    const flushIce = async () => {
      for (const c of pendingIce.current.splice(0)) { try { await pc.addIceCandidate(c); } catch {} }
    };

    const makeOffer = async () => {
      if (pc.signalingState !== 'stable' || pc.localDescription) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send('offer', { sdp: offer });
      setPhase('connecting');
    };

    (async () => {
      try {
        let stream = preWarmedStream && preWarmedStream.getTracks().some(t => t.readyState === 'live') ? preWarmedStream : null;
        if (!stream) stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        if (cancelled) { if (stream !== preWarmedStream) stream.getTracks().forEach(t => t.stop()); return; }
        localRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
      } catch (err: any) {
        setError('Hindi ma-access ang camera o microphone. Payagan ang permission.');
        setPhase('failed');
        return;
      }

      const ch = supabase.channel(`call:${roomId}`, { config: { broadcast: { self: false, ack: false } } });
      chRef.current = ch;
      ch.on('broadcast', { event: 'ready' }, () => { if (isCaller) makeOffer(); })
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (isCaller) return;
          if (readyTimer) { clearInterval(readyTimer); readyTimer = null; }
          setPhase('connecting');
          await pc.setRemoteDescription(payload.sdp);
          await flushIce();
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          send('answer', { sdp: ans });
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (!isCaller || pc.signalingState !== 'have-local-offer') return;
          await pc.setRemoteDescription(payload.sdp);
          await flushIce();
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (pc.remoteDescription) { try { await pc.addIceCandidate(payload.c); } catch {} }
          else pendingIce.current.push(payload.c);
        })
        .on('broadcast', { event: 'hangup' }, () => {
          if (endedRef.current) return;
          endedRef.current = true;
          cleanup();
          setPhase('ended');
          hangupCb.current?.();
        })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED' || cancelled) return;
          setPhase(isCaller ? 'waiting' : 'connecting');
          if (!isCaller) {
            send('ready');
            readyTimer = setInterval(() => { if (!pc.remoteDescription) send('ready'); }, 1500);
          } else {
            send('caller-here');
          }
        });
      // Caller also reacts if the callee is already waiting
      ch.on('broadcast', { event: 'caller-here' }, () => { if (!isCaller && !pc.remoteDescription) send('ready'); });
    })();

    return () => {
      cancelled = true;
      if (readyTimer) clearInterval(readyTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isCaller, enabled]);

  const toggleMic = () => {
    const on = !micOn;
    localRef.current?.getAudioTracks().forEach(t => (t.enabled = on));
    setMicOn(on);
  };
  const toggleCam = () => {
    const on = !camOn;
    localRef.current?.getVideoTracks().forEach(t => (t.enabled = on));
    setCamOn(on);
  };
  const switchCamera = async () => {
    const next = facing === 'user' ? 'environment' : 'user';
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: next } } });
      const newTrack = s.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(x => x.track?.kind === 'video');
      await sender?.replaceTrack(newTrack);
      const stream = localRef.current;
      if (stream) {
        stream.getVideoTracks().forEach(t => { t.stop(); stream.removeTrack(t); });
        newTrack.enabled = camOn;
        stream.addTrack(newTrack);
        setLocalStream(new MediaStream(stream.getTracks()));
      }
      setFacing(next);
    } catch {
      setError('Hindi mapalitan ang camera.');
    }
  };

  return { phase, error, localStream, remoteStream, micOn, camOn, facing, toggleMic, toggleCam, switchCamera, hangup };
}
