'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string>('');
  const [preview, setPreview] = useState<string[][]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      previewCSV(selectedFile);
    }
  };

  const previewCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(0, 6); // Show first 5 rows + header
      const rows = lines.map(line => {
        // Simple CSV parsing
        return line.split(',').map(cell => cell.trim().replace(/"/g, ''));
      });
      setPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult('');

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const API_URL = process.env.NODE_ENV === 'production'
        ? 'https://pridesyncdemo-production.up.railway.app'
        : 'http://localhost:3000';

      const response = await fetch(`${API_URL}/api/cms/import-boats`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ Import successful!\n${data.message}\nImported: ${data.imported} boats\nSkipped: ${data.skipped} boats\nErrors: ${data.errors} boats`);
      } else {
        setResult(`❌ Import failed: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-2xl font-bold text-purple-600">
                🏳️‍🌈 PrideSync Admin
              </Link>
            </div>
            <nav className="flex space-x-4">
              <Link href="/admin/cms" className="text-gray-600 hover:text-purple-600">CMS</Link>
              <Link href="/admin/dashboard" className="text-gray-600 hover:text-purple-600">Dashboard</Link>
              <Link href="/" className="text-gray-600 hover:text-purple-600">Public Site</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">📊 Import KPN Boats Data</h1>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">📋 Instructions</h2>
            <div className="space-y-2 text-blue-800">
              <p><strong>1. Convert Excel to CSV:</strong> Open your Excel file and save as CSV (Comma delimited)</p>
              <p><strong>2. Required columns:</strong> Asset Type, Name, Asset Code, Device Type, Serial Number</p>
              <p><strong>3. Name field:</strong> Should contain the boat number (e.g., "1326954")</p>
              <p><strong>4. Upload:</strong> Select your CSV file and click Import</p>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">📁 Upload CSV File</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select KPN Boats CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>

              {file && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">Selected: {file.name}</span>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {importing ? 'Importing...' : 'Import Boats'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CSV Preview */}
          {preview.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">👀 CSV Preview</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      {preview[0]?.map((header, index) => (
                        <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(1).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 6 && (
                <p className="text-sm text-gray-500 mt-2">... and {preview.length - 6} more rows</p>
              )}
            </div>
          )}

          {/* Import Result */}
          {result && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">📊 Import Result</h2>
              <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}

          {/* Expected Format */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Expected CSV Format</h2>
            <div className="bg-gray-100 p-4 rounded">
              <code className="text-sm">
                Asset Type,Name,Description,Project,Department,Asset Code,Device Type,Serial Number,Enabled,Last Connected,Last Trip,Current Status,Odometer (km),Run Hours (hrs)<br/>
                Boat,1326954,353760970748614,,P2,Oyster 3 - Fusion Global Bluetooth,1326954,Enabled,2025/07/25,,Parked at 1,,<br/>
                Boat,1326997,353760970649317,,P1,Oyster 3 - Fusion Global Bluetooth,1326997,Enabled,2025/07/25,2025/07/09,Parked at 1,532.35,7.69
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
