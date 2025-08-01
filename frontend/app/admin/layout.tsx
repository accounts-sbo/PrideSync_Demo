import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Brand */}
            <Link href="/admin" className="flex items-center space-x-2">
              <span className="text-2xl">🏳️‍🌈</span>
              <span className="text-xl font-bold text-gray-900">PrideSync Admin</span>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center space-x-6">
              <Link 
                href="/admin/cms" 
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                CMS
              </Link>
              <Link
                href="/admin/dashboard"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/webhooks"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Webhooks
              </Link>
              <Link
                href="/admin/map"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Live Map
              </Link>
              <Link
                href="/admin/database"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Database
              </Link>
              <Link
                href="/admin/upload"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                CSV Upload
              </Link>
              <Link 
                href="/" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Public Site
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}
