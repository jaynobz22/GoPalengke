// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Bike, MapPin, Navigation, WifiOff } from 'lucide-react';
import { haversineKm, type Coords } from '../lib/deliveryFee';

const URBAN_SPEED_KMH = 30;
const TRAFFIC_FACTOR = 1.15;
const ARRIVAL_THRESHOLD_M = 50;
const STALE_TIMEOUT_MS = 60_000;
const TICK_MS = 30_000;

interface LiveETATimerProps {
  riderCoords: Coords | null;
  buyerCoords: Coords | null;
  riderName?: string;
  variant: 'buyer' | 'rider';
  gpsActive?: boolean;
}

export function LiveETATimer({ riderCoords, buyerCoords, riderName, variant, gpsActive }: LiveETATimerProps) {
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [arrived, setArrived] = useState(false);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!riderCoords || !buyerCoords) return;

    const km = haversineKm(riderCoords, buyerCoords);
    const travelMin = (km / URBAN_SPEED_KMH) * 60 * TRAFFIC_FACTOR;
    setDistanceKm(km);
    setEtaMinutes(Math.max(1, Math.round(travelMin)));
    setArrived(km * 1000 <= ARRIVAL_THRESHOLD_M);
    lastUpdateRef.current = Date.now();
    setIsStale(false);
  }, [riderCoords, buyerCoords]);

  useEffect(() => {
    const interval = setInterval(() => {
      const sinceUpdate = Date.now() - lastUpdateRef.current;
      if (sinceUpdate > STALE_TIMEOUT_MS) {
        setIsStale(true);
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  if (!riderCoords || !buyerCoords) return null;

  const isBuyer = variant === 'buyer';
  const arrivedMode = arrived && !isStale;

  // Progress: 0% at 10km+, 100% at 0km (capped)
  const progressPercent = distanceKm != null
    ? Math.min(100, Math.max(0, 100 - (distanceKm / 5) * 100))
    : 0;

  return (
    <div className={`rounded-2xl border p-4 mb-3 transition-all duration-500 ${
      arrivedMode
        ? 'bg-green-50 border-green-300'
        : isStale
          ? 'bg-amber-50 border-amber-200'
          : isBuyer
            ? 'bg-gradient-to-br from-blue-50 to-brand-50 border-blue-200'
            : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
            arrivedMode ? 'bg-green-500' : isStale ? 'bg-amber-500' : isBuyer ? 'bg-blue-500' : 'bg-emerald-500'
          } ${arrivedMode ? 'animate-pulse' : ''}`}>
            {arrivedMode
              ? <MapPin size={18} className="text-white" />
              : isStale
                ? <WifiOff size={18} className="text-white" />
                : <Bike size={18} className="text-white" />}
          </div>
          <div>
            <p className={`text-xs font-medium ${
              arrivedMode ? 'text-green-600' : isStale ? 'text-amber-600' : isBuyer ? 'text-blue-600' : 'text-emerald-600'
            }`}>
              {arrivedMode
                ? 'Arrived / Meeting Buyer Now'
                : isStale
                  ? 'Calculating updated ETA...'
                  : isBuyer
                    ? 'Live ETA'
                    : 'Target Arrival'}
            </p>
            <p className={`font-bold text-xl ${
              arrivedMode ? 'text-green-700' : isStale ? 'text-amber-700' : isBuyer ? 'text-blue-700' : 'text-emerald-700'
            }`}>
              {arrivedMode
                ? 'Arrived!'
                : isStale
                  ? '—'
                  : `Arriving in ${etaMinutes} mins`}
            </p>
          </div>
        </div>
        {gpsActive && !isStale && !arrivedMode && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            GPS Live
          </div>
        )}
      </div>

      {/* Distance subtitle */}
      {!arrivedMode && !isStale && distanceKm != null && (
        <p className={`text-sm mb-3 ${isBuyer ? 'text-blue-600' : 'text-emerald-600'}`}>
          {isBuyer
            ? `Rider is currently ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away from your location`
            : `You are ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} from the buyer`}
        </p>
      )}

      {/* Stale message */}
      {isStale && !arrivedMode && (
        <p className="text-sm text-amber-600 mb-3 flex items-center gap-1.5">
          <WifiOff size={14} />
          GPS signal lost — waiting for rider location to refresh...
        </p>
      )}

      {/* Progress bar */}
      {!isStale && (
        <div className="relative h-2.5 rounded-full bg-white/60 overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out ${
              arrivedMode ? 'bg-green-500' : isBuyer ? 'bg-blue-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${arrivedMode ? 100 : progressPercent}%` }}
          />
          {/* Animated rider icon */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
            style={{ left: `calc(${arrivedMode ? 100 : progressPercent}% - 12px)` }}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
              arrivedMode ? 'bg-green-500' : isBuyer ? 'bg-blue-600' : 'bg-emerald-600'
            }`}>
              <Navigation size={12} className="text-white" />
            </div>
          </div>
          {/* Destination flag */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <div className="w-6 h-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
              <MapPin size={12} className="text-gray-500" />
            </div>
          </div>
        </div>
      )}

      {/* Arrived banner */}
      {arrivedMode && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 bg-green-100 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-green-700">
              {isBuyer
                ? `${riderName || 'Rider'} has arrived at your location!`
                : 'You have arrived at the buyer location!'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
