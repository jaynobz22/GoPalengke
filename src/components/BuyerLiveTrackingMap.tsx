import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Bike, Timer, MapPin, Loader2, Route as RouteIcon, Clock } from 'lucide-react';
import { fetchRoute, haversineKm, type Coords, type RouteResult } from '@/lib/deliveryFee';

interface BuyerLiveTrackingMapProps {
  riderLat: number;
  riderLng: number;
  riderName: string;
  storeCoords: Coords | null;
  deliveryCoords: Coords | null;
  deliveryAddress: string;
  pickedUpAt: string | null;
  sameCity: boolean;
}

const riderIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:#2563eb;width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="font-size:16px;">🛵</span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const homeIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:#ea580c;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">🏠</span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

export function BuyerLiveTrackingMap({
  riderLat,
  riderLng,
  riderName,
  storeCoords,
  deliveryCoords,
  deliveryAddress,
  pickedUpAt,
  sameCity,
}: BuyerLiveTrackingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const riderPos: Coords = { lat: riderLat, lng: riderLng };
  const destination = deliveryCoords;

  // Timer for elapsed time
  useEffect(() => {
    if (!pickedUpAt) return;
    const interval = setInterval(() => {
      const pickedAt = new Date(pickedUpAt).getTime();
      setElapsedSeconds(Math.floor((Date.now() - pickedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [pickedUpAt]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = destination || riderPos;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
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

  // Fetch route when rider position or destination changes
  useEffect(() => {
    if (!destination) return;
    let cancelled = false;
    setLoadingRoute(true);
    fetchRoute(riderPos, destination).then(result => {
      if (!cancelled) {
        setRoute(result);
        setLoadingRoute(false);
      }
    });
    return () => { cancelled = true; };
  }, [riderLat, riderLng, destination?.lat, destination?.lng]);

  // Update markers and route on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Rider marker
    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([riderLat, riderLng]);
    } else {
      riderMarkerRef.current = L.marker([riderLat, riderLng], { icon: riderIcon })
        .addTo(map)
        .bindPopup(`${riderName} (Rider)`);
    }

    // Accuracy circle
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([riderLat, riderLng]);
    } else {
      accuracyCircleRef.current = L.circle([riderLat, riderLng], {
        radius: 50,
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map);
    }

    // Destination marker
    if (destination) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      } else {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: homeIcon })
          .addTo(map)
          .bindPopup('Drop-off location');
      }
    }
  }, [riderLat, riderLng, destination?.lat, destination?.lng]);

  // Draw route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) return;

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    routeLineRef.current = L.polyline(route.coordinates, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.8,
      dashArray: '10, 8',
    }).addTo(map);

    if (route.coordinates.length > 0) {
      const bounds = L.latLngBounds(route.coordinates);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [route]);

  const estimatedTotalSeconds = sameCity ? 15 * 60 : 30 * 60;
  const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const isOverdue = elapsedSeconds > estimatedTotalSeconds;

  const straightLineKm = destination ? haversineKm(riderPos, destination) : 0;
  const displayDistance = route?.distanceKm ?? straightLineKm;

  return (
    <div className="bg-white rounded-2xl border border-blue-200 p-4 mb-3">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Navigation size={18} className="text-blue-600" /> Live Location ng Rider
      </h3>

      {/* Leaflet Map */}
      <div
        ref={containerRef}
        className="w-full h-56 rounded-xl overflow-hidden border border-gray-200 mb-3 z-0"
        style={{ touchAction: 'none' }}
      />

      {/* Loading state */}
      {loadingRoute && (
        <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
          <Loader2 size={16} className="animate-spin" /> Kinakalkula ang ruta ng rider...
        </div>
      )}

      {/* Route stats */}
      {route && !loadingRoute && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 rounded-xl p-2.5 text-center">
            <RouteIcon size={14} className="text-blue-600 mx-auto mb-0.5" />
            <p className="text-xs text-gray-400">Distansya</p>
            <p className="font-bold text-gray-800 text-sm">{displayDistance} km</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-2.5 text-center">
            <Clock size={14} className="text-blue-600 mx-auto mb-0.5" />
            <p className="text-xs text-gray-400">ETA ng Rider</p>
            <p className="font-bold text-gray-800 text-sm">{route.durationMin} min</p>
          </div>
        </div>
      )}

      {/* ETA Countdown */}
      <div className={`p-3 rounded-xl flex items-center gap-3 mb-3 ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-500' : 'bg-blue-500'}`}>
          <Timer size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-blue-500'}`}>
            {isOverdue ? 'Lampas sa estimated time' : 'Tinatayang oras ng pagdating'}
          </p>
          <p className={`font-bold text-lg ${isOverdue ? 'text-red-600' : 'text-blue-700'}`}>
            {isOverdue
              ? `+${Math.floor((elapsedSeconds - estimatedTotalSeconds) / 60)}m`
              : `${remainingMin}m ${remainingSec}s`}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Rider name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike size={16} className="text-blue-500" />
          <span className="text-sm text-gray-600">{riderName}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <MapPin size={12} /> {deliveryAddress}
        </div>
      </div>
    </div>
  );
}
