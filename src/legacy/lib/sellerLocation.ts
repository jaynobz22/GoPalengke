import { PALENGKE_DIRECTORY, NEAR_PALENGKE_KM } from './palengkeDirectory';
import { getCityMarkets } from './philippineLocations';

export const SELLER_LOCATION_TYPES = ['palengke', 'talipapa', 'farm'] as const;
export type SellerLocationType = typeof SELLER_LOCATION_TYPES[number] | '';
export interface SellerCoordinates { lat: number; lng: number }
export interface SellerMarketOption { name: string; distanceKm: number | null }

const normalizeCity = (city: string) => city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/^city of /, '').replace(/ city$/, '').trim();

export function sellerMarketOptions(city: string, region: string, coords?: SellerCoordinates | null): SellerMarketOption[] {
  const validCoords = coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
    && Math.abs(coords.lat) <= 90 && Math.abs(coords.lng) <= 180 ? coords : null;
  const cityKey = normalizeCity(city);
  const options = new Map<string, SellerMarketOption>();
  for (const market of PALENGKE_DIRECTORY) {
    const radians = Math.PI / 180;
    const dLat = validCoords ? (market.lat - validCoords.lat) * radians : 0;
    const dLng = validCoords ? (market.lng - validCoords.lng) * radians : 0;
    const h = validCoords ? Math.sin(dLat / 2) ** 2 + Math.cos(validCoords.lat * radians)
      * Math.cos(market.lat * radians) * Math.sin(dLng / 2) ** 2 : 0;
    const distanceKm = validCoords ? 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h))) : null;
    const sameCity = Boolean(cityKey) && normalizeCity(market.city) === cityKey
      && (!region || !/^\d{10}$/.test(region) || market.region === region);
    if ((distanceKm != null && distanceKm <= NEAR_PALENGKE_KM) || sameCity) {
      options.set(market.name.toLowerCase(), { name: market.name, distanceKm });
    }
  }
  const cityAlias = Object.keys(CITY_MARKET_NAMES).find(name => normalizeCity(name) === cityKey);
  for (const name of getCityMarkets(cityAlias || city)) {
    if (!options.has(name.toLowerCase())) options.set(name.toLowerCase(), { name, distanceKm: null });
  }
  return [...options.values()].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    || a.name.localeCompare(b.name));
}

// Reuse the original city aliases instead of maintaining another market list.
import { MARKET_NAMES as CITY_MARKET_NAMES } from './philippineLocations';

export function storedSellerLocationType(type: string | null, market: string | null): SellerLocationType {
  if (SELLER_LOCATION_TYPES.some(value => value === type)) return type as SellerLocationType;
  return market ? 'palengke' : '';
}