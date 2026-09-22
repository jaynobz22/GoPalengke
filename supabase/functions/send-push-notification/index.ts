import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const enc = new TextEncoder();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { data: pending, error: fetchError } = await supabase
      .from("push_notification_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const notif of pending) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh_key, auth_key")
        .eq("user_id", notif.user_id)
        .eq("is_active", true);

      if (!subs || subs.length === 0) {
        await supabase
          .from("push_notification_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", notif.id);
        continue;
      }

      let allSent = true;

      for (const sub of subs) {
        try {
          const result = await sendWebPush(
            sub.endpoint,
            sub.p256dh_key,
            sub.auth_key,
            {
              title: notif.title,
              body: notif.body,
              url: notif.url,
              tag: `gopalengke-${notif.role}`,
            },
          );

          if (!result.ok) {
            if (result.status === 410 || result.status === 404) {
              await supabase
                .from("push_subscriptions")
                .update({ is_active: false })
                .eq("endpoint", sub.endpoint);
            }
            allSent = false;
          }
        } catch {
          allSent = false;
        }
      }

      if (allSent) {
        sentCount++;
        await supabase
          .from("push_notification_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", notif.id);
      } else {
        failedCount++;
        await supabase
          .from("push_notification_queue")
          .update({ status: "failed", sent_at: new Date().toISOString() })
          .eq("id", notif.id);
      }
    }

    return new Response(
      JSON.stringify({ processed: pending.length, sent: sentCount, failed: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// =========================================================
// Web Push via Web Crypto API
// =========================================================

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const payloadBytes = enc.encode(JSON.stringify(payload));
  const encrypted = await encryptAes128Gcm(payloadBytes, p256dh, auth);

  const vapidToken = await generateVapidToken(endpoint);

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(encrypted.byteLength),
      "Authorization": `vapid t=${vapidToken}, k=${VAPID_PUBLIC_KEY}`,
      "TTL": "86400",
    },
    body: encrypted,
  });
}

// --- VAPID JWT (ES256) ---

async function generateVapidToken(endpoint: string): Promise<string> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:noreply@gopalengke.net",
  };

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKey = await importVapidKey();
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(signingInput),
  );

  const sigB64 = b64url(new Uint8Array(signature));
  return `${signingInput}.${sigB64}`;
}

async function importVapidKey(): Promise<CryptoKey> {
  const d = b64urlDecode(VAPID_PRIVATE_KEY);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: b64url(d),
    ext: true,
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// --- aes128gcm encryption (RFC 8291) ---

async function encryptAes128Gcm(
  plaintext: Uint8Array,
  p256dhBase64: string,
  authBase64: string,
): Promise<ArrayBuffer> {
  const subscriberPubKey = b64urlDecode(p256dhBase64);
  const subscriberAuth = b64urlDecode(authBase64);

  // Generate ephemeral ECDH key pair
  const ephKey = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const ephPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephKey.publicKey),
  );

  // Import subscriber's public key for ECDH
  const subKey = await crypto.subtle.importKey(
    "raw",
    subscriberPubKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subKey },
      ephKey.privateKey,
      256,
    ),
  );

  // IKM = sharedSecret
  // PRK = HMAC-SHA256(subscriberAuth, IKM)  — HKDF-Extract with salt = auth
  const prk = await hmacSha256(subscriberAuth, sharedSecret);

  // HKDF-Expand: info = "WebPush:info\0" || ephPubKey || subscriberPubKey, L = 32
  const infoStr = enc.encode("WebPush:info\0");
  const info = new Uint8Array([...infoStr, ...ephPubKeyRaw, ...subscriberPubKey]);
  const cekInfo = new Uint8Array([...info, 0x01]); // counter = 1 for first 32 bytes
  const cekAndNonce = await hmacSha256(prk, cekInfo);

  const contentEncryptionKey = cekAndNonce.slice(0, 16);
  const nonce = cekAndNonce.slice(16, 28); // 12 bytes for AES-GCM IV

  // Encrypt: AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  // aes128gcm padding: append 2-byte record padding (0x02 0x00)
  const padded = new Uint8Array(plaintext.length + 2);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 0x02;
  padded[plaintext.length + 1] = 0x00;

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      aesKey,
      padded,
    ),
  );

  // Build the aes128gcm record:
  // salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rs = new Uint8Array(4);
  const totalSize = 16 + 4 + 1 + 65 + ciphertext.length;
  new DataView(rs.buffer).setUint32(0, totalSize, false);

  const result = new Uint8Array(totalSize);
  let offset = 0;
  result.set(salt, offset); offset += 16;
  result.set(rs, offset); offset += 4;
  result[offset] = 65; offset += 1; // keyid length = 65 (uncompressed P-256)
  result.set(ephPubKeyRaw, offset); offset += 65;
  result.set(ciphertext, offset);

  return result.buffer;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));
}

// --- Base64URL helpers ---

function b64url(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
