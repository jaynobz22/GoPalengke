// Known public markets across the Philippines, used to detect which palengke
// are near the buyer. `major: true` = malaking bagsakan / dinadayo ng mga
// namimili at negosyante — LAGING lumalabas sa listahan kahit medyo malayo.
// `region` = PSGC region code so we can match even without GPS.
export interface PalengkeInfo {
  name: string;
  city: string;
  province?: string;
  region: string; // PSGC region code
  lat: number;
  lng: number;
  major?: boolean;
}

// PSGC region codes
const NCR = '1300000000';
const CAR = '1400000000';
const R1 = '0100000000';
const R2 = '0200000000';
const R3 = '0300000000';
const R4A = '0400000000';
const R5 = '0500000000';
const R6 = '0600000000';
const R7 = '0700000000';
const R8 = '0800000000';
const R9 = '0900000000';
const R10 = '1000000000';
const R11 = '1100000000';
const R12 = '1200000000';
const R13 = '1600000000';

export const PALENGKE_DIRECTORY: PalengkeInfo[] = [
  // ===== NCR =====
  { name: 'Balintawak Market', city: 'Quezon City', region: NCR, lat: 14.6570, lng: 121.0035, major: true },
  { name: 'Divisoria Market', city: 'City of Manila', region: NCR, lat: 14.6017, lng: 120.9730, major: true },
  { name: 'Navotas Fish Port Complex', city: 'City of Navotas', region: NCR, lat: 14.6600, lng: 120.9430, major: true },
  { name: 'Pasig Mega Market', city: 'City of Pasig', region: NCR, lat: 14.5640, lng: 121.0800, major: true },
  { name: 'Nepa Q-Mart', city: 'Quezon City', region: NCR, lat: 14.6270, lng: 121.0390 },
  { name: 'Commonwealth Market', city: 'Quezon City', region: NCR, lat: 14.6960, lng: 121.0870 },
  { name: 'Marikina Public Market', city: 'City of Marikina', region: NCR, lat: 14.6300, lng: 121.0960 },
  { name: 'Alabang Public Market', city: 'City of Muntinlupa', region: NCR, lat: 14.4190, lng: 121.0440 },
  { name: 'Baclaran Market', city: 'City of Paranaque', region: NCR, lat: 14.5320, lng: 120.9950 },
  { name: 'Caloocan City Public Market', city: 'City of Caloocan', region: NCR, lat: 14.6500, lng: 120.9670 },

  // ===== Region I (Ilocos / Pangasinan) =====
  { name: 'Urdaneta City Public Market (Bagsakan)', city: 'City of Urdaneta', province: 'Pangasinan', region: R1, lat: 15.9760, lng: 120.5710, major: true },
  { name: 'Dagupan City Public Market', city: 'City of Dagupan', province: 'Pangasinan', region: R1, lat: 16.0430, lng: 120.3390, major: true },
  { name: 'Magsaysay Market', city: 'City of Dagupan', province: 'Pangasinan', region: R1, lat: 16.0470, lng: 120.3430 },
  { name: 'Calasiao Public Market', city: 'Calasiao', province: 'Pangasinan', region: R1, lat: 16.0110, lng: 120.3610 },
  { name: 'San Carlos City Public Market', city: 'City of San Carlos', province: 'Pangasinan', region: R1, lat: 15.9280, lng: 120.3490 },
  { name: 'Alaminos City Public Market', city: 'City of Alaminos', province: 'Pangasinan', region: R1, lat: 16.1560, lng: 119.9800 },
  { name: 'Lingayen Public Market', city: 'Lingayen', province: 'Pangasinan', region: R1, lat: 16.0210, lng: 120.2320 },
  { name: 'San Fernando City Public Market', city: 'City of San Fernando', province: 'La Union', region: R1, lat: 16.6160, lng: 120.3190, major: true },
  { name: 'Laoag City Public Market', city: 'City of Laoag', province: 'Ilocos Norte', region: R1, lat: 18.1960, lng: 120.5940 },
  { name: 'Vigan Public Market', city: 'City of Vigan', province: 'Ilocos Sur', region: R1, lat: 17.5740, lng: 120.3870 },

  // ===== CAR (Cordillera) =====
  { name: 'La Trinidad Vegetable Trading Post', city: 'La Trinidad', province: 'Benguet', region: CAR, lat: 16.4560, lng: 120.5880, major: true },
  { name: 'Baguio City Public Market', city: 'City of Baguio', province: 'Benguet', region: CAR, lat: 16.4160, lng: 120.5940, major: true },
  { name: 'Tabuk City Public Market', city: 'City of Tabuk', province: 'Kalinga', region: CAR, lat: 17.4490, lng: 121.4440 },

  // ===== Region II (Cagayan Valley) =====
  { name: 'Tuguegarao City Public Market', city: 'City of Tuguegarao', province: 'Cagayan', region: R2, lat: 17.6130, lng: 121.7270, major: true },
  { name: 'Santiago City Public Market (Bagsakan)', city: 'City of Santiago', province: 'Isabela', region: R2, lat: 16.6880, lng: 121.5480, major: true },
  { name: 'Cauayan City Public Market', city: 'City of Cauayan', province: 'Isabela', region: R2, lat: 16.9350, lng: 121.7700 },

  // ===== Region III (Central Luzon) =====
  { name: 'Cabanatuan City Public Market (Bagsakan)', city: 'City of Cabanatuan', province: 'Nueva Ecija', region: R3, lat: 15.4870, lng: 120.9680, major: true },
  { name: 'Pampang Public Market', city: 'City of Angeles', province: 'Pampanga', region: R3, lat: 15.1400, lng: 120.5920, major: true },
  { name: 'San Fernando Public Market', city: 'City of San Fernando', province: 'Pampanga', region: R3, lat: 15.0330, lng: 120.6900 },
  { name: 'Tarlac City Public Market', city: 'City of Tarlac', province: 'Tarlac', region: R3, lat: 15.4890, lng: 120.5960 },
  { name: 'Malolos Public Market', city: 'City of Malolos', province: 'Bulacan', region: R3, lat: 14.8430, lng: 120.8110 },
  { name: 'Olongapo City Public Market', city: 'City of Olongapo', province: 'Zambales', region: R3, lat: 14.8290, lng: 120.2820 },

  // ===== Region IV-A (CALABARZON) =====
  { name: 'Tanauan City Trading Post (Bagsakan)', city: 'City of Tanauan', province: 'Batangas', region: R4A, lat: 14.0860, lng: 121.1490, major: true },
  { name: 'Sariaya Bagsakan / Sentrong Pamilihan', city: 'Sariaya', province: 'Quezon', region: R4A, lat: 13.9640, lng: 121.5260, major: true },
  { name: 'Lipa City Public Market', city: 'City of Lipa', province: 'Batangas', region: R4A, lat: 13.9410, lng: 121.1630 },
  { name: 'Batangas City Public Market', city: 'City of Batangas', province: 'Batangas', region: R4A, lat: 13.7560, lng: 121.0580 },
  { name: 'Lucena City Public Market', city: 'City of Lucena', province: 'Quezon', region: R4A, lat: 13.9330, lng: 121.6170 },
  { name: 'Calamba Public Market', city: 'City of Calamba', province: 'Laguna', region: R4A, lat: 14.2110, lng: 121.1650 },
  { name: 'Dasmarinas Public Market', city: 'City of Dasmarinas', province: 'Cavite', region: R4A, lat: 14.3290, lng: 120.9370 },
  { name: 'Antipolo Public Market', city: 'City of Antipolo', province: 'Rizal', region: R4A, lat: 14.5870, lng: 121.1760 },

  // ===== Region V (Bicol) =====
  { name: 'Naga City People\u2019s Mall / Public Market', city: 'City of Naga', province: 'Camarines Sur', region: R5, lat: 13.6230, lng: 123.1820, major: true },
  { name: 'Legazpi City Public Market', city: 'City of Legazpi', province: 'Albay', region: R5, lat: 13.1390, lng: 123.7340, major: true },
  { name: 'Sorsogon City Public Market', city: 'City of Sorsogon', province: 'Sorsogon', region: R5, lat: 12.9740, lng: 124.0060 },

  // ===== Region VI (Western Visayas) =====
  { name: 'Iloilo Central Market', city: 'City of Iloilo', province: 'Iloilo', region: R6, lat: 10.6960, lng: 122.5730, major: true },
  { name: 'Iloilo Terminal Market (Super)', city: 'City of Iloilo', province: 'Iloilo', region: R6, lat: 10.6930, lng: 122.5790 },
  { name: 'Bacolod Central Market', city: 'City of Bacolod', province: 'Negros Occidental', region: R6, lat: 10.6700, lng: 122.9500, major: true },
  { name: 'Roxas City Public Market', city: 'City of Roxas', province: 'Capiz', region: R6, lat: 11.5850, lng: 122.7510 },
  { name: 'Kalibo Public Market', city: 'Kalibo', province: 'Aklan', region: R6, lat: 11.7080, lng: 122.3650 },

  // ===== Region VII (Central Visayas) =====
  { name: 'Carbon Public Market', city: 'City of Cebu', province: 'Cebu', region: R7, lat: 10.2930, lng: 123.8960, major: true },
  { name: 'Pasil Fish Market', city: 'City of Cebu', province: 'Cebu', region: R7, lat: 10.2880, lng: 123.8890, major: true },
  { name: 'Taboan Public Market', city: 'City of Cebu', province: 'Cebu', region: R7, lat: 10.2950, lng: 123.8850 },
  { name: 'Mandaue City Public Market', city: 'City of Mandaue', province: 'Cebu', region: R7, lat: 10.3250, lng: 123.9410 },
  { name: 'Dumaguete Public Market', city: 'City of Dumaguete', province: 'Negros Oriental', region: R7, lat: 9.3080, lng: 123.3060 },
  { name: 'Tagbilaran City Public Market', city: 'City of Tagbilaran', province: 'Bohol', region: R7, lat: 9.6470, lng: 123.8550 },

  // ===== Region VIII (Eastern Visayas) =====
  { name: 'Tacloban City Public Market', city: 'City of Tacloban', province: 'Leyte', region: R8, lat: 11.2410, lng: 125.0030, major: true },
  { name: 'Ormoc City Public Market', city: 'City of Ormoc', province: 'Leyte', region: R8, lat: 11.0060, lng: 124.6070 },

  // ===== Region IX =====
  { name: 'Zamboanga City Public Market', city: 'City of Zamboanga', province: 'Zamboanga del Sur', region: R9, lat: 6.9100, lng: 122.0740, major: true },
  { name: 'Pagadian City Public Market', city: 'City of Pagadian', province: 'Zamboanga del Sur', region: R9, lat: 7.8260, lng: 123.4370 },

  // ===== Region X (Northern Mindanao) =====
  { name: 'Agora Public Market', city: 'City of Cagayan de Oro', province: 'Misamis Oriental', region: R10, lat: 8.4870, lng: 124.6560, major: true },
  { name: 'Cogon Public Market', city: 'City of Cagayan de Oro', province: 'Misamis Oriental', region: R10, lat: 8.4780, lng: 124.6460, major: true },
  { name: 'Iligan City Public Market', city: 'City of Iligan', province: 'Lanao del Norte', region: R10, lat: 8.2280, lng: 124.2450 },
  { name: 'Malaybalay City Public Market', city: 'City of Malaybalay', province: 'Bukidnon', region: R10, lat: 8.1570, lng: 125.1270 },
  { name: 'Valencia City Bagsakan', city: 'City of Valencia', province: 'Bukidnon', region: R10, lat: 7.9060, lng: 125.0940, major: true },

  // ===== Region XI (Davao) =====
  { name: 'Bankerohan Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.0685, lng: 125.6030, major: true },
  { name: 'Calinan Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.1895, lng: 125.4555, major: true },
  { name: 'Toril Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.0185, lng: 125.4975, major: true },
  { name: 'Agdao Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.0845, lng: 125.6235, major: true },
  { name: 'Mintal Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.0905, lng: 125.5005, major: true },
  { name: 'Matina Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.0590, lng: 125.5880 },
  { name: 'Tugbok Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.1045, lng: 125.4830 },
  { name: 'Cabaguio Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.0960, lng: 125.6285 },
  { name: 'Buhangin Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.1110, lng: 125.6150 },
  { name: 'Lanang Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.1030, lng: 125.6330 },
  { name: 'Bunawan Public Market', city: 'Davao City', province: 'Davao del Sur', region: R11, lat: 7.2360, lng: 125.6440 },
  { name: 'Tagum City Public Market', city: 'City of Tagum', province: 'Davao del Norte', region: R11, lat: 7.4470, lng: 125.8070, major: true },
  { name: 'Digos City Public Market', city: 'City of Digos', province: 'Davao del Sur', region: R11, lat: 6.7490, lng: 125.3570 },
  { name: 'Panabo City Public Market', city: 'City of Panabo', province: 'Davao del Norte', region: R11, lat: 7.3080, lng: 125.6840 },

  // ===== Region XII (SOCCSKSARGEN) =====
  { name: 'General Santos City Public Market', city: 'General Santos City', province: 'South Cotabato', region: R12, lat: 6.1120, lng: 125.1720, major: true },
  { name: 'GenSan Fish Port Complex', city: 'General Santos City', province: 'South Cotabato', region: R12, lat: 6.1040, lng: 125.1520, major: true },
  { name: 'Koronadal City Public Market', city: 'City of Koronadal', province: 'South Cotabato', region: R12, lat: 6.5030, lng: 124.8470 },
  { name: 'Kidapawan City Public Market', city: 'City of Kidapawan', province: 'Cotabato', region: R12, lat: 7.0080, lng: 125.0890 },

  // ===== Region XIII (Caraga) =====
  { name: 'Butuan City Public Market (Langihan)', city: 'City of Butuan', province: 'Agusan del Norte', region: R13, lat: 8.9490, lng: 125.5460, major: true },
  { name: 'Surigao City Public Market', city: 'City of Surigao', province: 'Surigao del Norte', region: R13, lat: 9.7880, lng: 125.4940 },
];

/** Max distance (km) a rider comfortably covers for a palengke run. */
export const NEAR_PALENGKE_KM = 15;
/** How many nearest markets to feature as "malapit". */
export const NEAR_PALENGKE_COUNT = 4;
/** Max distance (km) a major bagsakan still shows up as worth travelling to. */
export const MAJOR_PALENGKE_KM = 100;
/** Beyond this, a market belongs to a totally different area. */
export const MAX_PALENGKE_KM = 60;

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s: string) =>
  s.toLowerCase().replace(/^city of /, '').replace(/ city$/, '').replace(/[^a-z0-9 ]/g, '').trim();

export interface PalengkeOption { name: string; distanceKm: number | null; major?: boolean }

export interface PalengkeFilter {
  city?: string;
  province?: string;
  /** PSGC region code (10 digits) */
  region?: string;
  coords?: { lat: number; lng: number } | null;
  /** Palengke names coming from registered stores. */
  extraNames?: string[];
}

/**
 * Split palengke into "major" (malalaking bagsakan, laging kasama),
 * "near" (reachable by rider) and "far".
 * Works nationwide: kapag walang GPS, ginagamit ang region/province/city
 * na pinili ng buyer para piliin ang tamang mga palengke.
 */
export function groupPalengke(
  filter: PalengkeFilter,
): { major: PalengkeOption[]; near: PalengkeOption[]; far: PalengkeOption[] } {
  const { city = '', province = '', region = '', coords = null, extraNames = [] } = filter;
  const c = norm(city);
  const p = norm(province);

  const matches = PALENGKE_DIRECTORY.filter(m => {
    if (coords) return km(coords, m) <= MAJOR_PALENGKE_KM;
    if (region && m.region === region) return true;
    if (c && norm(m.city) === c) return true;
    if (p && m.province && norm(m.province) === p) return true;
    return false;
  });

  const map = new Map<string, PalengkeOption>();
  for (const m of matches) {
    const d = coords ? km(coords, m) : null;
    map.set(m.name.toLowerCase(), { name: m.name, distanceKm: d, ...(m.major ? { major: true } : {}) });
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

  const withD = rest.filter(o => o.distanceKm != null && o.distanceKm <= MAX_PALENGKE_KM)
    .sort((a, b) => a.distanceKm! - b.distanceKm!);
  const near = withD.filter(o => o.distanceKm! <= NEAR_PALENGKE_KM).slice(0, NEAR_PALENGKE_COUNT);
  const nearSet = new Set(near.map(o => o.name));
  const far = [...withD.filter(o => !nearSet.has(o.name)), ...rest.filter(o => o.distanceKm == null)];
  return { major, near, far };
}
