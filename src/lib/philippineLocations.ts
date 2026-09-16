export interface CityInfo {
  name: string;
  code: string;
  barangays: string[];
}

export interface ProvinceInfo {
  name: string;
  code: string;
}

export interface RegionInfo {
  code: string;
  name: string;
}

const API_BASE = 'https://psgc.cloud/api';

// In-memory caches
const cache = {
  regions: null as RegionInfo[] | null,
  provincesByRegion: new Map<string, ProvinceInfo[]>(),
  allProvinces: null as ProvinceInfo[] | null,
  citiesByProvince: new Map<string, CityInfo[]>(),
  citiesByRegion: new Map<string, CityInfo[]>(),
  barangaysByCity: new Map<string, string[]>(),
};

// Keep MARKET_NAMES for backward compatibility (SellerApp)
export const MARKET_NAMES: Record<string, string[]> = {
  'City of Manila': ['Divisoria Public Market', 'Quintuple Public Market', 'Pritil Public Market', 'Santa Ana Public Market', 'Dagupan-Binondo Market'],
  'Manila': ['Divisoria Public Market', 'Quintuple Public Market', 'Pritil Public Market', 'Santa Ana Public Market', 'Dagupan-Binondo Market'],
  'Quezon City': ['Balintawak Public Market', 'Commonwealth Public Market', 'Farmers Market (Cubao)', 'Muñoz Public Market', 'Novaliches Public Market', 'Tandang Sora Public Market'],
  'City of Makati': ['Guadalupe Public Market', 'Poblacion Public Market', 'Bangkal Public Market'],
  'Makati City': ['Guadalupe Public Market', 'Poblacion Public Market', 'Bangkal Public Market'],
  'City of Pasig': ['Pasig Palengke', 'Kapasigan Public Market', 'Pinagbuhatan Public Market'],
  'Pasig City': ['Pasig Palengke', 'Kapasigan Public Market', 'Pinagbuhatan Public Market'],
  'City of Taguig': ['Taguig Public Market', 'Lower Bicutan Public Market', 'Tipas Public Market'],
  'Taguig City': ['Taguig Public Market', 'Lower Bicutan Public Market', 'Tipas Public Market'],
  'City of Marikina': ['Marikina Public Market', 'Sto. Niño Public Market'],
  'Marikina City': ['Marikina Public Market', 'Sto. Niño Public Market'],
  'City of Muntinlupa': ['Alabang Public Market', 'Putatan Public Market'],
  'Muntinlupa City': ['Alabang Public Market', 'Putatan Public Market'],
  'City of Las Piñas': ['Las Piñas Public Market', 'Zapote Public Market'],
  'Las Piñas City': ['Las Piñas Public Market', 'Zapote Public Market'],
  'City of Parañaque': ['Baclaran Public Market', 'Tambo Public Market'],
  'Parañaque City': ['Baclaran Public Market', 'Tambo Public Market'],
  'City of Valenzuela': ['Malinta Public Market', 'Karuhatan Public Market'],
  'Valenzuela City': ['Malinta Public Market', 'Karuhatan Public Market'],
  'City of Malabon': ['Malabon Public Market', 'Dampalit Public Market'],
  'Malabon City': ['Malabon Public Market', 'Dampalit Public Market'],
  'City of Navotas': ['Navotas Public Market', 'Tanza Public Market'],
  'Navotas City': ['Navotas Public Market', 'Tanza Public Market'],
  'City of Caloocan': ['Caloocan Public Market', 'Monumento Public Market', 'Bagong Silang Public Market'],
  'Caloocan City': ['Caloocan Public Market', 'Monumento Public Market', 'Bagong Silang Public Market'],
  'Pasay City': ['Pasay Public Market', 'Cartimar Market'],
  'City of San Juan': ['Pinaglabanan Public Market', 'Greenhills Market'],
  'San Juan City': ['Pinaglabanan Public Market', 'Greenhills Market'],
  'City of Mandaluyong': ['Mandaluyong Public Market', 'Shaw Market'],
  'Mandaluyong City': ['Mandaluyong Public Market', 'Shaw Market'],
  'Pateros': ['Pateros Public Market'],
  'Baguio City': ['Baguio City Public Market', 'Hangar Market', 'Hilltop Market'],
  'City of San Fernando': ['San Fernando Public Market'],
  'San Fernando City': ['San Fernando Public Market'],
  'City of Vigan': ['Vigan Public Market'],
  'Vigan City': ['Vigan Public Market'],
  'City of Laoag': ['Laoag Public Market'],
  'Laoag City': ['Laoag Public Market'],
  'Angeles City': ['Angeles Public Market', 'Nepo Mart'],
  'Olongapo City': ['Olongapo Public Market'],
  'San Jose del Monte': ['San Jose del Monte Public Market'],
  'City of Malolos': ['Malolos Public Market'],
  'Malolos City': ['Malolos Public Market'],
  'Cabanatuan City': ['Cabanatuan Public Market'],
  'Tarlac City': ['Tarlac Public Market', 'Capas Public Market'],
  'Antipolo City': ['Antipolo Public Market', 'Sumulong Public Market'],
  'Bacoor City': ['Bacoor Public Market'],
  'Dasmariñas City': ['Dasmariñas Public Market'],
  'City of Dasmariñas': ['Dasmariñas Public Market'],
  'Imus City': ['Imus Public Market'],
  'Cavite City': ['Cavite Public Market'],
  'Tagaytay City': ['Tagaytay Public Market'],
  'Lipa City': ['Lipa Public Market'],
  'Batangas City': ['Batangas Public Market', 'Pulong Buhangin Market'],
  'Santa Rosa City': ['Santa Rosa Public Market'],
  'City of Santa Rosa': ['Santa Rosa Public Market'],
  'Calamba City': ['Calamba Public Market'],
  'Iloilo City': ['La Paz Public Market', 'Jaro Public Market', 'Central Market (Super)', 'Mandurriao Public Market'],
  'Bacolod City': ['Bacolod Public Market', 'Lacson-Burgos Market'],
  'Roxas City': ['Roxas Public Market'],
  'Kalibo': ['Kalibo Public Market'],
  'Cebu City': ['Carbon Public Market', 'Pasil Fish Port & Market', 'Mambaling Public Market', 'Taboan Public Market'],
  'Mandaue City': ['Mandaue Public Market'],
  'Lapu-Lapu City': ['Lapu-Lapu Public Market', 'Mactan Market'],
  'Dumaguete City': ['Dumaguete Public Market'],
  'Tagbilaran City': ['Tagbilaran Public Market'],
  'Tacloban City': ['Tacloban Public Market'],
  'Ormoc City': ['Ormoc Public Market'],
  'Zamboanga City': ['Barasta Public Market', 'Putik Public Market', 'Veterans Public Market'],
  'Dipolog City': ['Dipolog Public Market'],
  'Pagadian City': ['Pagadian Public Market'],
  'Cagayan de Oro': ['Cogon Public Market', 'Carmen Public Market', 'Bulua Public Market', 'Macabalan Fish Port'],
  'Iligan City': ['Iligan Public Market', 'Pala-o Public Market'],
  'Malaybalay City': ['Malaybalay Public Market'],
  'Davao City': ['Agdao Public Market', 'Bankerohan Public Market', 'Buhangin Public Market', 'Bunawan Public Market', 'Calinan Public Market', 'Matina Public Market', 'Mintal Public Market', 'Toril Public Market', 'Cabaguio Public Market', 'Lanang Public Market'],
  'Tagum City': ['Tagum Public Market'],
  'Panabo City': ['Panabo Public Market'],
  'Digos City': ['Digos Public Market'],
  'General Santos': ['Gensan Public Market', 'Labangal Fish Port & Market', 'Fatima Public Market'],
  'Koronadal City': ['Koronadal Public Market'],
  'Kidapawan City': ['Kidapawan Public Market'],
  'Cotabato City': ['Cotabato Public Market'],
  'Butuan City': ['Butuan Public Market'],
  'Surigao City': ['Surigao Public Market'],
  'Naga City': ['Naga City People\'s Mall', 'Naga Central Market'],
  'Legazpi City': ['Legazpi City Public Market', 'Albay Public Market'],
  'Sorsogon City': ['Sorsogon Public Market'],
  'Tabaco City': ['Tabaco Public Market'],
  'Masbate City': ['Masbate Public Market'],
  'Daet': ['Daet Public Market'],
  'Virac': ['Virac Public Market'],
  'Puerto Princesa City': ['Puerto Princesa Public Market'],
  'City of Puerto Princesa': ['Puerto Princesa Public Market'],
  'Calapan City': ['Calapan Public Market'],
};

