'use client';

import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🏳️‍🌈 PrideSync Admin
          </h1>
          <p className="text-gray-600">
            Administrative dashboard for Pride Parade management
          </p>
        </header>

        {/* Admin Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CMS */}
          <Link href="/admin/cms" className="group">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-blue-500">
              <div className="text-4xl mb-4">🛠️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Content Management
              </h3>
              <p className="text-gray-600 mb-4">
                Manage boats, participants, and parade content
              </p>
              <div className="text-blue-600 font-semibold group-hover:text-blue-700">
                Open CMS →
              </div>
            </div>
          </Link>

          {/* Dashboard */}
          <Link href="/admin/dashboard" className="group">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-purple-500">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Live Dashboard
              </h3>
              <p className="text-gray-600 mb-4">
                Real-time monitoring and control of the parade
              </p>
              <div className="text-purple-600 font-semibold group-hover:text-purple-700">
                Open Dashboard →
              </div>
            </div>
          </Link>

          {/* Back to Public Site */}
          <Link href="/" className="group">
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-green-500">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Public Website
              </h3>
              <p className="text-gray-600 mb-4">
                Return to the main PrideSync website
              </p>
              <div className="text-green-600 font-semibold group-hover:text-green-700">
                Go to Website →
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/2025" className="text-center p-4 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors">
              <div className="text-2xl mb-2">👥</div>
              <div className="text-sm font-medium text-pink-800">Kijkers App</div>
            </Link>
            <Link href="/skipper" className="text-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="text-2xl mb-2">⚓</div>
              <div className="text-sm font-medium text-blue-800">Schippers App</div>
            </Link>
            <Link href="/support" className="text-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <div className="text-2xl mb-2">💬</div>
              <div className="text-sm font-medium text-green-800">Support</div>
            </Link>
            <Link href="/privacy" className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="text-2xl mb-2">🔒</div>
              <div className="text-sm font-medium text-gray-800">Privacy</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
