import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, Store as StoreIcon, Clock, Loader2, AlertCircle, Route as RouteIcon, DollarSign } from 'lucide-react';
import { haversineKm, computeTieredDeliveryFee, type Coords } from '@/lib/deliveryFee';

export type NavPhase = 'to_store' | 'to_buyer';

interface RiderNavigationMapProps {
  phase: NavPhase;
  storeCoords: Coords | null;
  storeName: string;
  buyerCoords: Coords | null;
  buyerName: string;
  onPhaseChange: (phase: NavPhase) => void;
  onEarningsUpdate?: (fee: number, distanceKm: number) => void;
  storeRegion?: string | null;
  storeCity?: string | null;
}

interface RouteData {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  instructions: TurnInstruction[];
}

interface TurnInstruction {
  text: string;
  distance: string;
  step: number;
}

const riderIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:#2563eb;width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="font-size:16px;">🛵</span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const storeIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:#16a34a;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">🏪</span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const buyerIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:#ea580c;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">🏠</span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

export function RiderNavigationMap({
  phase,
  storeCoords,
  storeName,
  buyerCoords,
  buyerName,
  onPhaseChange,
  onEarningsUpdate,
  storeRegion,
  storeCity,
}: RiderNavigationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [riderPos, setRiderPos] = useState<Coords | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'active' | 'error'>('idle');
  const [showInstructions, setShowInstructions] = useState(false);

  const onEarningsUpdateRef = useRef(onEarningsUpdate);
  onEarningsUpdateRef.current = onEarningsUpdate;

  const destination: Coords | null = phase === 'to_store' ? storeCoords : buyerCoords;
  const destLabel = phase === 'to_store' ? storeName : buyerName;
  const destIcon = phase === 'to_store' ? storeIcon : buyerIcon;

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const startCoords = destination || storeCoords || { lat: 7.0907, lng: 125.6128 };
    const map = L.map(containerRef.current, {
      center: [startCoords.lat, startCoords.lng],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Start GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    setGpsStatus('searching');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setRiderPos(coords);
        setGpsStatus('active');
      },
      () => { setGpsStatus('error'); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Fetch route from OSRM when rider position or destination changes
  const fetchRoute = useCallback(async (from: Coords, to: Coords) => {
    setLoadingRoute(true);
    setRouteError(null);
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`,
      );
      if (!res.ok) throw new Error('Route request failed');
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) throw new Error('No route found');

      const route = data.routes[0];
      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]],
      );

      const instructions: TurnInstruction[] = [];
      if (route.legs && route.legs[0]?.steps) {
        let stepNum = 1;
        for (const step of route.legs[0].steps) {
          const maneuver = step.maneuver;
          if (!maneuver || maneuver.type === 'depart' || maneuver.type === 'arrive') continue;
          const text = maneuver.modifier
            ? `${capitalize(maneuver.modifier)} sa ${step.name || 'next street'}`
            : maneuver.type === 'turn'
              ? `Mag-turn sa ${step.name || 'next street'}`
              : `I-tuloy sa ${step.name || 'next street'}`;
          instructions.push({
            text,
            distance: step.distance < 1000 ? `${Math.round(step.distance)}m` : `${(step.distance / 1000).toFixed(1)}km`,
            step: stepNum++,
          });
        }
      }

      const routeResult: RouteData = {
        coordinates,
        distanceKm: Math.round((route.distance / 1000) * 100) / 100,
        durationMin: Math.round(route.duration / 60),
        instructions,
      };
      setRouteData(routeResult);

      // Update earnings — only when heading to buyer (after pickup), based on actual route distance
      if (onEarningsUpdateRef.current && phase === 'to_buyer' && storeCoords && buyerCoords) {
        const tiered = computeTieredDeliveryFee(routeResult.distanceKm, 0, storeRegion, storeCity);
        onEarningsUpdateRef.current(tiered.total, routeResult.distanceKm);
      }
    } catch (err) {
      // Fallback: straight-line distance with haversine
      const distKm = haversineKm(from, to);
      const straightCoords: [number, number][] = [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ];
      const fallbackRoute: RouteData = {
        coordinates: straightCoords,
        distanceKm: Math.round(distKm * 100) / 100,
        durationMin: Math.round((distKm / 30) * 60),
        instructions: [],
      };
      setRouteData(fallbackRoute);
      setRouteError('Hindi available ang turn-by-turn routing. Straight-line distance lang ang ipinapakita.');
      if (onEarningsUpdateRef.current && phase === 'to_buyer' && storeCoords && buyerCoords) {
        const tiered = computeTieredDeliveryFee(distKm, 0, storeRegion, storeCity);
        onEarningsUpdateRef.current(tiered.total, Math.round(distKm * 100) / 100);
      }
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  // Update map markers and route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update destination marker
    if (destination) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
        destMarkerRef.current.setIcon(destIcon);
        destMarkerRef.current.bindPopup(destLabel);
      } else {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(destLabel);
      }
    }

    // Update rider marker
    if (riderPos) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([riderPos.lat, riderPos.lng]);
      } else {
        riderMarkerRef.current = L.marker([riderPos.lat, riderPos.lng], { icon: riderIcon })
          .addTo(map)
          .bindPopup('Ikaw');
      }

      // Accuracy circle
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([riderPos.lat, riderPos.lng]);
      } else {
        accuracyCircleRef.current = L.circle([riderPos.lat, riderPos.lng], {
          radius: 50,
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(map);
      }
    }

  }, [riderPos, destination, destIcon, destLabel]);

  // Throttle route re-fetching: only re-fetch if rider moved significantly
  const lastFetchPosRef = useRef<Coords | null>(null);
  useEffect(() => {
    if (!riderPos || !destination) return;
    const last = lastFetchPosRef.current;
    if (last && haversineKm(last, riderPos) < 0.05) return; // skip if moved < 50m
    lastFetchPosRef.current = riderPos;
    fetchRoute(riderPos, destination);
  }, [riderPos, destination, fetchRoute]);

  // Draw / update route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeData) return;

    // Clear old route
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    // Draw new route
    routeLineRef.current = L.polyline(routeData.coordinates, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.8,
    }).addTo(map);

    // Fit bounds to show route
    if (routeData.coordinates.length > 0) {
      const bounds = L.latLngBounds(routeData.coordinates);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [routeData]);

  // Clear route when phase changes
  useEffect(() => {
    setRouteData(null);
    const map = mapRef.current;
    if (map && routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
  }, [phase]);

  const liveDistanceKm = routeData?.distanceKm ?? 0;
  // Fee only computed during to_buyer phase (after pickup), based on actual route distance
  const liveFee = phase === 'to_buyer'
    ? computeTieredDeliveryFee(liveDistanceKm, 0, storeRegion, storeCity).total
    : 0;

  return (
    <div className="space-y-3">
      {/* Phase indicator */}
      <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-2.5 border border-blue-100">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${phase === 'to_store' ? 'bg-green-500' : 'bg-orange-500'}`}>
          {phase === 'to_store' ? <StoreIcon size={16} className="text-white" /> : <MapPin size={16} className="text-white" />}
        </div>
        <div className="flex-1">
          <p className="text-xs text-blue-600 font-medium">
            {phase === 'to_store' ? 'PHASE 1: Pupunta sa Store' : 'PHASE 2: Pupunta sa Buyer'}
          </p>
          <p className="text-sm font-bold text-gray-800">{destLabel}</p>
        </div>
        {gpsStatus === 'active' && (
          <div className="flex items-center gap-1 text-xs text-green-600 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            GPS
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="w-full h-72 rounded-2xl overflow-hidden border border-gray-200 z-0"
        style={{ touchAction: 'none' }}
      />

      {/* GPS status */}
      {gpsStatus === 'searching' && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 size={16} className="animate-spin" /> Hinahanap ang iyong lokasyon...
        </div>
      )}
      {gpsStatus === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={16} /> Hindi ma-access ang GPS. Paki-check ang location settings.
        </div>
      )}

      {/* Route info */}
      {loadingRoute && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Kinakalkula ang ruta...
        </div>
      )}

      {routeData && !loadingRoute && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <RouteIcon size={16} className="text-blue-600 mx-auto mb-1" />
              <p className="text-xs text-gray-400">{phase === 'to_store' ? 'Distansya sa Store' : 'Distansya sa Buyer'}</p>
              <p className="font-bold text-gray-800 text-sm">{liveDistanceKm} km</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <Clock size={16} className="text-blue-600 mx-auto mb-1" />
              <p className="text-xs text-gray-400">ETA</p>
              <p className="font-bold text-gray-800 text-sm">{routeData.durationMin} min</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <DollarSign size={16} className="text-green-600 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Kita</p>
              {phase === 'to_buyer' ? (
                <p className="font-bold text-green-600 text-sm">₱{liveFee.toFixed(0)}</p>
              ) : (
                <p className="font-bold text-gray-300 text-sm">—</p>
              )}
            </div>
          </div>

          {routeError && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{routeError}</span>
            </div>
          )}

          {/* Turn-by-turn instructions */}
          {routeData.instructions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <Navigation size={16} className="text-blue-600" />
                  <span className="font-semibold text-sm text-gray-800">Turn-by-turn Directions</span>
                </div>
                <span className="text-xs text-gray-400">{routeData.instructions.length} steps</span>
              </button>
              {showInstructions && (
                <div className="border-t border-gray-100 max-h-48 overflow-y-auto">
                  {routeData.instructions.map((inst, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-600">{inst.step}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{inst.text}</p>
                        <p className="text-xs text-gray-400">{inst.distance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Phase switch button */}
      {phase === 'to_store' && (
        <button
          onClick={() => {
            // Clear old route, switch to buyer phase
            setRouteData(null);
            if (routeLineRef.current && mapRef.current) {
              routeLineRef.current.remove();
              routeLineRef.current = null;
            }
            onPhaseChange('to_buyer');
          }}
          className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-green-600/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <StoreIcon size={20} /> Order Picked Up — Pupunta sa Buyer
        </button>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
