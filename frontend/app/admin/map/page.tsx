'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, RefreshCw, Clock, Navigation, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import map component to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-700 rounded-lg flex items-center justify-center">
    <div className="text-center">
      <MapPin className="w-16 h-16 text-gray-500 mx-auto mb-4" />
      <p className="text-gray-400 text-lg">Loading Map...</p>
    </div>
  </div>
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

export default function LiveMapPage() {
  const [positions, setPositions] = useState<GPSPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Timeline functionality
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [currentTime, setCurrentTime] = useState('12:00');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filtered positions for current time
  const [filteredPositions, setFilteredPositions] = useState<GPSPosition[]>([]);

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
    if (autoRefresh && isLiveMode) {
      interval = setInterval(fetchGPSPositions, 10000); // Refresh every 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, isLiveMode]);

  // Filter positions when time changes
  useEffect(() => {
    filterPositionsByTime(currentTime);
  }, [currentTime, positions, isLiveMode, selectedDate]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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

  // Timeline functions
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const filterPositionsByTime = (targetTime: string) => {
    if (isLiveMode) {
      setFilteredPositions(positions);
      return;
    }

    const targetDateTime = new Date(`${selectedDate}T${targetTime}:00`);
    const targetTimestamp = targetDateTime.getTime();

    // Group positions by tracker and find closest to target time
    const trackerPositions = new Map<string, GPSPosition>();

    positions.forEach(position => {
      const positionTime = new Date(position.timestamp).getTime();
      const timeDiff = Math.abs(positionTime - targetTimestamp);

      // Only include positions within 4 hours of target time
      if (timeDiff <= 4 * 60 * 60 * 1000) {
        const existing = trackerPositions.get(position.tracker_name);
        if (!existing || Math.abs(new Date(existing.timestamp).getTime() - targetTimestamp) > timeDiff) {
          trackerPositions.set(position.tracker_name, position);
        }
      }
    });

    setFilteredPositions(Array.from(trackerPositions.values()));
  };

  const togglePlayback = () => {
    if (isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const currentMinutes = timeToMinutes(prev);
          const endMinutes = timeToMinutes(endTime);
          const nextMinutes = currentMinutes + playbackSpeed;

          if (nextMinutes >= endMinutes) {
            setIsPlaying(false);
            return endTime;
          }

          return minutesToTime(nextMinutes);
        });
      }, 1000);
    }
  };

  const resetToStart = () => {
    setCurrentTime(startTime);
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const jumpToEnd = () => {
    setCurrentTime(endTime);
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🗺️ GPS Tracking & Timeline
            </h1>
            <p className="text-gray-400">
              {isLiveMode ? 'Live GPS positions van alle Pride boten' : `Historical view: ${selectedDate} ${currentTime}`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => setIsLiveMode(!isLiveMode)}
              variant={isLiveMode ? "default" : "outline"}
              className={isLiveMode ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              {isLiveMode ? 'LIVE' : 'TIMELINE'}
            </Button>

            {isLiveMode && (
              <>
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
              </>
            )}
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
                  <p className="text-sm text-gray-400">Visible Now</p>
                  <p className="text-2xl font-bold text-white">{filteredPositions.length}</p>
                </div>
                <Navigation className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Mapped Boats</p>
                  <p className="text-2xl font-bold text-white">
                    {filteredPositions.filter(p => p.pride_boat_id).length}
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
                  <p className="text-sm text-gray-400">{isLiveMode ? 'Last Update' : 'Current Time'}</p>
                  <p className="text-sm font-medium text-white">{isLiveMode ? (lastUpdate || 'Never') : currentTime}</p>
                </div>
                <Clock className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Controls */}
        {!isLiveMode && (
          <Card className="bg-gray-800 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Timeline Controls</CardTitle>
              <CardDescription className="text-gray-400">
                Scrub through historical GPS data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date and Time Range */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={resetToStart}
                  variant="outline"
                  size="sm"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>

                <Button
                  onClick={togglePlayback}
                  variant={isPlaying ? "default" : "outline"}
                  size="sm"
                  className={isPlaying ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 border-gray-600 text-white hover:bg-gray-600"}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>

                <Button
                  onClick={jumpToEnd}
                  variant="outline"
                  size="sm"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-gray-400">Speed:</span>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                  </select>
                </div>
              </div>

              {/* Time Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{startTime}</span>
                  <span className="text-white font-medium">{currentTime}</span>
                  <span>{endTime}</span>
                </div>
                <input
                  type="range"
                  min={timeToMinutes(startTime)}
                  max={timeToMinutes(endTime)}
                  value={timeToMinutes(currentTime)}
                  onChange={(e) => setCurrentTime(minutesToTime(Number(e.target.value)))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interactive Map */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">
              Amsterdam Pride Route Map
              {!isLiveMode && (
                <Badge variant="secondary" className="ml-2 bg-blue-600">
                  {selectedDate} {currentTime}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {isLiveMode ? 'Live GPS positions' : 'Historical GPS positions'} - {filteredPositions.length} trackers visible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 rounded-lg overflow-hidden">
              <MapComponent positions={filteredPositions} />
            </div>
          </CardContent>
        </Card>

        {/* GPS Positions List */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              {isLiveMode ? 'Live GPS Positions' : 'Historical GPS Positions'}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {isLiveMode ? 'Laatste bekende posities van alle trackers' : `Posities op ${selectedDate} ${currentTime}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-400">Loading GPS positions...</span>
              </div>
            ) : filteredPositions.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No GPS positions found</p>
                <p className="text-gray-500 text-sm">
                  {isLiveMode ? 'Send some test webhooks to see data here' : 'Try adjusting the date/time or switch to LIVE mode'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPositions.map((position, index) => (
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
                        <p className="text-white font-mono">{parseFloat(position.latitude.toString()).toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Longitude</p>
                        <p className="text-white font-mono">{parseFloat(position.longitude.toString()).toFixed(6)}</p>
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
