// @ts-nocheck
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DeliveryMapProps {
  storeCoords: { lat: number; lng: number } | null;
  deliveryCoords: { lat: number; lng: number } | null;
  onPinDrop: (lat: number, lng: number) => void;
  storeName?: string;
}

export function DeliveryMap({ storeCoords, deliveryCoords, onPinDrop, storeName }: DeliveryMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  // Custom icons
  const storeIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="background:#16a34a;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">🏪</span></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  const deliveryIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="background:#2563eb;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">📍</span></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = storeCoords || { lat: 7.0907, lng: 125.6128 }; // Default: Davao City
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onPinDrop(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    // Fix tile rendering after mount
    const resizeTimer = window.setTimeout(() => {
      if (mapRef.current === map) map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when coords change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Store marker
    if (storeCoords) {
      if (storeMarkerRef.current) {
        storeMarkerRef.current.setLatLng([storeCoords.lat, storeCoords.lng]);
      } else {
        storeMarkerRef.current = L.marker([storeCoords.lat, storeCoords.lng], { icon: storeIcon })
          .addTo(map)
          .bindPopup(storeName || 'Store');
      }
    }

    // Delivery marker
    if (deliveryCoords) {
      if (deliveryMarkerRef.current) {
        deliveryMarkerRef.current.setLatLng([deliveryCoords.lat, deliveryCoords.lng]);
      } else {
        deliveryMarkerRef.current = L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon: deliveryIcon })
          .addTo(map)
          .bindPopup('Delivery Location');
      }
    }

    // Draw line between store and delivery
    if (storeCoords && deliveryCoords) {
      if (lineRef.current) {
        lineRef.current.setLatLngs([
          [storeCoords.lat, storeCoords.lng],
          [deliveryCoords.lat, deliveryCoords.lng],
        ]);
      } else {
        lineRef.current = L.polyline(
          [[storeCoords.lat, storeCoords.lng], [deliveryCoords.lat, deliveryCoords.lng]],
          { color: '#2563eb', weight: 3, opacity: 0.6, dashArray: '8, 8' }
        ).addTo(map);
      }

      // Fit bounds to show both markers
      const bounds = L.latLngBounds(
        [storeCoords.lat, storeCoords.lng],
        [deliveryCoords.lat, deliveryCoords.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (storeCoords) {
      map.setView([storeCoords.lat, storeCoords.lng], 14);
    }
  }, [storeCoords, deliveryCoords, storeName]);

  return (
    <div
      ref={containerRef}
      className="w-full h-56 rounded-xl overflow-hidden border border-gray-200 z-0"
      style={{ touchAction: 'none' }}
    />
  );
}
