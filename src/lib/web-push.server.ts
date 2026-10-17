// Web Push (VAPID + aes128gcm, RFC 8291/8292) using only WebCrypto so it runs on any server runtime.
// The VAPID key pair is derived from the server secret, so no extra env var is needed;
// the matching public key is hard-coded in src/legacy/lib/pushNotifications.ts.
import { p256 } from "@noble/curves/nist.js";

const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};
const cat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};
async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

export async function vapidKeys(secret: string) {
  const d = await hmac(enc.encode(secret), enc.encode("gopalengke-vapid-v1"));
  const pub = p256.getPublicKey(d, false); // 65 bytes, 0x04|x|y
  return { d, pub, publicKey: b64u(pub) };
}

async function vapidJwt(endpoint: string, secret: string) {
  const { d, pub } = await vapidKeys(secret);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: b64u(d), x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:admin@gopalengke.net",
  })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`)));
  return { jwt: `${head}.${body}.${b64u(sig)}`, k: b64u(pub) };
}

async function encrypt(payload: string, p256dh: string, auth: string) {
  const uaPub = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const eph = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, cat(enc.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aes, cat(enc.encode(payload), new Uint8Array([2])) as BufferSource));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

/** Returns HTTP status from the push service (201 = sent, 404/410 = subscription gone). */
export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: Record<string, unknown>,
  secret: string,
) {
  const { jwt, k } = await vapidJwt(sub.endpoint, secret);
  const body = await encrypt(JSON.stringify(payload), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${k}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: body as BodyInit,
  });
  if (!res.ok) console.error(`Web push failed [${res.status}]`, await res.text().catch(() => ""));
  return res.status;
}
