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
      const response = await fetch('/api/webhooks/logs?limit=100');
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.data.logs);
        setStats(data.data.stats);
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
    if (status >= 200 && status < 300) return 'bg-green-500';
    if (status >= 400 && status < 500) return 'bg-yellow-500';
    if (status >= 500) return 'bg-red-500';
    return 'bg-gray-500';
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
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading webhook data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">📡 Webhook Monitor</h1>
          <p className="text-gray-600 mt-2">Monitor incoming KPN webhook payloads in real-time</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
          </Button>
          <Button onClick={fetchWebhookData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold">{stats.total_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Last 24h</p>
                  <p className="text-2xl font-bold">{stats.last_24h}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Endpoints</p>
                  <p className="text-2xl font-bold">{stats.endpoints?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Latest Request</p>
                  <p className="text-sm font-medium">
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
        <Card>
          <CardHeader>
            <CardTitle>Recent Webhook Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No webhook requests yet</p>
                  <p className="text-sm">KPN webhooks will appear here when received</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                      selectedLog?.id === log.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{log.method}</Badge>
                        <span className="font-mono text-sm">{log.endpoint}</span>
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(log.response_status)}`} />
                        <span className="text-sm text-gray-600">{log.response_status}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(log.created_at)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {log.processing_time_ms}ms • {log.ip_address}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Log Details */}
        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedLog ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Request Info</h4>
                  <div className="bg-gray-100 p-3 rounded text-sm">
                    <p><strong>Endpoint:</strong> {selectedLog.endpoint}</p>
                    <p><strong>Method:</strong> {selectedLog.method}</p>
                    <p><strong>Status:</strong> {selectedLog.response_status}</p>
                    <p><strong>Processing Time:</strong> {selectedLog.processing_time_ms}ms</p>
                    <p><strong>IP Address:</strong> {selectedLog.ip_address}</p>
                    <p><strong>Timestamp:</strong> {formatTimestamp(selectedLog.created_at)}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Request Body (KPN Data)</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                    {formatJSON(selectedLog.body)}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Headers</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                    {formatJSON(selectedLog.headers)}
                  </pre>
                </div>

                {selectedLog.response_body && (
                  <div>
                    <h4 className="font-semibold mb-2">Response</h4>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                      {formatJSON(selectedLog.response_body)}
                    </pre>
                  </div>
                )}

                {selectedLog.error_message && (
                  <div>
                    <h4 className="font-semibold mb-2 text-red-600">Error</h4>
                    <div className="bg-red-100 p-3 rounded text-sm text-red-800">
                      {selectedLog.error_message}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Select a webhook request to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook URLs for KPN */}
      <Card>
        <CardHeader>
          <CardTitle>🔗 Webhook URLs for KPN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="bg-blue-50 p-4 rounded">
              <p className="font-semibold mb-2">KPN GPS Webhook:</p>
              <code className="bg-white p-2 rounded border block">
                POST https://pridesyncdemo-production.up.railway.app/api/webhooks/kpn-gps
              </code>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <p className="font-semibold mb-2">Tracker GPS Webhook:</p>
              <code className="bg-white p-2 rounded border block">
                POST https://pridesyncdemo-production.up.railway.app/api/webhooks/tracker-gps
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
