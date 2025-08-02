'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, RefreshCw, Clock, Navigation } from 'lucide-react';

interface GPSPosition {
  tracker_name: string;
  kpn_tracker_id: number;
  pride_boat_id: number | null;
  parade_position: number | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string;
  received_at: string;
  boat_name: string | null;
  organisation: string | null;
  raw_data: any;
}

export default function LiveMapPage() {
  const [positions, setPositions] = useState<GPSPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchGPSPositions = async () => {
    try {
      console.log('🔄 Fetching GPS positions...');
      // Use Next.js API route proxy instead of direct backend call
      const response = await fetch('/api/webhooks/gps-positions');
      console.log('📡 Response received:', response.status);

      const data = await response.json();
      console.log('📊 Data parsed:', { success: data.success, count: data.count, dataLength: data.data?.length });

      if (data.success && data.data) {
        setPositions(data.data);
        setLastUpdate(new Date().toLocaleTimeString());
        console.log('✅ GPS positions updated:', data.data.length);
      } else {
        console.warn('⚠️ No GPS data received or success=false');
      }
    } catch (error) {
      console.error('❌ Error fetching GPS positions:', error);
    } finally {
      setLoading(false);
      console.log('🏁 Loading state set to false');
    }
  };

  useEffect(() => {
    fetchGPSPositions();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchGPSPositions, 10000); // Refresh every 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('nl-NL');
  };

  const getStatusColor = (timestamp: string) => {
    const now = new Date();
    const positionTime = new Date(timestamp);
    const minutesAgo = (now.getTime() - positionTime.getTime()) / (1000 * 60);
    
    if (minutesAgo < 5) return 'bg-green-500';
    if (minutesAgo < 15) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getGoogleMapsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}&z=15`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🗺️ Live GPS Tracking
            </h1>
            <p className="text-gray-400">
              Real-time GPS positions van alle Pride boten en trackers (Debug Mode)
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              onClick={fetchGPSPositions}
              disabled={loading}
              variant="outline"
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "default" : "outline"}
              className={autoRefresh ? "bg-green-600 hover:bg-green-700" : "bg-gray-800 border-gray-600 text-white hover:bg-gray-700"}
            >
              {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Trackers</p>
                  <p className="text-2xl font-bold text-white">{positions.length}</p>
                </div>
                <MapPin className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Mapped Boats</p>
                  <p className="text-2xl font-bold text-white">
                    {positions.filter(p => p.pride_boat_id).length}
                  </p>
                </div>
                <Navigation className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Unmapped Devices</p>
                  <p className="text-2xl font-bold text-white">
                    {positions.filter(p => !p.pride_boat_id).length}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Last Update</p>
                  <p className="text-sm font-medium text-white">{lastUpdate || 'Never'}</p>
                </div>
                <Clock className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Placeholder */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Amsterdam Pride Route Map</CardTitle>
            <CardDescription className="text-gray-400">
              Interactive map met live GPS posities (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Interactive Map</p>
                <p className="text-gray-500 text-sm">Leaflet/OpenStreetMap integration coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GPS Positions List */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Live GPS Positions</CardTitle>
            <CardDescription className="text-gray-400">
              Laatste bekende posities van alle trackers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-400">Loading GPS positions...</span>
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No GPS positions found</p>
                <p className="text-gray-500 text-sm">Send some test webhooks to see data here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {positions.map((position, index) => (
                  <div
                    key={`${position.tracker_name}-${index}`}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(position.timestamp)}`} />
                        <div>
                          <h3 className="font-semibold text-white">
                            {position.boat_name || position.tracker_name}
                          </h3>
                          {position.organisation && (
                            <p className="text-sm text-gray-400">{position.organisation}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {position.pride_boat_id ? (
                          <Badge variant="default" className="bg-green-600">
                            Boot {position.pride_boat_id}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-600">
                            Unmapped
                          </Badge>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
                          onClick={() => window.open(getGoogleMapsUrl(position.latitude, position.longitude), '_blank')}
                        >
                          <MapPin className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Latitude</p>
                        <p className="text-white font-mono">{position.latitude.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Longitude</p>
                        <p className="text-white font-mono">{position.longitude.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Speed</p>
                        <p className="text-white">{position.speed ? `${position.speed} km/h` : 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Last Update</p>
                        <p className="text-white">{formatTimestamp(position.timestamp)}</p>
                      </div>
                    </div>
                    
                    {position.kpn_tracker_id && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <p className="text-xs text-gray-400">
                          Tracker ID: {position.kpn_tracker_id} | 
                          Received: {formatTimestamp(position.received_at)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
