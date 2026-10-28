# Libreng Video Call sa GoPalengke (walang ZegoCloud)

## Ano ang magbabago
- Ang video call sa chat (buyer ↔ seller) ay tatakbo na direkta sa browser ng dalawang tao gamit ang WebRTC — libre, walang subscription.
- Ang Supabase database mo ang gagamiting "tagapagpasa" ng call setup (sino ang tumatawag, sagot, koneksyon).
- Tatanggalin lahat ng ZegoCloud: ang SDK loader, ang App ID at secret na naka-hardcode ngayon sa code (security risk din ito), at ang admin video call ay ililipat din sa parehong bagong sistema.
- Mananatili ang kasalukuyang flow: pindot ng video button → lalabas ang call card sa chat → "Accept/Decline" → full-screen video na may sariling camera (maliit sa sulok) at camera ng kausap (malaki).
- Mananatili ang video credits (bawas kada minuto sa tumatawag) at call timer.

## Mga kontrol sa call screen
Mute mic, on/off camera, switch front/back camera (para makita ang produkto), end call, at "Connecting…/Reconnecting…" status.

## Paalala (limitasyon)
Libreng public STUN servers (Google) ang gagamitin. Gumagana ito sa karamihan ng WiFi at mobile data, pero sa ilang mahigpit na network (~10–15% ng kaso) baka hindi kumonekta ang video. Kung mangyari iyon, puwedeng magdagdag ng TURN server sa susunod (may libreng tier ang ilang provider).

## Technical details
- Bagong `src/legacy/lib/webrtc.ts`: hook na `useWebRTCCall({ roomId, isCaller, localUserId })`
  - Signaling via Supabase Realtime **broadcast** channel `call:{roomId}` (walang bagong table o migration; ang existing `messages.call_room_id` / `call_status` ang pa rin ang nag-trigger ng incoming call).
  - Flow: callee joins → sends `ready`; caller creates offer → `offer`; callee answers → `answer`; both trickle `ice` candidates (queued until remoteDescription set); `hangup` event ends both sides.
  - `RTCPeerConnection` with `stun:stun.l.google.com:19302` + `stun1`; `ontrack` → remote stream; handles `connectionState` failed → ICE restart once, then end.
  - `getUserMedia` with facingMode, reuse existing `preWarmedStream`; `replaceTrack` for camera switch; full cleanup (stop tracks, close pc, removeChannel) on unmount.
- Rewrite `components/VideoCall.tsx`: same props, `<video autoPlay playsInline muted>` for local, `<video autoPlay playsInline>` for remote; keep credit deduction logic (triggered on `connected`).
- Rewrite `components/AdminVideoCall.tsx` on the same hook (room = existing admin call roomId; keep `admin_calls` status updates).
- Delete `lib/zego.ts`; remove all Zego constants/references (`rg -i zego` must return nothing).
- `ChatView.tsx`: no flow change, only ensure end-call also updates `call_status` to `ended`.
- Verify: build OK, then two Playwright browser contexts with fake media (`--use-fake-device-for-media-stream`) exchanging offer/answer and confirming remote video plays.
- Pagkatapos: i-push sa GitHub.
