'use client';

import { useState } from 'react';

export default function ApiTester() {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testHealthEndpoint = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  const testWebhook = async () => {
    setLoading(true);
    try {
      const testPayload = {
        bootnummer: 11,
        timestamp: new Date().toISOString(),
        latitude: 52.37338,
        longitude: 4.89075
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/webhooks/kpn-gps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">🧪 API Tester</h2>
      
      <div className="space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={testHealthEndpoint}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded transition-colors"
          >
            {loading ? 'Testing...' : 'Test Health Endpoint'}
          </button>
          
          <button
            onClick={testWebhook}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded transition-colors"
          >
            {loading ? 'Testing...' : 'Test GPS Webhook'}
          </button>
        </div>

        {testResult && (
          <div className="bg-black/20 rounded p-4">
            <h3 className="text-white font-semibold mb-2">Test Result:</h3>
            <pre className="text-green-300 text-sm overflow-auto max-h-96">
              {testResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
