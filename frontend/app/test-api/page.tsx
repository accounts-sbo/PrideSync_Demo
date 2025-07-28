'use client';

import { useState, useEffect } from 'react';

export default function TestAPIPage() {
  const [apiStatus, setApiStatus] = useState<string>('Testing...');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [boats, setBoats] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    setApiUrl(API_URL);
    
    testAPI(API_URL);
  }, []);

  const testAPI = async (url: string) => {
    try {
      // Test health endpoint
      const healthResponse = await fetch(`${url}/health`);
      const healthData = await healthResponse.json();
      
      if (healthData.status === 'OK') {
        setApiStatus('✅ Connected');
        
        // Test boats endpoint
        const boatsResponse = await fetch(`${url}/api/boats`);
        const boatsData = await boatsResponse.json();
        
        if (boatsData.success) {
          setBoats(boatsData.boats || []);
        }
      } else {
        setApiStatus('❌ Health check failed');
      }
    } catch (err) {
      setApiStatus('❌ Connection failed');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">🧪 API Connection Test</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="space-y-2">
            <p><strong>API URL:</strong> {apiUrl}</p>
            <p><strong>Status:</strong> {apiStatus}</p>
            {error && <p className="text-red-600"><strong>Error:</strong> {error}</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Boats Data ({boats.length})</h2>
          {boats.length > 0 ? (
            <div className="grid gap-4">
              {boats.map((boat, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{boat.name || `Boat ${boat.id}`}</h3>
                  <p className="text-sm text-gray-600">Status: {boat.status}</p>
                  {boat.position && (
                    <p className="text-sm text-gray-600">
                      Position: {boat.position.latitude}, {boat.position.longitude}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No boats found or API not connected</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => testAPI(apiUrl)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              🔄 Refresh Test
            </button>
            <a
              href={`${apiUrl}/health`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors inline-block"
            >
              🏥 Open Health Check
            </a>
            <a
              href="/admin/dashboard"
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded transition-colors inline-block"
            >
              📊 Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
