// Known public markets with approximate coordinates, used to detect which
// palengke are near the buyer. Add more cities here as GoPalengke expands.
export interface PalengkeInfo { name: string; city: string; lat: number; lng: number }

export const PALENGKE_DIRECTORY: PalengkeInfo[] = [
  // Davao City
  { name: 'Mintal Public Market', city: 'Davao City', lat: 7.0905, lng: 125.5005 },
  { name: 'Toril Public Market', city: 'Davao City', lat: 7.0185, lng: 125.4975 },
  { name: 'Calinan Public Market', city: 'Davao City', lat: 7.1895, lng: 125.4555 },
  { name: 'Tugbok Public Market', city: 'Davao City', lat: 7.1045, lng: 125.4830 },
  { name: 'Matina Public Market', city: 'Davao City', lat: 7.0590, lng: 125.5880 },
  { name: 'Bankerohan Public Market', city: 'Davao City', lat: 7.0685, lng: 125.6030 },
  { name: 'Agdao Public Market', city: 'Davao City', lat: 7.0845, lng: 125.6235 },
  { name: 'Cabaguio Public Market', city: 'Davao City', lat: 7.0960, lng: 125.6285 },
  { name: 'Buhangin Public Market', city: 'Davao City', lat: 7.1110, lng: 125.6150 },
  { name: 'Lanang Public Market', city: 'Davao City', lat: 7.1030, lng: 125.6330 },
  { name: 'Bunawan Public Market', city: 'Davao City', lat: 7.2360, lng: 125.6440 },
];

/** Max distance (km) a rider comfortably covers for a palengke run. */
export const NEAR_PALENGKE_KM = 12;
/** How many nearest markets to feature as "malapit". */
export const NEAR_PALENGKE_COUNT = 3;

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s: string) => s.toLowerCase().replace(/^city of /, '').replace(/ city$/, '').trim();

export interface PalengkeOption { name: string; distanceKm: number | null }

/**
 * Split palengke into "near" (reachable by rider) and "far".
 * extraNames = palengke names coming from registered stores.
 */
export function groupPalengke(
  city: string,
  coords: { lat: number; lng: number } | null,
  extraNames: string[],
): { near: PalengkeOption[]; far: PalengkeOption[] } {
  const c = norm(city || '');
  const known = PALENGKE_DIRECTORY.filter(p => !c || norm(p.city) === c || coords);
  const map = new Map<string, PalengkeOption>();
  for (const p of known) {
    const d = coords ? km(coords, p) : null;
    if (coords && d! > 60) continue; // different city/region entirely
    map.set(p.name.toLowerCase(), { name: p.name, distanceKm: d });
  }
  for (const n of extraNames) {
    if (n && !map.has(n.toLowerCase())) map.set(n.toLowerCase(), { name: n, distanceKm: null });
  }
  const all = [...map.values()];
  if (!coords) return { near: [], far: all.sort((a, b) => a.name.localeCompare(b.name)) };
  const withD = all.filter(o => o.distanceKm != null).sort((a, b) => a.distanceKm! - b.distanceKm!);
  const near = withD.filter(o => o.distanceKm! <= NEAR_PALENGKE_KM).slice(0, NEAR_PALENGKE_COUNT);
  const nearSet = new Set(near.map(o => o.name));
  const far = [...withD.filter(o => !nearSet.has(o.name)), ...all.filter(o => o.distanceKm == null)];
  return { near, far };
}
