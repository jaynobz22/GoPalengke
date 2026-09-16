import { useState, useEffect } from 'react';
import {
  REGIONS_LIST,
  fetchProvincesByRegion,
  fetchCitiesByProvince,
  fetchCitiesByRegion,
  fetchBarangaysByCity,
  type RegionInfo,
  type ProvinceInfo,
  type CityInfo,
} from '@/lib/philippineLocations';

// Map old region codes to PSGC codes for backward compatibility
const OLD_REGION_MAP: Record<string, string> = {
  'NCR': '1300000000',
  'CAR': '1400000000',
  'Region I': '0100000000',
  'Region II': '0200000000',
  'Region III': '0300000000',
  'Region IV-A': '0400000000',
  'Region IV-B': '1700000000',
  'Region V': '0500000000',
  'Region VI': '0600000000',
  'Region VII': '0700000000',
  'Region VIII': '0800000000',
  'Region IX': '0900000000',
  'Region X': '1000000000',
  'Region XI': '1100000000',
  'Region XII': '1200000000',
  'Region XIII': '1600000000',
  'BARMM': '1900000000',
};

function normalizeRegionCode(code: string): string {
  if (!code) return '';
  if (/^\d{10}$/.test(code)) return code; // already PSGC format
  return OLD_REGION_MAP[code] || '';
}

export interface LocationData {
  barangay: string;
  district: string;
  city: string;
  region: string;
  province?: string;
}

interface Props {
  value: LocationData;
  onChange: (data: LocationData) => void;
  label?: string;
  compact?: boolean;
}

export function LocationSelector({ value, onChange, label, compact }: Props) {
  const [regions] = useState<RegionInfo[]>(REGIONS_LIST);
  const [provinces, setProvinces] = useState<ProvinceInfo[]>([]);
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [barangays, setBarangays] = useState<string[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [useCustomBrgy, setUseCustomBrgy] = useState(false);

  const rawRegionCode = value.region || '';
  const regionCode = normalizeRegionCode(rawRegionCode);
  const provinceCode = value.province || '';
  const cityCode = cities.find(c => c.name === value.city)?.code || '';
  const isNCR = regionCode.startsWith('13');

  // Load provinces when region changes
  useEffect(() => {
    if (!regionCode) { setProvinces([]); return; }
    setLoadingProvinces(true);
    setProvinces([]);
    if (isNCR) {
      // NCR has no provinces — load cities directly
      setLoadingProvinces(false);
      return;
    }
    fetchProvincesByRegion(regionCode)
      .then(provs => setProvinces(provs))
      .catch(() => setProvinces([]))
      .finally(() => setLoadingProvinces(false));
  }, [regionCode, isNCR]);

  // Load cities when province changes (or when NCR region changes)
  useEffect(() => {
    if (!regionCode) { setCities([]); return; }
    if (isNCR) {
      setLoadingCities(true);
      fetchCitiesByRegion(regionCode)
        .then(cs => setCities(cs))
        .catch(() => setCities([]))
        .finally(() => setLoadingCities(false));
      return;
    }
    if (!provinceCode) { setCities([]); return; }
    setLoadingCities(true);
    setCities([]);
    fetchCitiesByProvince(provinceCode)
      .then(cs => setCities(cs))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [regionCode, provinceCode, isNCR]);

  // Load barangays when city changes
  useEffect(() => {
    if (!value.city || !cityCode) { setBarangays([]); return; }
    setLoadingBarangays(true);
    setBarangays([]);
    fetchBarangaysByCity(cityCode)
      .then(brgys => {
        setBarangays(brgys);
        if (brgys.length === 0) setUseCustomBrgy(true);
      })
      .catch(() => setBarangays([]))
      .finally(() => setLoadingBarangays(false));
  }, [value.city, cityCode]);

  function handleRegionChange(code: string) {
    onChange({ ...value, region: code, province: '', city: '', barangay: '' });
    setUseCustomBrgy(false);
  }

  function handleProvinceChange(code: string) {
    onChange({ ...value, province: code, city: '', barangay: '' });
    setUseCustomBrgy(false);
  }

  function handleCityChange(c: string) {
    onChange({ ...value, city: c, barangay: '' });
    setUseCustomBrgy(false);
  }

  function handleBarangayChange(b: string) {
    onChange({ ...value, barangay: b });
  }

  function handleDistrictChange(d: string) {
    onChange({ ...value, district: d });
  }

  const inputClass = compact
    ? 'w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm'
    : 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm';
  const labelClass = compact
    ? 'text-xs font-medium text-gray-500 mb-1 block'
    : 'text-sm font-medium text-gray-600 mb-1 block';

  const hasBrgyList = barangays.length > 0;

  return (
    <div>
      {label && <p className="text-sm font-semibold text-gray-700 mb-3">{label}</p>}
      <div className="grid grid-cols-2 gap-3">
        {/* Region */}
        <div className="col-span-2">
          <label className={labelClass}>Region</label>
          <select
            value={regionCode}
            onChange={(e) => handleRegionChange(e.target.value)}
            className={inputClass}
          >
            <option value="">Pumili ng region...</option>
            {regions.map(r => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Province (hidden for NCR) */}
        {!isNCR && regionCode && (
          <div className="col-span-2">
            <label className={labelClass}>Province</label>
            <select
              value={provinceCode}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className={inputClass}
              disabled={loadingProvinces}
            >
              <option value="">{loadingProvinces ? 'Naglo-load...' : 'Pumili ng probinsya...'}</option>
              {provinces.map(p => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* City / Municipality */}
        <div className="col-span-2">
          <label className={labelClass}>City / Municipality</label>
          <select
            value={value.city}
            onChange={(e) => handleCityChange(e.target.value)}
            className={inputClass}
            disabled={loadingCities || (!isNCR && !provinceCode)}
          >
            <option value="">
              {loadingCities ? 'Naglo-load...' : 'Pumili ng lungsod/munisipyo...'}
            </option>
            {cities.map(c => (
              <option key={c.code} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Barangay */}
        <div className="col-span-2">
          <label className={labelClass}>Barangay</label>
          {hasBrgyList && !useCustomBrgy ? (
            <select
              value={value.barangay}
              onChange={(e) => handleBarangayChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Pumili ng barangay...</option>
              {barangays.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.barangay}
              onChange={(e) => handleBarangayChange(e.target.value)}
              placeholder={loadingBarangays ? 'Naglo-load...' : 'I-type ang barangay'}
              required
              className={inputClass}
            />
          )}
          {hasBrgyList && (
            <button
              type="button"
              onClick={() => {
                setUseCustomBrgy(!useCustomBrgy);
                onChange({ ...value, barangay: '' });
              }}
              className="text-xs text-brand-600 mt-1 hover:underline"
            >
              {useCustomBrgy ? 'Piliin mula sa listahan' : 'Hindi nasa listahan? I-type na lang'}
            </button>
          )}
        </div>

        {/* District */}
        <div className="col-span-2">
          <label className={labelClass}>District (opsyonal)</label>
          <input
            type="text"
            value={value.district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            placeholder="Hal. District 1"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
