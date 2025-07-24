'use client';

import { useState, useEffect, useCallback } from 'react';
import ApiTester from '../components/ApiTester';

interface BoatPosition {
  id: number;
  name: string;
  status: string;
  position: {
    latitude: number;
    longitude: number;
    routeProgress: number;
    routeDistance: number;
    speed: number;
    heading: number;
    timestamp: string;
  };
}

interface ParadeStatus {
  status: string;
  startTime: string | null;
  totalBoats: number;
  activeBoats: number;
  averageProgress: number;
}

export default function Home() {
  const [boats, setBoats] = useState<BoatPosition[]>([]);
  const [paradeStatus, setParadeStatus] = useState<ParadeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch boats data
      const boatsResponse = await fetch(`${API_URL}/api/boats`);
      if (!boatsResponse.ok) throw new Error('Failed to fetch boats data');
      const boatsData = await boatsResponse.json();
      setBoats(boatsData.boats || []);

      // Fetch parade status
      const paradeResponse = await fetch(`${API_URL}/api/parade/status`);
      if (!paradeResponse.ok) throw new Error('Failed to fetch parade status');
      const paradeData = await paradeResponse.json();
      setParadeStatus(paradeData.parade || null);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'waiting': return 'text-yellow-600';
      case 'finished': return 'text-blue-600';
      case 'emergency': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading PrideSync...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <div></div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">
              🏳️‍🌈 PrideSync
            </h1>
            <a
              href="/cms"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              CMS
            </a>
          </div>
          <p className="text-lg text-gray-600">
            Real-time Pride Parade Coordination System
          </p>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Parade Status */}
        {paradeStatus && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Parade Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getStatusColor(paradeStatus.status)}`}>
                  {paradeStatus.status.toUpperCase()}
                </div>
                <div className="text-sm text-gray-500">Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{paradeStatus.totalBoats}</div>
                <div className="text-sm text-gray-500">Total Boats</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{paradeStatus.activeBoats}</div>
                <div className="text-sm text-gray-500">Active Boats</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {paradeStatus.averageProgress.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Avg Progress</div>
              </div>
            </div>
          </div>
        )}

        {/* Boats Grid */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Boat Positions</h2>
          {boats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No boats currently tracked</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {boats.map((boat) => (
                <div key={boat.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{boat.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(boat.status)}`}>
                      {boat.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Progress: {boat.position.routeProgress.toFixed(1)}%</div>
                    <div>Speed: {boat.position.speed.toFixed(1)} km/h</div>
                    <div>Heading: {boat.position.heading}°</div>
                    <div>
                      Position: {boat.position.latitude.toFixed(4)}, {boat.position.longitude.toFixed(4)}
                    </div>
                    <div className="text-xs text-gray-400">
                      Updated: {new Date(boat.position.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(boat.position.routeProgress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Tester */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">API Tester</h2>
          <ApiTester apiUrl={API_URL} />
        </div>
      </div>
    </div>
  );
}
