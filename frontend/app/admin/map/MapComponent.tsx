'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GPSPosition {
  tracker_name: string;
  kpn_tracker_id: number;
  pride_boat_id: number | null;
  parade_position: number | null;
  latitude: number | string;
  longitude: number | string;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string;
  received_at: string;
  boat_name: string | null;
  organisation: string | null;
  raw_data: any;
}

interface MapComponentProps {
  positions: GPSPosition[];
}

export default function MapComponent({ positions }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([52.3676, 4.9041], 13);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);

      // Initialize markers layer
      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    // Add markers for each position
    positions.forEach((position) => {
      const lat = parseFloat(position.latitude.toString());
      const lng = parseFloat(position.longitude.toString());

      if (isNaN(lat) || isNaN(lng)) return;

      // Create custom icon based on boat status
      const iconColor = position.pride_boat_id ? '#10b981' : '#f59e0b'; // green for mapped boats, orange for unmapped
      const iconHtml = `
        <div style="
          background-color: ${iconColor};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: white;
          font-weight: bold;
        ">
          ${position.pride_boat_id || '?'}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      });

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #1f2937; font-weight: bold;">
            ${position.boat_name || position.tracker_name}
          </h3>
          ${position.organisation ? `<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">${position.organisation}</p>` : ''}
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div>
              <strong>Lat:</strong> ${lat.toFixed(6)}
            </div>
            <div>
              <strong>Lng:</strong> ${lng.toFixed(6)}
            </div>
            <div>
              <strong>Speed:</strong> ${position.speed ? `${position.speed} km/h` : 'Unknown'}
            </div>
            <div>
              <strong>Heading:</strong> ${position.heading ? `${position.heading}°` : 'Unknown'}
            </div>
          </div>
          
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;">
            <div><strong>Tracker:</strong> ${position.tracker_name}</div>
            <div><strong>Time:</strong> ${new Date(position.timestamp).toLocaleString('nl-NL')}</div>
            ${position.pride_boat_id ? `<div><strong>Boot ID:</strong> ${position.pride_boat_id}</div>` : ''}
          </div>
          
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps?q=${lat},${lng}&z=15" target="_blank" 
               style="color: #3b82f6; text-decoration: none; font-size: 12px;">
              📍 Open in Google Maps
            </a>
          </div>
        </div>
      `;

      // Add marker to map
      const marker = L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popupContent)
        .addTo(markersRef.current!);

      // Add heading indicator if available
      if (position.heading !== null && position.heading !== undefined) {
        const headingLine = L.polyline([
          [lat, lng],
          [
            lat + 0.001 * Math.cos((position.heading - 90) * Math.PI / 180),
            lng + 0.001 * Math.sin((position.heading - 90) * Math.PI / 180)
          ]
        ], {
          color: iconColor,
          weight: 3,
          opacity: 0.7
        }).addTo(markersRef.current!);
      }
    });

    // Fit map to show all markers if there are any
    if (positions.length > 0 && markersRef.current) {
      const layers = markersRef.current.getLayers();
      if (layers.length > 0) {
        const group = L.featureGroup(layers);
        if (group.getBounds().isValid()) {
          mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
      }
    }
  }, [positions]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ height: '100%', width: '100%', minHeight: '384px' }}
      className="rounded-lg"
    />
  );
}
