// @ts-nocheck
import { useEffect, useState } from 'react';
import { GpsPermissionModal } from '../components/GpsPermissionModal';

type Role = 'buyer' | 'seller' | 'rider';
export type GpsCoords = { lat: number; lng: number };

function getPosition(): Promise<GpsCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 },
    );
  });
}

/**
 * Siguraduhing naka-ON ang location bago pumasok sa order flow.
 * Kapag hindi makuha, lalabas ang GPS modal at magbabalik ng null.
 */
export async function ensureGps(role: Role): Promise<GpsCoords | null> {
  const pos = await getPosition();
  if (!pos) window.dispatchEvent(new CustomEvent('gp:gps-required', { detail: { role } }));
  return pos;
}

/** Isang beses lang i-mount (sa App). */
export function GlobalGpsGate() {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    const h = (e: any) => setRole(e.detail?.role || 'buyer');
    window.addEventListener('gp:gps-required', h);
    return () => window.removeEventListener('gp:gps-required', h);
  }, []);
  return (
    <GpsPermissionModal open={!!role} role={role || 'buyer'} onRetry={() => {}} onClose={() => setRole(null)} />
  );
}
