// @ts-nocheck
import { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, SwitchCamera, PhoneOff } from 'lucide-react';

function VideoEl({ stream, muted, className, mirror }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream || null;
      ref.current.play?.().catch(() => {});
    }
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} style={mirror ? { transform: 'scaleX(-1)' } : undefined} />;
}

export function RtcVideoStage({ call, statusText, topRight }) {
  const { localStream, remoteStream, micOn, camOn, facing, toggleMic, toggleCam, switchCamera, hangup, phase } = call;
  const btn = 'w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition shadow-lg';
  return (
    <div className="absolute inset-0 bg-black">
      <VideoEl stream={remoteStream} muted={false} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/40 bg-gray-800 shadow-xl" style={{ zIndex: 3 }}>
        <VideoEl stream={localStream} muted className="w-full h-full object-cover" mirror={facing === 'user'} />
        {!camOn && <div className="absolute inset-0 flex items-center justify-center bg-gray-800"><VideoOff className="text-white/70" size={24} /></div>}
      </div>
      {(statusText || topRight) && (
        <div className="absolute top-4 left-4 flex flex-col gap-2" style={{ zIndex: 3 }}>
          {statusText && <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">{statusText}</span>}
          {topRight}
        </div>
      )}
      {phase === 'reconnecting' && (
        <div className="absolute inset-x-0 top-1/2 text-center text-white text-sm" style={{ zIndex: 3 }}>Kumokonekta muli…</div>
      )}
      <div className="absolute bottom-8 inset-x-0 flex items-center justify-center gap-4" style={{ zIndex: 3 }}>
        <button onClick={toggleMic} aria-label="Mic" className={`${btn} ${micOn ? 'bg-white/20' : 'bg-white'}`}>
          {micOn ? <Mic className="text-white" size={22} /> : <MicOff className="text-gray-900" size={22} />}
        </button>
        <button onClick={toggleCam} aria-label="Camera" className={`${btn} ${camOn ? 'bg-white/20' : 'bg-white'}`}>
          {camOn ? <Video className="text-white" size={22} /> : <VideoOff className="text-gray-900" size={22} />}
        </button>
        <button onClick={switchCamera} aria-label="Switch camera" className={`${btn} bg-white/20`}>
          <SwitchCamera className="text-white" size={22} />
        </button>
        <button onClick={hangup} aria-label="End call" className={`${btn} bg-red-500 w-16 h-16`}>
          <PhoneOff className="text-white" size={26} />
        </button>
      </div>
    </div>
  );
}