// Fetch all regions (cached)
export async function fetchRegions(): Promise<RegionInfo[]> {
  if (cache.regions) return cache.regions;
  const res = await fetch(`${API_BASE}/regions`);
  const data = await res.json();
  cache.regions = data.map((r: any) => ({ code: r.code, name: r.name }));
  return cache.regions;
}

// Fetch all provinces (cached)
export async function fetchAllProvinces(): Promise<ProvinceInfo[]> {
  if (cache.allProvinces) return cache.allProvinces;
  const res = await fetch(`${API_BASE}/provinces`);
  const data = await res.json();
  cache.allProvinces = data.map((p: any) => ({ code: p.code, name: p.name }));
  return cache.allProvinces;
}

// Fetch provinces for a specific region (cached)
export async function fetchProvincesByRegion(regionCode: string): Promise<ProvinceInfo[]> {
  if (cache.provincesByRegion.has(regionCode)) return cache.provincesByRegion.get(regionCode)!;

  const allProvinces = await fetchAllProvinces();
  const prefix = regionCode.substring(0, 2);
  const provinces = allProvinces.filter(p => p.code.startsWith(prefix));
  cache.provincesByRegion.set(regionCode, provinces);
  return provinces;
}

// Fetch cities/municipalities for a province (cached)
export async function fetchCitiesByProvince(provinceCode: string): Promise<CityInfo[]> {
  if (cache.citiesByProvince.has(provinceCode)) return cache.citiesByProvince.get(provinceCode)!;

  const res = await fetch(`${API_BASE}/provinces/${provinceCode}/cities-municipalities`);
  const data = await res.json();
  const cities: CityInfo[] = data.map((c: any) => ({
    name: c.name.trim(),
    code: c.code,
    barangays: [],
  }));
  cache.citiesByProvince.set(provinceCode, cities);
  return cities;
}

