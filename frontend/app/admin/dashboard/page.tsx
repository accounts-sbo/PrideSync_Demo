'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SystemStatus {
  backend: 'online' | 'offline' | 'checking';
  database: 'online' | 'offline' | 'checking';
  gps: 'active' | 'inactive' | 'checking';
}

export default function AdminDashboard() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: 'checking',
    database: 'checking',
    gps: 'checking'
  });

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString('nl-NL'));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkSystemStatus = async () => {
    // Check backend health
    try {
      const backendUrl = process.env.NODE_ENV === 'production'
        ? 'https://pridesyncdemo-production.up.railway.app'
        : 'http://localhost:3001';
        
      const response = await fetch(`${backendUrl}/health`);
      if (response.ok) {
        setSystemStatus(prev => ({ ...prev, backend: 'online', database: 'online' }));
      } else {
        setSystemStatus(prev => ({ ...prev, backend: 'offline', database: 'offline' }));
      }
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, backend: 'offline', database: 'offline' }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'offline':
      case 'inactive':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
        return '✅';
      case 'offline':
      case 'inactive':
        return '❌';
      default:
        return '⏳';
    }
  };

  const backendUrl = process.env.NODE_ENV === 'production'
    ? 'https://pridesyncdemo-production.up.railway.app'
    : 'http://localhost:3001';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-2xl font-bold text-gray-800">
                🏳️‍🌈 PrideSync Admin
              </Link>
              <span className="text-sm text-gray-500">
                {currentTime}
              </span>
            </div>
            <nav className="flex space-x-4">
              <Link href="/admin/cms" className="text-gray-600 hover:text-purple-600">CMS</Link>
              <Link href="/admin/import" className="text-gray-600 hover:text-purple-600">Import</Link>
              <Link href="/admin/dashboard" className="text-gray-600 hover:text-purple-600">Dashboard</Link>
              <Link href="/" className="text-gray-600 hover:text-purple-600">Public Site</Link>
            </nav>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">System Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.backend)}`}>
                {getStatusIcon(systemStatus.backend)} Backend
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* System Status Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Backend API</h3>
                <p className="text-sm text-gray-600">Core system status</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemStatus.backend)}`}>
                {getStatusIcon(systemStatus.backend)} {systemStatus.backend}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Database</h3>
                <p className="text-sm text-gray-600">PostgreSQL connection</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemStatus.database)}`}>
                {getStatusIcon(systemStatus.database)} {systemStatus.database}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">GPS Tracking</h3>
                <p className="text-sm text-gray-600">Real-time updates</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemStatus.gps)}`}>
                {getStatusIcon(systemStatus.gps)} {systemStatus.gps}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Device Management */}
          <a href={`${backendUrl}/api/device-management/cms`} 
             target="_blank" 
             rel="noopener noreferrer"
             className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow group">
            <div className="text-3xl mb-4">🔧</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Device Management</h3>
            <p className="text-gray-600 mb-4">
              Koppel IMEI nummers aan boten en beheer tracker devices
            </p>
            <div className="text-blue-600 font-semibold group-hover:text-blue-700">
              Open CMS →
            </div>
          </a>

          {/* API Documentation */}
          <a href={`${backendUrl}/health`} 
             target="_blank" 
             rel="noopener noreferrer"
             className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow group">
            <div className="text-3xl mb-4">📡</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">API Health Check</h3>
            <p className="text-gray-600 mb-4">
              Controleer backend status en API endpoints
            </p>
            <div className="text-green-600 font-semibold group-hover:text-green-700">
              Check API →
            </div>
          </a>

          {/* Voting Dashboard */}
          <Link href="/2025" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow group">
            <div className="text-3xl mb-4">🗳️</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Voting App 2025</h3>
            <p className="text-gray-600 mb-4">
              Pride Boat Ballot - publieke stemming interface
            </p>
            <div className="text-purple-600 font-semibold group-hover:text-purple-700">
              Open App →
            </div>
          </Link>
        </div>

        {/* API Endpoints */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">🔗 API Endpoints</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Webhooks</h4>
              <ul className="space-y-1 text-sm">
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">POST /api/webhooks/tracker-gps</code></li>
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">POST /api/webhooks/kpn-gps</code></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Voting</h4>
              <ul className="space-y-1 text-sm">
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">GET /api/voting/boats</code></li>
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">POST /api/voting/vote</code></li>
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">GET /api/voting/leaderboard</code></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Device Management</h4>
              <ul className="space-y-1 text-sm">
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">GET /api/device-management/mappings</code></li>
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">POST /api/device-management/mappings</code></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Boats</h4>
              <ul className="space-y-1 text-sm">
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">GET /api/boats</code></li>
                <li><code className="bg-gray-800 text-gray-100 px-2 py-1 rounded">GET /api/parade/status</code></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Demo Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-blue-800 mb-4">🚀 Demo Instructions</h3>
          <div className="space-y-3 text-blue-700">
            <p><strong>1. Device Setup:</strong> Open Device Management CMS en koppel IMEI nummers aan boten</p>
            <p><strong>2. GPS Simulation:</strong> Run <code className="bg-blue-100 px-2 py-1 rounded">npm run simulate-gps</code> in backend</p>
            <p><strong>3. Test Voting:</strong> Open de 2025 app en test het stemmen op boten</p>
            <p><strong>4. Monitor:</strong> Check de backend logs voor real-time GPS updates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
