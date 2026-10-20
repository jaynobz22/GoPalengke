import { useEffect, useId, useState } from 'react';
import { MapPin, Store, Sprout, Utensils, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sellerMarketOptions, type SellerCoordinates, type SellerLocationType } from '../lib/sellerLocation';

interface Props {
  city: string;
  region: string;
  sellerType: SellerLocationType;
  onTypeChange: (value: SellerLocationType) => void;
  palengkeName: string;
  onMarketChange: (value: string) => void;
  palengkeCustom: string;
  onCustomChange: (value: string) => void;
  farmType: string;
  onFarmChange: (value: string) => void;
}

export function SellerLocationFields(props: Props) {
  const id = useId();
  const [coords, setCoords] = useState<SellerCoordinates | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  useEffect(() => {
    if (props.sellerType !== 'palengke') return;
    let active = true;
    if (!navigator.geolocation) { setGpsState('unavailable'); return; }
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(position => {
      if (!active) return;
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setGpsState('ready');
    }, () => { if (active) setGpsState('unavailable'); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    return () => { active = false; };
  }, [props.sellerType]);

  const markets = sellerMarketOptions(props.city, props.region, coords);
  const nearby = markets.filter(m => m.distanceKm != null && m.distanceKm <= 15);
  const cityMarkets = markets.filter(m => !nearby.includes(m));
  const inputClass = 'w-full rounded-md border border-input bg-card px-3 py-3 text-sm text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const types = [
    { value: 'palengke' as const, label: 'May Pwesto sa Palengke', detail: 'Stall sa public market', icon: Store },
    { value: 'talipapa' as const, label: 'Talipapa / Lokal na Tindahan', detail: 'Karenderia, gulayan o tindahan sa labas ng palengke', icon: Utensils },
    { value: 'farm' as const, label: 'Farm / Bahay', detail: 'Sariling farm o fishpond', icon: Sprout },
  ];
  return <div className="space-y-3">
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">Saan ka nagbebenta?</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {types.map(({ value, label, detail, icon: Icon }) => <Button key={value} type="button"
          variant={props.sellerType === value ? 'secondary' : 'outline'} aria-pressed={props.sellerType === value}
          onClick={() => {
            props.onTypeChange(value);
            if (value !== 'farm') props.onFarmChange('');
            if (value !== 'palengke') { props.onMarketChange(''); props.onCustomChange(''); }
          }}
          className={`h-auto min-h-24 flex-col items-start whitespace-normal p-3 text-left ${props.sellerType === value ? 'border-2 border-primary' : 'border-2'}`}>
          <Icon aria-hidden="true" />
          <span className="font-semibold">{label}</span>
          <span className="text-xs font-normal text-muted-foreground">{detail}</span>
        </Button>)}
      </div>
    </fieldset>
    {props.sellerType === 'palengke' && <div className="space-y-2">
      <label htmlFor={`${id}-market`} className="block text-sm font-medium text-foreground">Pangalan ng Palengke</label>
      {gpsState === 'loading' && <p role="status" className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Hinahanap ang mga kalapit na palengke…</p>}
      {gpsState === 'unavailable' && <p role="status" className="text-xs text-muted-foreground">Hindi makuha ang GPS. Mga palengke sa {props.city || 'napiling lungsod'} ang nakalista.</p>}
      <select id={`${id}-market`} value={props.palengkeName} onChange={e => props.onMarketChange(e.target.value)} className={inputClass}>
        <option value="">Pumili ng palengke...</option>
        {nearby.length > 0 && <optgroup label="Malapit sa iyo (GPS)">{nearby.map(m => <option key={m.name} value={m.name}>{m.name} — ~{m.distanceKm?.toFixed(1)} km</option>)}</optgroup>}
        {cityMarkets.length > 0 && <optgroup label={`Mga palengke sa ${props.city || 'iyong lungsod'}`}>{cityMarkets.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}</optgroup>}
        {props.palengkeName && props.palengkeName !== '__custom__' && !markets.some(m => m.name === props.palengkeName) && <option value={props.palengkeName}>{props.palengkeName}</option>}
        <option value="__custom__">I-type ang pangalan ng palengke...</option>
      </select>
      {props.palengkeName !== '__custom__' && <Button type="button" variant="link" size="sm" className="h-auto whitespace-normal px-0 text-left" onClick={() => { props.onCustomChange(props.palengkeName); props.onMarketChange('__custom__'); }}><MapPin size={14} />Wala sa listahan? I-type ang pangalan</Button>}
      {props.palengkeName === '__custom__' && <><label htmlFor={`${id}-custom`} className="sr-only">Ilagay ang pangalan ng palengke</label><input id={`${id}-custom`} type="text" value={props.palengkeCustom} onChange={e => props.onCustomChange(e.target.value)} placeholder="Ilagay ang pangalan ng palengke" className={inputClass} /></>}
    </div>}
    {props.sellerType === 'farm' && <div className="space-y-2">
      <label htmlFor={`${id}-farm`} className="block text-sm font-medium text-foreground">Anong klaseng farm ang meron?</label>
      <select id={`${id}-farm`} value={props.farmType} onChange={e => props.onFarmChange(e.target.value)} required className={inputClass}>
        <option value="">Pumili...</option>
        <option value="vegetable_farm">Gulay / Pananim (Vegetable Farm)</option>
        <option value="fishpond">Fishpond / Fishery</option>
        <option value="poultry">Poultry (Alagang Manok / Itlog)</option>
        <option value="livestock">Livestock (Baboy, Baka, Kambing)</option>
        <option value="mixed">Halo-halo (Mixed Farm)</option>
      </select>
    </div>}
  </div>;
}