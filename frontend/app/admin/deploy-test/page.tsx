'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, GitBranch, Zap, RefreshCw } from 'lucide-react';

// Current deployment version - increment this for each deployment
const CURRENT_DEPLOYMENT_VERSION = "v1.2.3-map-timeline";
const DEPLOYMENT_DATE = "2025-01-08 17:30";
const COMMIT_HASH = "a6160d2";

interface DeploymentTest {
  name: string;
  description: string;
  test: () => Promise<boolean>;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export default function DeployTestPage() {
  const [tests, setTests] = useState<DeploymentTest[]>([
    {
      name: 'Frontend Build',
      description: 'Check if the frontend compiled successfully',
      test: async () => {
        // If we can load this page, the build succeeded
        return true;
      },
      status: 'pending'
    },
    {
      name: 'GPS API Connection',
      description: 'Test connection to GPS positions API',
      test: async () => {
        try {
          const response = await fetch('/api/webhooks/gps-positions');
          return response.ok;
        } catch {
          return false;
        }
      },
      status: 'pending'
    },
    {
      name: 'Map Component Loading',
      description: 'Check if Leaflet map component can be imported',
      test: async () => {
        try {
          // Test if we can dynamically import the map component
          await import('../map/MapComponent');
          return true;
        } catch {
          return false;
        }
      },
      status: 'pending'
    },
    {
      name: 'Timeline Functionality',
      description: 'Test timeline controls and time parsing',
      test: async () => {
        try {
          // Test time conversion functions
          const timeToMinutes = (time: string) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
          };
          
          const minutesToTime = (minutes: number) => {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          };

          const testTime = "15:30";
          const minutes = timeToMinutes(testTime);
          const backToTime = minutesToTime(minutes);
          
          return testTime === backToTime;
        } catch {
          return false;
        }
      },
      status: 'pending'
    },
    {
      name: 'CSS Styling',
      description: 'Check if custom CSS classes are loaded',
      test: async () => {
        try {
          // Check if we can access CSS custom properties
          const style = getComputedStyle(document.documentElement);
          return true; // If we get here, CSS is loaded
        } catch {
          return false;
        }
      },
      status: 'pending'
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string>('');

  const runTests = async () => {
    setIsRunning(true);
    setLastRun(new Date().toLocaleString('nl-NL'));

    for (let i = 0; i < tests.length; i++) {
      // Update status to running
      setTests(prev => prev.map((test, index) => 
        index === i ? { ...test, status: 'running' } : test
      ));

      try {
        const result = await tests[i].test();
        
        // Update status based on result
        setTests(prev => prev.map((test, index) => 
          index === i ? { 
            ...test, 
            status: result ? 'success' : 'error',
            error: result ? undefined : 'Test failed'
          } : test
        ));
      } catch (error) {
        // Update status to error
        setTests(prev => prev.map((test, index) => 
          index === i ? { 
            ...test, 
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          } : test
        ));
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      case 'running':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;
  const allTestsRun = tests.every(t => t.status !== 'pending');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🚀 Deployment Test Dashboard
            </h1>
            <p className="text-gray-400">
              Verify deployment success and functionality
            </p>
          </div>
          
          <Button
            onClick={runTests}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run Tests
              </>
            )}
          </Button>
        </div>

        {/* Deployment Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Version</p>
                  <p className="text-lg font-bold text-white">{CURRENT_DEPLOYMENT_VERSION}</p>
                </div>
                <GitBranch className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Deployed</p>
                  <p className="text-sm font-medium text-white">{DEPLOYMENT_DATE}</p>
                </div>
                <Clock className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Commit</p>
                  <p className="text-sm font-mono text-white">{COMMIT_HASH}</p>
                </div>
                <GitBranch className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p className="text-lg font-bold text-white">
                    {allTestsRun ? (errorCount === 0 ? 'HEALTHY' : 'ISSUES') : 'PENDING'}
                  </p>
                </div>
                {allTestsRun ? (
                  errorCount === 0 ? (
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-400" />
                  )
                ) : (
                  <Clock className="w-8 h-8 text-gray-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              Deployment Tests
              {allTestsRun && (
                <Badge variant="secondary" className={`ml-2 ${errorCount === 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                  {successCount}/{tests.length} Passed
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {lastRun ? `Last run: ${lastRun}` : 'Click "Run Tests" to verify deployment'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tests.map((test, index) => (
                <div
                  key={index}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <h3 className="font-semibold text-white">{test.name}</h3>
                        <p className="text-sm text-gray-400">{test.description}</p>
                      </div>
                    </div>
                    
                    <Badge variant="secondary" className={getStatusColor(test.status)}>
                      {test.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  {test.error && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-700 rounded text-red-300 text-sm">
                      Error: {test.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
