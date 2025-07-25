'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString('nl-NL'));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <header className="pride-gradient text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-center">
            🏳️‍🌈 PrideSync
          </h1>
          <p className="text-xl md:text-2xl text-center mt-2 opacity-90">
            Pride Parade Coordination System
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <section className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">
              Welkom bij PrideSync Nederland
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Het real-time coördinatiesysteem voor Pride parades in Nederland. 
              Samen zorgen we voor een veilige, georganiseerde en prachtige parade ervaring.
            </p>
            <div className="text-sm text-gray-500">
              Huidige tijd: {currentTime}
            </div>
          </section>

          {/* Quick Access Cards */}
          <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {/* Viewer App */}
            <Link href="/2025" className="group">
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-pink-500">
                <div className="text-4xl mb-4">👥</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Kijkers App 2025
                </h3>
                <p className="text-gray-600 mb-4">
                  Stem op je favoriete boot en krijg meer informatie over de parade
                </p>
                <div className="text-pink-600 font-semibold group-hover:text-pink-700">
                  Ga naar app →
                </div>
              </div>
            </Link>

            {/* Skipper App */}
            <Link href="/skipper" className="group">
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-blue-500">
                <div className="text-4xl mb-4">⚓</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Schippers App
                </h3>
                <p className="text-gray-600 mb-4">
                  Real-time positie-indicatie en corridor management voor schippers
                </p>
                <div className="text-blue-600 font-semibold group-hover:text-blue-700">
                  Ga naar app →
                </div>
              </div>
            </Link>

            {/* Admin Dashboard */}
            <Link href="/admin" className="group">
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-purple-500">
                <div className="text-4xl mb-4">🎛️</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Admin Dashboard
                </h3>
                <p className="text-gray-600 mb-4">
                  System management, device configuration en API monitoring
                </p>
                <div className="text-purple-600 font-semibold group-hover:text-purple-700">
                  Open dashboard →
                </div>
              </div>
            </Link>
          </section>

          {/* Features Section */}
          <section className="bg-white rounded-xl shadow-lg p-8 mb-16">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Systeem Functies
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">📍</div>
                <div>
                  <h4 className="font-semibold text-gray-800">Real-time GPS Tracking</h4>
                  <p className="text-gray-600">Live positie van alle boten in de parade</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-2xl">🎯</div>
                <div>
                  <h4 className="font-semibold text-gray-800">Corridor Management</h4>
                  <p className="text-gray-600">Automatische afstand en positie controle</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-2xl">📱</div>
                <div>
                  <h4 className="font-semibold text-gray-800">Mobile Apps</h4>
                  <p className="text-gray-600">Dedicated apps voor schippers en kijkers</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-2xl">🚨</div>
                <div>
                  <h4 className="font-semibold text-gray-800">Emergency Management</h4>
                  <p className="text-gray-600">Directe communicatie bij calamiteiten</p>
                </div>
              </div>
            </div>
          </section>

          {/* Status Section */}
          <section className="text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="text-green-600 text-2xl mb-2">✅</div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Systeem Status: Operationeel
              </h3>
              <p className="text-green-700">
                Alle systemen zijn online en gereed voor gebruik
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-300">
            © 2025 PrideSync Nederland - Samen maken we Pride mogelijk
          </p>
          <div className="mt-4 space-x-6">
            <a href="mailto:info@pridesync.nl" className="text-gray-300 hover:text-white">
              Contact
            </a>
            <a href="/privacy" className="text-gray-300 hover:text-white">
              Privacy
            </a>
            <a href="/support" className="text-gray-300 hover:text-white">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
