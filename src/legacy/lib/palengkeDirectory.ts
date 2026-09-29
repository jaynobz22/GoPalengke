// Known public markets with approximate coordinates, used to detect which
// palengke are near the buyer. Add more cities here as GoPalengke expands.
// `major: true` = malaking bagsakan / dinadayo ng mga namimili at negosyante.
// Ang mga major ay LAGING lumalabas sa listahan, kahit medyo malayo.
export interface PalengkeInfo { name: string; city: string; lat: number; lng: number; major?: boolean }

export const PALENGKE_DIRECTORY: PalengkeInfo[] = [
  // Davao City
  { name: 'Bankerohan Public Market', city: 'Davao City', lat: 7.0685, lng: 125.6030, major: true },
  { name: 'Calinan Public Market', city: 'Davao City', lat: 7.1895, lng: 125.4555, major: true },
  { name: 'Toril Public Market', city: 'Davao City', lat: 7.0185, lng: 125.4975, major: true },
  { name: 'Agdao Public Market', city: 'Davao City', lat: 7.0845, lng: 125.6235, major: true },
  { name: 'Mintal Public Market', city: 'Davao City', lat: 7.0905, lng: 125.5005, major: true },
  { name: 'Matina Public Market', city: 'Davao City', lat: 7.0590, lng: 125.5880 },
  { name: 'Tugbok Public Market', city: 'Davao City', lat: 7.1045, lng: 125.4830 },
  { name: 'Cabaguio Public Market', city: 'Davao City', lat: 7.0960, lng: 125.6285 },
  { name: 'Buhangin Public Market', city: 'Davao City', lat: 7.1110, lng: 125.6150 },
  { name: 'Lanang Public Market', city: 'Davao City', lat: 7.1030, lng: 125.6330 },
  { name: 'Bunawan Public Market', city: 'Davao City', lat: 7.2360, lng: 125.6440 },
];

/** Max distance (km) a rider comfortably covers for a palengke run. */
export const NEAR_PALENGKE_KM = 15;
/** How many nearest markets to feature as "malapit". */
export const NEAR_PALENGKE_COUNT = 4;

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s: string) => s.toLowerCase().replace(/^city of /, '').replace(/ city$/, '').trim();

export interface PalengkeOption { name: string; distanceKm: number | null; major?: boolean }

/**
 * Split palengke into "major" (malalaking bagsakan, laging kasama),
 * "near" (reachable by rider) and "far".
 * extraNames = palengke names coming from registered stores.
 */
export function groupPalengke(
  city: string,
  coords: { lat: number; lng: number } | null,
  extraNames: string[],
): { major: PalengkeOption[]; near: PalengkeOption[]; far: PalengkeOption[] } {
  const c = norm(city || '');
  const known = PALENGKE_DIRECTORY.filter(p => !c || norm(p.city) === c || coords);
  const map = new Map<string, PalengkeOption>();
  for (const p of known) {
    const d = coords ? km(coords, p) : null;
    if (coords && d! > 60) continue; // different city/region entirely
    map.set(p.name.toLowerCase(), { name: p.name, distanceKm: d, ...(p.major ? { major: true } : {}) });
  }
  for (const n of extraNames) {
    if (n && !map.has(n.toLowerCase())) map.set(n.toLowerCase(), { name: n, distanceKm: null });
  }
  const all = [...map.values()];
  const byDistanceThenName = (a: PalengkeOption, b: PalengkeOption) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm != null) return -1;
    if (b.distanceKm != null) return 1;
    return a.name.localeCompare(b.name);
  };

  const major = all.filter(o => o.major).sort(byDistanceThenName);
  const majorSet = new Set(major.map(o => o.name));
  const rest = all.filter(o => !majorSet.has(o.name));

  if (!coords) return { major, near: [], far: rest.sort((a, b) => a.name.localeCompare(b.name)) };

  const withD = rest.filter(o => o.distanceKm != null).sort((a, b) => a.distanceKm! - b.distanceKm!);
  const near = withD.filter(o => o.distanceKm! <= NEAR_PALENGKE_KM).slice(0, NEAR_PALENGKE_COUNT);
  const nearSet = new Set(near.map(o => o.name));
  const far = [...withD.filter(o => !nearSet.has(o.name)), ...rest.filter(o => o.distanceKm == null)];
  return { major, near, far };
}
