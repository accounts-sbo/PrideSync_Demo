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
  const [timelineMetadata, setTimelineMetadata] = useState<any>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
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

  const fetchTimelinePositions = async (targetTime: string) => {
    try {
      console.log('📅 Fetching timeline positions for:', targetTime);
      const targetDateTime = new Date(`${selectedDate}T${targetTime}:00`).toISOString();
      const response = await fetch(`/api/webhooks/gps-timeline/at-time?timestamp=${targetDateTime}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          console.log('✅ Timeline positions fetched:', data.data.length);
          return data.data;
        }
      }
      console.warn('⚠️ No timeline data received');
      return [];
    } catch (error) {
      console.error('❌ Error fetching timeline positions:', error);
      return [];
    }
  };

  const fetchTimelineMetadata = async () => {
    try {
      setTimelineLoading(true);
      console.log('📊 Fetching timeline metadata...');
      const response = await fetch('/api/webhooks/gps-timeline/metadata');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setTimelineMetadata(data.data);
          console.log('✅ Timeline metadata fetched:', data.data);

          // Auto-set date and time range based on available data
          if (data.data.earliestTimestamp && data.data.latestTimestamp) {
            const earliest = new Date(data.data.earliestTimestamp);
            const latest = new Date(data.data.latestTimestamp);

            // Set date to the latest date with data
            setSelectedDate(latest.toISOString().split('T')[0]);

            // Set time range based on actual data
            const earliestTime = earliest.toTimeString().slice(0, 5);
            const latestTime = latest.toTimeString().slice(0, 5);
            setStartTime(earliestTime);
            setEndTime(latestTime);
            setCurrentTime(latestTime); // Start at the latest time
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching timeline metadata:', error);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    fetchGPSPositions();
  }, []);

  // Fetch timeline metadata when switching to timeline mode
  useEffect(() => {
    if (!isLiveMode) {
      fetchTimelineMetadata();
    }
  }, [isLiveMode]);

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

  const getGoogleMapsUrl = (lat: number | string, lng: number | string) => {
    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
    return `https://www.google.com/maps?q=${latNum},${lngNum}&z=15`;
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

  const filterPositionsByTime = async (targetTime: string) => {
    if (isLiveMode) {
      setFilteredPositions(positions);
      return;
    }

    // Use timeline API for historical data
    const timelinePositions = await fetchTimelinePositions(targetTime);
    setFilteredPositions(timelinePositions);
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
      <style jsx>{`
        .timeline-slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          border: 3px solid white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .timeline-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          border: 3px solid white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .timeline-slider::-webkit-slider-track {
          height: 12px;
          border-radius: 6px;
        }
        .timeline-slider::-moz-range-track {
          height: 12px;
          border-radius: 6px;
          background: #374151;
        }
      `}</style>
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
              <CardTitle className="text-white flex items-center gap-2">
                Timeline Controls
                {timelineLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              </CardTitle>
              <CardDescription className="text-gray-400">
                {timelineMetadata ? (
                  <>
                    Scrub through historical GPS data • {timelineMetadata.totalPositions} positions • {timelineMetadata.trackers?.length || 0} trackers
                    {timelineMetadata.earliestTimestamp && timelineMetadata.latestTimestamp && (
                      <div className="mt-1 text-xs">
                        Data available: {new Date(timelineMetadata.earliestTimestamp).toLocaleString('nl-NL')} - {new Date(timelineMetadata.latestTimestamp).toLocaleString('nl-NL')}
                      </div>
                    )}
                  </>
                ) : (
                  'Loading timeline data...'
                )}
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
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <div className="text-gray-400">
                    <span className="block">{startTime}</span>
                    <span className="text-xs">Start</span>
                  </div>
                  <div className="text-center">
                    <span className="text-white font-bold text-lg">{currentTime}</span>
                    <div className="text-xs text-gray-400">Current Time</div>
                    {timelineMetadata && (
                      <div className="text-xs text-blue-400 mt-1">
                        {filteredPositions.length} trackers visible
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400 text-right">
                    <span className="block">{endTime}</span>
                    <span className="text-xs">End</span>
                  </div>
                </div>

                {/* Enhanced Slider */}
                <div className="relative">
                  <input
                    type="range"
                    min={timeToMinutes(startTime)}
                    max={timeToMinutes(endTime)}
                    value={timeToMinutes(currentTime)}
                    onChange={(e) => setCurrentTime(minutesToTime(Number(e.target.value)))}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer timeline-slider"
                    style={{
                      background: `linear-gradient(to right,
                        #3b82f6 0%,
                        #3b82f6 ${((timeToMinutes(currentTime) - timeToMinutes(startTime)) / (timeToMinutes(endTime) - timeToMinutes(startTime))) * 100}%,
                        #374151 ${((timeToMinutes(currentTime) - timeToMinutes(startTime)) / (timeToMinutes(endTime) - timeToMinutes(startTime))) * 100}%,
                        #374151 100%)`
                    }}
                  />

                  {/* Timeline markers */}
                  {timelineMetadata && timelineMetadata.trackers && (
                    <div className="absolute top-0 left-0 right-0 h-3 pointer-events-none">
                      {/* Add visual markers for data density */}
                      <div className="relative h-full">
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = Math.floor(timeToMinutes(startTime) / 60) + i;
                          const hourMinutes = hour * 60;
                          if (hourMinutes >= timeToMinutes(startTime) && hourMinutes <= timeToMinutes(endTime)) {
                            const position = ((hourMinutes - timeToMinutes(startTime)) / (timeToMinutes(endTime) - timeToMinutes(startTime))) * 100;
                            return (
                              <div
                                key={i}
                                className="absolute w-0.5 h-full bg-gray-500 opacity-30"
                                style={{ left: `${position}%` }}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick time jumps */}
                <div className="flex justify-center gap-2 mt-2">
                  <button
                    onClick={() => setCurrentTime(startTime)}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => {
                      const midTime = minutesToTime(Math.floor((timeToMinutes(startTime) + timeToMinutes(endTime)) / 2));
                      setCurrentTime(midTime);
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                  >
                    Middle
                  </button>
                  <button
                    onClick={() => setCurrentTime(endTime)}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                  >
                    End
                  </button>
                </div>
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
              {isLiveMode ? (
                <>Live GPS positions - {filteredPositions.length} trackers visible</>
              ) : (
                <>
                  Historical GPS positions at {currentTime} - {filteredPositions.length} trackers visible
                  {timelineMetadata && (
                    <span className="ml-2 text-blue-400">
                      • {timelineMetadata.trackers?.length || 0} total trackers available
                    </span>
                  )}
                </>
              )}
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
