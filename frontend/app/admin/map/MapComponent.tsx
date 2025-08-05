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
  const previousPositionsRef = useRef<Map<string, GPSPosition>>(new Map());

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

      // Check if this is a new or updated position
      const previousPosition = previousPositionsRef.current.get(position.tracker_name);
      const isNewPosition = !previousPosition;
      const isUpdatedPosition = previousPosition &&
        (previousPosition.latitude !== position.latitude ||
         previousPosition.longitude !== position.longitude ||
         previousPosition.timestamp !== position.timestamp);

      // Determine status and color
      const now = new Date();
      const positionTime = new Date(position.timestamp);
      const minutesAgo = (now.getTime() - positionTime.getTime()) / (1000 * 60);

      let iconColor = '#6b7280'; // gray for old
      let statusText = 'Old';

      if (minutesAgo < 2) {
        iconColor = '#10b981'; // green for very recent
        statusText = 'Live';
      } else if (minutesAgo < 10) {
        iconColor = '#3b82f6'; // blue for recent
        statusText = 'Recent';
      } else if (minutesAgo < 30) {
        iconColor = '#f59e0b'; // orange for older
        statusText = 'Stale';
      }

      // Override color if unmapped
      if (!position.pride_boat_id) {
        iconColor = '#ef4444'; // red for unmapped
      }

      const iconHtml = `
        <div style="
          background-color: ${iconColor};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: white;
          font-weight: bold;
          transition: all 0.3s ease;
        ">
          ${position.pride_boat_id || '?'}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: `custom-marker ${(isNewPosition || isUpdatedPosition) ? 'pulse' : ''}`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });

      // Create popup content with enhanced information
      const popupContent = `
        <div style="min-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background-color: ${iconColor};
              border: 2px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            "></div>
            <h3 style="margin: 0; color: #1f2937; font-weight: bold; font-size: 16px;">
              ${position.boat_name || position.tracker_name}
            </h3>
            <span style="
              background-color: ${iconColor};
              color: white;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
            ">${statusText}</span>
          </div>

          ${position.organisation ? `
            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px; font-style: italic;">
              ${position.organisation}
            </p>
          ` : ''}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 12px;">
            <div style="background: #f3f4f6; padding: 6px; border-radius: 4px;">
              <div style="color: #6b7280; font-size: 10px;">LATITUDE</div>
              <div style="font-weight: bold; color: #1f2937;">${lat.toFixed(6)}</div>
            </div>
            <div style="background: #f3f4f6; padding: 6px; border-radius: 4px;">
              <div style="color: #6b7280; font-size: 10px;">LONGITUDE</div>
              <div style="font-weight: bold; color: #1f2937;">${lng.toFixed(6)}</div>
            </div>
            <div style="background: #f3f4f6; padding: 6px; border-radius: 4px;">
              <div style="color: #6b7280; font-size: 10px;">SPEED</div>
              <div style="font-weight: bold; color: #1f2937;">${position.speed ? `${Math.round(position.speed)} km/h` : 'Unknown'}</div>
            </div>
            <div style="background: #f3f4f6; padding: 6px; border-radius: 4px;">
              <div style="color: #6b7280; font-size: 10px;">HEADING</div>
              <div style="font-weight: bold; color: #1f2937;">${position.heading ? `${position.heading}°` : 'Unknown'}</div>
            </div>
          </div>

          <div style="padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 11px; color: #6b7280; margin-bottom: 12px;">
            <div style="margin-bottom: 4px;"><strong>Tracker ID:</strong> ${position.tracker_name}</div>
            <div style="margin-bottom: 4px;"><strong>Last Update:</strong> ${new Date(position.timestamp).toLocaleString('nl-NL')}</div>
            <div style="margin-bottom: 4px;"><strong>Data Age:</strong> ${Math.round(minutesAgo)} minutes ago</div>
            ${position.pride_boat_id ? `<div><strong>Pride Boot:</strong> #${position.pride_boat_id}</div>` : '<div style="color: #ef4444;"><strong>Status:</strong> Unmapped Device</div>'}
          </div>

          <div style="display: flex; gap: 8px;">
            <a href="https://www.google.com/maps?q=${lat},${lng}&z=15" target="_blank"
               style="
                 flex: 1;
                 background: #3b82f6;
                 color: white;
                 text-decoration: none;
                 padding: 6px 12px;
                 border-radius: 4px;
                 font-size: 12px;
                 text-align: center;
                 font-weight: bold;
               ">
              📍 Google Maps
            </a>
            <div style="
              flex: 1;
              background: #10b981;
              color: white;
              padding: 6px 12px;
              border-radius: 4px;
              font-size: 12px;
              text-align: center;
              font-weight: bold;
            ">
              🚤 ${position.pride_boat_id ? `Boot ${position.pride_boat_id}` : 'Unmapped'}
            </div>
          </div>
        </div>
      `;

      // Add marker to map
      const marker = L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popupContent)
        .addTo(markersRef.current!);

      // Add heading indicator if available
      if (position.heading !== null && position.heading !== undefined) {
        const headingLength = 0.0015; // Longer line for better visibility
        const headingLine = L.polyline([
          [lat, lng],
          [
            lat + headingLength * Math.cos((position.heading - 90) * Math.PI / 180),
            lng + headingLength * Math.sin((position.heading - 90) * Math.PI / 180)
          ]
        ], {
          color: iconColor,
          weight: 4,
          opacity: 0.8,
          dashArray: '5, 5'
        }).addTo(markersRef.current!);
      }

      // Store current position for next update comparison
      previousPositionsRef.current.set(position.tracker_name, position);
    });

    // Fit map to show all markers if there are any (only on first load or when switching modes)
    if (positions.length > 0 && markersRef.current) {
      const layers = markersRef.current.getLayers();
      if (layers.length > 0) {
        const group = L.featureGroup(layers);
        if (group.getBounds().isValid()) {
          // Only auto-fit if we don't have previous positions (first load)
          if (previousPositionsRef.current.size === 0) {
            mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
          }
        }
      }
    }
  }, [positions]);

  return (
    <>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
        .custom-marker {
          animation: none;
        }
        .custom-marker.pulse {
          animation: pulse 2s ease-in-out 3;
        }
      `}</style>
      <div
        ref={mapContainerRef}
        style={{ height: '100%', width: '100%', minHeight: '384px' }}
        className="rounded-lg"
      />
    </>
  );
}
