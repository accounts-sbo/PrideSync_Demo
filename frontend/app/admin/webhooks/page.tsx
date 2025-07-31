'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// Simple icon replacements to avoid external dependencies
const RefreshCw = ({ className }: { className?: string }) => <span className={className}>🔄</span>;
const Activity = ({ className }: { className?: string }) => <span className={className}>📊</span>;
const Clock = ({ className }: { className?: string }) => <span className={className}>⏰</span>;
const Globe = ({ className }: { className?: string }) => <span className={className}>🌐</span>;
const AlertCircle = ({ className }: { className?: string }) => <span className={className}>⚠️</span>;

interface WebhookLog {
  id: number;
  endpoint: string;
  method: string;
  headers: any;
  body: any;
  query_params: any;
  ip_address: string;
  user_agent: string;
  response_status: number;
  response_body: any;
  processing_time_ms: number;
  error_message: string | null;
  created_at: string;
}

interface WebhookStats {
  total_requests: number;
  last_24h: number;
  endpoints: string[];
  latest_request: string | null;
}

export default function WebhooksPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchWebhookData = async () => {
    try {
      // Get backend URL
      const backendUrl = process.env.NODE_ENV === 'production'
        ? 'https://pridesyncdemo-production.up.railway.app'
        : 'http://localhost:3000';

      const response = await fetch(`${backendUrl}/api/webhooks/logs?limit=100`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setStats(data.data.stats);
      } else {
        console.error('API returned error:', data);
      }
    } catch (error) {
      console.error('Failed to fetch webhook data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhookData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchWebhookData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-500'; // Success
    if (status >= 400 && status < 500) return 'bg-yellow-500'; // Client Error (validation failed)
    if (status >= 500) return 'bg-red-500'; // Server Error
    return 'bg-gray-500';
  };

  const getStatusText = (status: number) => {
    if (status >= 200 && status < 300) return 'Success';
    if (status === 400) return 'Validation Error';
    if (status === 404) return 'Not Found';
    if (status >= 400 && status < 500) return 'Client Error';
    if (status >= 500) return 'Server Error';
    return 'Unknown';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatJSON = (obj: any) => {
    if (!obj) return 'null';
    return JSON.stringify(obj, null, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2 text-gray-300">Loading webhook data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">📡 Webhook Monitor</h1>
            <p className="text-gray-300 mt-2">Monitor incoming KPN webhook payloads in real-time</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-green-600 hover:bg-green-700" : "border-gray-600 text-gray-300 hover:bg-gray-800"}
            >
              <Activity className="h-4 w-4 mr-2" />
              {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
            </Button>
            <Button
              onClick={fetchWebhookData}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">Total Requests</p>
                    <p className="text-2xl font-bold text-white">{stats.total_requests}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-400">Last 24h</p>
                    <p className="text-2xl font-bold text-white">{stats.last_24h}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-sm text-gray-400">Endpoints</p>
                    <p className="text-2xl font-bold text-white">{stats.endpoints?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-orange-400" />
                  <div>
                    <p className="text-sm text-gray-400">Latest Request</p>
                    <p className="text-sm font-medium text-gray-300">
                      {stats.latest_request ? formatTimestamp(stats.latest_request) : 'None'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Webhook Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Logs List */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Webhook Requests</CardTitle>
              <div className="text-sm text-gray-400 mt-2">
                🟢 Success (200-299) • 🟡 Validation Error (400) • 🔴 Server Error (500+)
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No webhook requests yet</p>
                    <p className="text-sm">KPN webhooks will appear here when received</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 border border-gray-600 rounded cursor-pointer hover:bg-gray-700 transition-colors ${
                        selectedLog?.id === log.id ? 'border-blue-400 bg-gray-700' : ''
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="border-gray-500 text-gray-300">{log.method}</Badge>
                          <span className="font-mono text-sm text-gray-300">{log.endpoint}</span>
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(log.response_status)}`} title={getStatusText(log.response_status)} />
                          <span className="text-sm text-gray-400">{log.response_status}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(log.created_at)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {log.processing_time_ms}ms • {log.ip_address}
                        {log.response_status === 400 && <span className="ml-2 text-yellow-400">• Validation Failed</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Log Details */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Request Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedLog ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-white">Request Info</h4>
                    <div className="bg-gray-700 p-3 rounded text-sm text-gray-300">
                      <p><strong className="text-white">Endpoint:</strong> {selectedLog.endpoint}</p>
                      <p><strong className="text-white">Method:</strong> {selectedLog.method}</p>
                      <p><strong className="text-white">Status:</strong>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          selectedLog.response_status >= 200 && selectedLog.response_status < 300 ? 'bg-green-600' :
                          selectedLog.response_status >= 400 && selectedLog.response_status < 500 ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}>
                          {selectedLog.response_status} - {getStatusText(selectedLog.response_status)}
                        </span>
                      </p>
                      <p><strong className="text-white">Processing Time:</strong> {selectedLog.processing_time_ms}ms</p>
                      <p><strong className="text-white">IP Address:</strong> {selectedLog.ip_address}</p>
                      <p><strong className="text-white">Timestamp:</strong> {formatTimestamp(selectedLog.created_at)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-white">Request Body (KPN Data)</h4>
                    <pre className="bg-gray-900 border border-gray-600 p-3 rounded text-xs overflow-auto max-h-40 text-green-400">
                      {formatJSON(selectedLog.body)}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-white">Headers</h4>
                    <pre className="bg-gray-900 border border-gray-600 p-3 rounded text-xs overflow-auto max-h-32 text-blue-400">
                      {formatJSON(selectedLog.headers)}
                    </pre>
                  </div>

                  {selectedLog.response_body && (
                    <div>
                      <h4 className="font-semibold mb-2 text-white">Response</h4>
                      <pre className="bg-gray-900 border border-gray-600 p-3 rounded text-xs overflow-auto max-h-32 text-purple-400">
                        {formatJSON(selectedLog.response_body)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.error_message && (
                    <div>
                      <h4 className="font-semibold mb-2 text-red-400">Error</h4>
                      <div className="bg-red-900 border border-red-600 p-3 rounded text-sm text-red-200">
                        {selectedLog.error_message}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>Select a webhook request to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Webhook URLs for KPN */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">🔗 Webhook URLs for KPN</CardTitle>
            <p className="text-gray-400 text-sm mt-2">
              Gebruik deze URLs om KPN GPS data te ontvangen van serials: 1326954, 1326997, 1327047, 1422639, 1422666, 1424486, 1424487, 1424489, 1424493, 1424494, 1424653, 1424670, 1424671, 1424678, 1424679
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-purple-900 border border-purple-700 p-4 rounded">
                <p className="font-semibold mb-2 text-purple-200">🎯 KPN Serial Data (Aanbevolen):</p>
                <code className="bg-gray-900 text-green-400 p-2 rounded border border-gray-600 block text-sm">
                  POST https://pridesyncdemo-production.up.railway.app/api/webhooks/kpn-serial
                </code>
                <p className="text-xs text-purple-300 mt-2">✅ Flexibele validatie voor echte KPN data</p>
              </div>
              <div className="bg-blue-900 border border-blue-700 p-4 rounded">
                <p className="font-semibold mb-2 text-blue-200">KPN GPS Webhook (Legacy):</p>
                <code className="bg-gray-900 text-green-400 p-2 rounded border border-gray-600 block text-sm">
                  POST https://pridesyncdemo-production.up.railway.app/api/webhooks/kpn-gps
                </code>
                <p className="text-xs text-blue-300 mt-2">Voor eenvoudige GPS payloads</p>
              </div>
              <div className="bg-green-900 border border-green-700 p-4 rounded">
                <p className="font-semibold mb-2 text-green-200">Tracker GPS Webhook:</p>
                <code className="bg-gray-900 text-green-400 p-2 rounded border border-gray-600 block text-sm">
                  POST https://pridesyncdemo-production.up.railway.app/api/webhooks/tracker-gps
                </code>
                <p className="text-xs text-green-300 mt-2">Voor gestructureerde tracker data</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
