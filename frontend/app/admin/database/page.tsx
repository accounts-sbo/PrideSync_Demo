'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Table, Eye } from 'lucide-react';

interface TableInfo {
  table_name: string;
  row_count: number;
  columns: string[];
}

interface DatabaseStats {
  tables: TableInfo[];
  total_tables: number;
  total_rows: number;
}

interface TableData {
  columns: string[];
  rows: any[];
  total_count: number;
}

export default function DatabasePage() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const backendUrl = process.env.NODE_ENV === 'production'
    ? 'https://pridesyncdemo-production.up.railway.app'
    : 'http://localhost:3001';

  const fetchDatabaseStats = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${backendUrl}/api/database/stats`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error || 'Failed to fetch database stats');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error('Database stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${backendUrl}/api/database/table/${tableName}?limit=100`);
      const data = await response.json();

      if (data.success) {
        setTableData(data.data);
        setSelectedTable(tableName);
      } else {
        setError(data.error || 'Failed to fetch table data');
      }
    } catch (err) {
      setError('Failed to fetch table data');
      console.error('Table data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-400" />
              Database Weergave
            </h1>
            <p className="text-gray-400 mt-2">
              Bekijk alle database tabellen en hun inhoud voor debugging
            </p>
          </div>
          <Button 
            onClick={fetchDatabaseStats}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </Button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-200">❌ {error}</p>
          </div>
        )}

        {/* Database Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Table className="h-5 w-5 text-green-400" />
                  Totaal Tabellen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-400">
                  {stats.total_tables}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-400" />
                  Totaal Rijen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-400">
                  {stats.total_rows.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-green-600 text-white">
                  ✅ Verbonden
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tables List */}
        {stats && (
          <Card className="bg-gray-800 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Database Tabellen</CardTitle>
              <CardDescription className="text-gray-400">
                Klik op een tabel om de inhoud te bekijken
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.tables.map((table) => (
                  <div
                    key={table.table_name}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedTable === table.table_name
                        ? 'bg-blue-900/50 border-blue-500'
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    }`}
                    onClick={() => fetchTableData(table.table_name)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-white">{table.table_name}</h3>
                      <Badge variant="secondary" className="bg-gray-600 text-white">
                        {table.row_count} rijen
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {table.columns.length} kolommen
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {table.columns.slice(0, 3).join(', ')}
                      {table.columns.length > 3 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table Data */}
        {tableData && selectedTable && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-yellow-400" />
                Tabel: {selectedTable}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Toont eerste 100 rijen van {tableData.total_count} totaal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tableData.rows.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  📭 Geen data gevonden in deze tabel
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-600">
                        {tableData.columns.map((column) => (
                          <th key={column} className="text-left p-2 text-gray-300 font-semibold">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, index) => (
                        <tr key={index} className="border-b border-gray-700 hover:bg-gray-700/50">
                          {tableData.columns.map((column) => (
                            <td key={column} className="p-2 text-gray-200">
                              {row[column] === null ? (
                                <span className="text-gray-500 italic">null</span>
                              ) : typeof row[column] === 'object' ? (
                                <span className="text-blue-300">
                                  {JSON.stringify(row[column]).substring(0, 50)}...
                                </span>
                              ) : (
                                String(row[column])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
