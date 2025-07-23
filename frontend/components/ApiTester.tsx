'use client';

import { useState } from 'react';

interface ApiTesterProps {
  apiUrl: string;
}

export default function ApiTester({ apiUrl }: ApiTesterProps) {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testHealthEndpoint = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/health`);
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
        latitude: 52.3851, // Start of parade route (Westerdok)
        longitude: 4.8947
      };

      const response = await fetch(`${apiUrl}/api/webhooks/kpn-gps`, {
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
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

      <div className="text-sm text-gray-600">
        <p><strong>API URL:</strong> {apiUrl}</p>
      </div>

      {testResult && (
        <div className="bg-gray-100 rounded p-4">
          <h3 className="font-semibold mb-2 text-gray-800">Test Result:</h3>
          <pre className="text-sm overflow-auto max-h-96 bg-black text-green-400 p-3 rounded">
            {testResult}
          </pre>
        </div>
      )}
    </div>
  );
}