// Fetch cities/municipalities for a region directly (for NCR which has no provinces)
export async function fetchCitiesByRegion(regionCode: string): Promise<CityInfo[]> {
  if (cache.citiesByRegion.has(regionCode)) return cache.citiesByRegion.get(regionCode)!;

  const res = await fetch(`${API_BASE}/cities-municipalities`);
  const data = await res.json();
  const prefix = regionCode.substring(0, 2);
  const cities: CityInfo[] = data
    .filter((c: any) => c.code.startsWith(prefix))
    .map((c: any) => ({
      name: c.name.trim(),
      code: c.code,
      barangays: [],
    }));
  cache.citiesByRegion.set(regionCode, cities);
  return cities;
}

// Fetch barangays for a city/municipality (cached)
export async function fetchBarangaysByCity(cityCode: string): Promise<string[]> {
  if (!cityCode) return [];
  if (cache.barangaysByCity.has(cityCode)) return cache.barangaysByCity.get(cityCode)!;

  const res = await fetch(`${API_BASE}/cities-municipalities/${cityCode}/barangays`);
  const data = await res.json();
  const barangays: string[] = data.map((b: any) => b.name.trim());
  cache.barangaysByCity.set(cityCode, barangays);
  return barangays;
}

// Find city code by name within a province's cities
export async function findCityCode(provinceCode: string, cityName: string): Promise<string | null> {
  const cities = await fetchCitiesByProvince(provinceCode);
  const city = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  return city?.code || null;
}

// Find city code by name within a region's cities (for NCR)
export async function findCityCodeInRegion(regionCode: string, cityName: string): Promise<string | null> {
  const cities = await fetchCitiesByRegion(regionCode);
  const city = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  return city?.code || null;
}

// ============= SYNCHRONOUS API (backward compatibility) =============
// These use the old hardcoded data for the REGIONS_LIST export.
// The async API above should be used for new code.

export const REGIONS_LIST: RegionInfo[] = [
  { code: '0100000000', name: 'Region I (Ilocos Region)' },
  { code: '0200000000', name: 'Region II (Cagayan Valley)' },
  { code: '0300000000', name: 'Region III (Central Luzon)' },
  { code: '0400000000', name: 'Region IV-A (CALABARZON)' },
  { code: '1700000000', name: 'MIMAROPA Region' },
  { code: '0500000000', name: 'Region V (Bicol Region)' },
  { code: '0600000000', name: 'Region VI (Western Visayas)' },
  { code: '0700000000', name: 'Region VII (Central Visayas)' },
  { code: '0800000000', name: 'Region VIII (Eastern Visayas)' },
  { code: '0900000000', name: 'Region IX (Zamboanga Peninsula)' },
  { code: '1000000000', name: 'Region X (Northern Mindanao)' },
  { code: '1100000000', name: 'Region XI (Davao Region)' },
  { code: '1200000000', name: 'Region XII (SOCCSKSARGEN)' },
  { code: '1300000000', name: 'National Capital Region (NCR)' },
  { code: '1400000000', name: 'Cordillera Administrative Region (CAR)' },
  { code: '1600000000', name: 'Region XIII (Caraga)' },
  { code: '1900000000', name: 'Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)' },
];

// Synchronous stubs — return empty arrays. Use async versions instead.
export function getRegionCities(_regionCode: string): CityInfo[] {
  return [];
}

export function getCityBarangays(_regionCode: string, _cityName: string): string[] {
  return [];
}

export function getCityMarkets(cityName: string): string[] {
  return MARKET_NAMES[cityName] || MARKET_NAMES[cityName.replace('City of ', '')] || [];
}
