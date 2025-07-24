'use client';

import { useState, useEffect, useCallback } from 'react';
import BoatCMS from '../../components/BoatCMS';

interface CMSStats {
  total_boats: number;
  by_status: {
    waiting: number;
    active: number;
    finished: number;
    emergency: number;
  };
  with_imei: number;
  without_imei: number;
}

export default function CMSPage() {
  const [stats, setStats] = useState<CMSStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchStats]);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/cms/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [API_URL]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🏳️‍🌈 PrideSync CMS
          </h1>
          <p className="text-gray-600">
            Content Management System for Pride Parade Boats
          </p>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Statistics Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">🚤</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Boats</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total_boats}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">✅</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Boats</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.by_status.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">📡</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">With IMEI</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.with_imei}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">⏳</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Waiting</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.by_status.waiting}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Breakdown */}
        {stats && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.by_status.waiting}</div>
                <div className="text-sm text-gray-500">Waiting</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.by_status.active}</div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.by_status.finished}</div>
                <div className="text-sm text-gray-500">Finished</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.by_status.emergency}</div>
                <div className="text-sm text-gray-500">Emergency</div>
              </div>
            </div>
          </div>
        )}

        {/* Boat Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <BoatCMS apiUrl={API_URL} />
        </div>

        {/* API Information */}
        <div className="bg-blue-50 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">API Information</h3>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Backend URL:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{API_URL}</code>
            </div>
            <div>
              <strong>GPS Webhook:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{API_URL}/api/webhooks/kpn-gps</code>
            </div>
            <div>
              <strong>CMS API:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{API_URL}/api/cms/boats</code>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-100 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => window.open('/', '_blank')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              View Live Dashboard
            </button>
            <button
              onClick={() => window.open(`${API_URL}/health`, '_blank')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Check API Health
            </button>
            <button
              onClick={fetchStats}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Refresh Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
