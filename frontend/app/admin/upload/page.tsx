'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, AlertCircle, Database } from 'lucide-react';

interface UploadResult {
  success: boolean;
  message: string;
  stats?: {
    pride_boats: number;
    kpn_trackers: number;
    mappings: number;
  };
  errors?: string[];
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [preview, setPreview] = useState<string[]>([]);

  const backendUrl = process.env.NODE_ENV === 'production'
    ? 'https://pridesyncdemo-production.up.railway.app'
    : 'http://localhost:3001';

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      
      // Preview first few lines
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').slice(0, 5);
        setPreview(lines);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch(`${backendUrl}/api/database/upload-boats-csv`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Clear file after successful upload
        setFile(null);
        setPreview([]);
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to upload CSV file',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Upload className="h-8 w-8 text-blue-400" />
            CSV Upload - Pride Boats & Trackers
          </h1>
          <p className="text-gray-400 mt-2">
            Upload CSV bestand met 80 boten en hun tracker koppelingen
          </p>
        </div>

        {/* Upload Section */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-400" />
              CSV Bestand Selecteren
            </CardTitle>
            <CardDescription className="text-gray-400">
              Automatische detectie van kolommen - ondersteunt verschillende CSV formaten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-600 file:text-white
                    hover:file:bg-blue-700
                    file:cursor-pointer cursor-pointer"
                />
              </div>

              {file && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">{file.name}</p>
                      <p className="text-sm text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white">
                      Klaar voor upload
                    </Badge>
                  </div>

                  {preview.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-300 mb-2">Preview (eerste 5 regels):</p>
                      <div className="bg-gray-800 rounded p-3 text-xs font-mono">
                        {preview.map((line, index) => (
                          <div key={index} className="text-gray-300 truncate">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload CSV
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <Card className={`border-2 ${result.success ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'}`}>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                Upload Resultaat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-lg font-semibold ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                {result.message}
              </p>

              {result.success && result.stats && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <Database className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-400">{result.stats.pride_boats}</div>
                    <div className="text-sm text-gray-400">Pride Boats</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <Database className="h-6 w-6 text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-400">{result.stats.kpn_trackers}</div>
                    <div className="text-sm text-gray-400">KPN Trackers</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <Database className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-yellow-400">{result.stats.mappings}</div>
                    <div className="text-sm text-gray-400">Mappings</div>
                  </div>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-red-300 font-semibold mb-2">Errors:</p>
                  <ul className="list-disc list-inside text-red-200 space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-gray-800 border-gray-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white">CSV Formaat Instructies</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">
            <div className="space-y-3">
              <p><strong>Automatische Kolom Detectie:</strong></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-blue-300 mb-2">Ondersteunde Kolommen:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Naam/Name:</strong> Boot naam</li>
                    <li><strong>Nr/Position:</strong> Parade positie</li>
                    <li><strong>Tracker ID:</strong> KPN tracker nummer</li>
                    <li><strong>Organisatie/Organisation:</strong> Organisatie naam</li>
                    <li><strong>Thema/Theme/Description:</strong> Beschrijving</li>
                    <li><strong>Asset Code/P nummer:</strong> KPN asset code</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-green-300 mb-2">Flexibele Formaten:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Tab-separated (.tsv)</li>
                    <li>Comma-separated (.csv)</li>
                    <li>Nederlandse kolom namen</li>
                    <li>Engelse kolom namen</li>
                    <li>Mixed case headers</li>
                    <li>Extra kolommen worden genegeerd</li>
                  </ul>
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3 mt-4">
                <p className="text-sm text-yellow-300 font-semibold">💡 Tip:</p>
                <p className="text-sm text-gray-300">
                  Het systeem detecteert automatisch kolommen op basis van namen zoals "naam", "tracker id", "organisatie", etc.
                  Minimaal vereist: een naam/organisatie kolom en een tracker ID kolom.
                </p>
              </div>
              <p className="text-sm text-gray-400 mt-4">
                Database tabellen worden automatisch gevuld: pride_boats, kpn_trackers, en boat_tracker_mappings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
