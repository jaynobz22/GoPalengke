import { useState, useEffect } from 'react';
import { REGIONS_LIST, getRegionCities, getCityBarangays } from '@/lib/philippineLocations';

export interface LocationData {
  barangay: string;
  district: string;
  city: string;
  region: string;
}

interface Props {
  value: LocationData;
  onChange: (data: LocationData) => void;
  label?: string;
  compact?: boolean;
}

export function LocationSelector({ value, onChange, label, compact }: Props) {
  const [regionCode, setRegionCode] = useState(value.region || 'NCR');
  const [city, setCity] = useState(value.city || '');
  const [barangay, setBarangay] = useState(value.barangay || '');
  const [district, setDistrict] = useState(value.district || '');
  const [useCustomBrgy, setUseCustomBrgy] = useState(false);

  const cities = getRegionCities(regionCode);
  const barangays = getCityBarangays(regionCode, city);
  const hasBrgyList = barangays.length > 0;

  useEffect(() => {
    if (!value.region) return;
    setRegionCode(value.region);
    setCity(value.city || '');
    setBarangay(value.barangay || '');
    setDistrict(value.district || '');
    const region = REGIONS_LIST.find(r => r.code === value.region);
    if (region) {
      const cityInfo = region.cities.find(c => c.name === value.city);
      if (cityInfo && cityInfo.barangays.length === 0) setUseCustomBrgy(true);
    }
  }, [value.region, value.city, value.barangay, value.district]);

  function handleRegionChange(code: string) {
    setRegionCode(code);
    setCity('');
    setBarangay('');
    setUseCustomBrgy(false);
    onChange({ ...value, region: code, city: '', barangay: '' });
  }

  function handleCityChange(c: string) {
    setCity(c);
    setBarangay('');
    const brgys = getCityBarangays(regionCode, c);
    setUseCustomBrgy(brgys.length === 0);
    onChange({ ...value, city: c, barangay: '' });
  }

  function handleBarangayChange(b: string) {
    setBarangay(b);
    onChange({ ...value, barangay: b });
  }

  function handleDistrictChange(d: string) {
    setDistrict(d);
    onChange({ ...value, district: d });
  }

  const inputClass = compact
    ? 'w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm'
    : 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition text-sm';
  const labelClass = compact
    ? 'text-xs font-medium text-gray-500 mb-1 block'
    : 'text-sm font-medium text-gray-600 mb-1 block';

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
            {REGIONS_LIST.map(r => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* City */}
        <div className="col-span-2">
          <label className={labelClass}>City / Municipality</label>
          <select
            value={city}
            onChange={(e) => handleCityChange(e.target.value)}
            className={inputClass}
          >
            <option value="">Pumili ng lungsod...</option>
            {cities.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Barangay */}
        <div className="col-span-2">
          <label className={labelClass}>Barangay</label>
          {hasBrgyList && !useCustomBrgy ? (
            <select
              value={barangay}
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
              value={barangay}
              onChange={(e) => handleBarangayChange(e.target.value)}
              placeholder="I-type ang barangay"
              required
              className={inputClass}
            />
          )}
          {hasBrgyList && (
            <button
              type="button"
              onClick={() => {
                setUseCustomBrgy(!useCustomBrgy);
                setBarangay('');
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
            value={district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            placeholder="Hal. District 1"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
