// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ShieldCheck, ShieldAlert, Fingerprint, Loader2, LogOut, Trash2, Check, Smartphone, Laptop } from 'lucide-react';

const KEY = 'ADMIN_DEVICE_LOCK';
const DEVICE_KEY = 'gp_admin_device_id';
const SESSION_OK = 'gp_admin_bio_ok';

type Device = { id: string; label: string; type: 'laptop' | 'phone'; approved: boolean; credId?: string; created: string };
type LockData = { devices: Device[] };

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    id = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
const isPhone = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const guessLabel = () => {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android phone' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows laptop' : 'Device';
  return `${os} (${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })})`;
};
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const rand = (n = 32) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };

export async function loadLock(): Promise<LockData> {
  const { data } = await supabase.from('platform_settings').select('value').eq('key', KEY).maybeSingle();
  try { return data?.value ? JSON.parse(data.value) : { devices: [] }; } catch { return { devices: [] }; }
}
export async function saveLock(lock: LockData, userId?: string) {
  const { error } = await supabase.from('platform_settings').upsert({ key: KEY, value: JSON.stringify(lock), updated_by: userId });
  if (error) throw error;
}

async function registerBiometric(userId: string, name: string): Promise<string> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(),
      rp: { name: 'GoPalengke Admin', id: location.hostname },
      user: { id: new TextEncoder().encode(userId.slice(0, 64)), name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  });
  return b64(cred.rawId);
}
async function verifyBiometric(credId: string) {
  await navigator.credentials.get({
    publicKey: {
      challenge: rand(),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: unb64(credId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
}

type State = 'checking' | 'ok' | 'pending' | 'needBioSetup' | 'needBio' | 'error';

export function AdminDeviceGate({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const [state, setState] = useState<State>('checking');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);

  const check = useCallback(async () => {
    if (!profile) return;
    const id = getDeviceId();
    const lock = await loadLock();
    // First time the lock is used: this device becomes the owner device.
    if (lock.devices.filter(d => d.approved).length === 0) {
      lock.devices = [{ id, label: guessLabel(), type: isPhone() ? 'phone' : 'laptop', approved: true, created: new Date().toISOString() }];
      await saveLock(lock, profile.id);
    }
    let d = lock.devices.find(x => x.id === id);
    if (!d) {
      d = { id, label: guessLabel(), type: isPhone() ? 'phone' : 'laptop', approved: false, created: new Date().toISOString() };
      lock.devices.push(d);
      await saveLock(lock, profile.id);
    }
    setDevice(d);
    if (!d.approved) return setState('pending');
    if (d.type === 'phone') {
      if (!d.credId) return setState('needBioSetup');
      if (sessionStorage.getItem(SESSION_OK) === id) return setState('ok');
      return setState('needBio');
    }
    setState('ok');
  }, [profile]);

  useEffect(() => { check().catch(e => { setMsg(e.message); setState('error'); }); }, [check]);

  async function setupBio() {
    setBusy(true); setMsg('');
    try {
      const credId = await registerBiometric(profile.id, profile.email || 'admin');
      const lock = await loadLock();
      const d = lock.devices.find(x => x.id === device.id);
      if (!d?.approved) throw new Error('Hindi na approved ang device na ito.');
      d.credId = credId;
      await saveLock(lock, profile.id);
      sessionStorage.setItem(SESSION_OK, device.id);
      setState('ok');
    } catch (e) { setMsg(e?.message || 'Hindi na-set up ang fingerprint/Face ID.'); }
    setBusy(false);
  }
  async function doBio() {
    setBusy(true); setMsg('');
    try {
      await verifyBiometric(device.credId);
      sessionStorage.setItem(SESSION_OK, device.id);
      setState('ok');
    } catch { setMsg('Hindi na-verify. Subukan ulit.'); }
    setBusy(false);
  }

  if (state === 'ok') return <>{children}</>;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 px-5">
      <div className="bg-white rounded-3xl shadow-lg p-6 max-w-sm w-full text-center">
        {state === 'checking' && <Loader2 size={32} className="animate-spin text-brand-500 mx-auto" />}
        {state === 'pending' && (<>
          <ShieldAlert size={44} className="text-red-500 mx-auto mb-3" />
          <h2 className="font-bold text-gray-800 text-lg">Naka-lock ang Admin Panel</h2>
          <p className="text-sm text-gray-500 mt-2">Hindi pa approved ang device na ito. Buksan ang admin panel sa approved mong laptop → <b>Settings → Admin Devices</b> at i-approve ang:</p>
          <p className="mt-3 font-mono text-sm bg-gray-100 rounded-xl py-2">{device?.label} · {device?.id.slice(0, 6).toUpperCase()}</p>
        </>)}
        {(state === 'needBioSetup' || state === 'needBio') && (<>
          <Fingerprint size={48} className="text-brand-600 mx-auto mb-3" />
          <h2 className="font-bold text-gray-800 text-lg">{state === 'needBioSetup' ? 'I-set up ang Fingerprint / Face ID' : 'I-verify na ikaw ito'}</h2>
          <p className="text-sm text-gray-500 mt-2">{state === 'needBioSetup' ? 'Isang beses lang ito. Pagkatapos, hihingin ito tuwing bubuksan mo ang admin panel sa phone na ito.' : 'Gamitin ang fingerprint o Face ID ng phone mo.'}</p>
          <button onClick={state === 'needBioSetup' ? setupBio : doBio} disabled={busy}
            className="mt-4 w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />} {state === 'needBioSetup' ? 'I-set up ngayon' : 'I-unlock'}
          </button>
        </>)}
        {state === 'error' && <p className="text-sm text-red-500">Error: {msg}</p>}
        {msg && state !== 'error' && <p className="text-xs text-red-500 mt-3">{msg}</p>}
        <button onClick={() => signOut?.()} className="mt-5 text-xs text-gray-400 inline-flex items-center gap-1"><LogOut size={12} /> Mag-logout</button>
      </div>
    </div>
  );
}

export function AdminDevicesSettings() {
  const { profile } = useAuth();
  const [lock, setLock] = useState<LockData | null>(null);
  const myId = typeof window !== 'undefined' ? getDeviceId() : '';
  const reload = useCallback(async () => setLock(await loadLock()), []);
  useEffect(() => { reload(); }, [reload]);

  async function update(fn: (l: LockData) => void) {
    const l = await loadLock(); fn(l);
    try { await saveLock(l, profile?.id); } catch (e) { alert('Error: ' + e.message); }
    reload();
  }

  if (!lock) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={20} className="text-brand-600" />
        <h3 className="font-semibold text-gray-800 text-sm">Admin Devices</h3>
      </div>
      <p className="text-xs text-gray-400 mb-3">Dito lang sa mga approved na device makakapasok ang admin. Laptop = naka-lock sa device. Phone = kailangan ng fingerprint/Face ID.</p>
      <div className="space-y-2">
        {lock.devices.map(d => (
          <div key={d.id} className={`rounded-xl border p-3 flex items-center gap-3 ${d.approved ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50'}`}>
            {d.type === 'phone' ? <Smartphone size={20} className="text-gray-500" /> : <Laptop size={20} className="text-gray-500" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{d.label} <span className="font-mono text-xs text-gray-400">{d.id.slice(0, 6).toUpperCase()}</span></p>
              <p className="text-[11px] text-gray-500">
                {d.id === myId && 'Ito ang device mo ngayon · '}
                {!d.approved ? 'Naghihintay ng approval' : d.type === 'phone' ? (d.credId ? 'Fingerprint/Face ID naka-set' : 'Ise-set up ang fingerprint sa susunod na login') : 'Naka-lock sa device'}
              </p>
            </div>
            {!d.approved && (
              <button onClick={() => update(l => { const x = l.devices.find(y => y.id === d.id); if (x) x.approved = true; })}
                className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"><Check size={12} /> Approve</button>
            )}
            {d.id !== myId && (
              <button onClick={() => { if (confirm(`Alisin ang "${d.label}"?`)) update(l => { l.devices = l.devices.filter(y => y.id !== d.id); }); }}
                className="px-2 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs"><Trash2 size={12} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
