import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Terug naar hoofdpagina
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Support & Help
        </h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Emergency Contact */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-4">
              🚨 Noodgevallen
            </h2>
            <p className="text-red-700 mb-4">
              Voor acute noodsituaties tijdens de parade:
            </p>
            <div className="space-y-2">
              <a href="tel:112" className="block bg-red-600 text-white text-center py-3 rounded-lg font-bold hover:bg-red-700">
                📞 Bel 112
              </a>
              <a href="tel:+31612345678" className="block bg-red-500 text-white text-center py-2 rounded-lg hover:bg-red-600">
                Pride Control: +31 6 1234 5678
              </a>
            </div>
          </div>

          {/* Technical Support */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-blue-800 mb-4">
              🔧 Technische Support
            </h2>
            <p className="text-blue-700 mb-4">
              Voor technische problemen met de apps:
            </p>
            <div className="space-y-2">
              <a href="mailto:support@pridesync.nl" className="block bg-blue-600 text-white text-center py-2 rounded-lg hover:bg-blue-700">
                📧 support@pridesync.nl
              </a>
              <a href="tel:+31612345679" className="block bg-blue-500 text-white text-center py-2 rounded-lg hover:bg-blue-600">
                📞 +31 6 1234 5679
              </a>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-lg shadow-md p-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Veelgestelde Vragen
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Hoe werkt de schippers app?
              </h3>
              <p className="text-gray-600">
                De schippers app toont je positie in een 5-zone systeem. Groen betekent perfecte positie, 
                oranje betekent aanpassing nodig, rood betekent urgent actie vereist.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Kan ik mijn stem wijzigen in de kijkers app?
              </h3>
              <p className="text-gray-600">
                Ja, je kunt je stem altijd wijzigen door op een andere boot te stemmen. 
                Je vorige stem wordt automatisch ingetrokken.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Wat gebeurt er bij een calamiteit?
              </h3>
              <p className="text-gray-600">
                Bij een calamiteit wordt automatisch Pride Control geïnformeerd. 
                Andere boten krijgen instructies om de situatie te omzeilen.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Werkt het systeem zonder internet?
              </h3>
              <p className="text-gray-600">
                Het systeem heeft een internetverbinding nodig voor real-time updates. 
                Bij verbindingsproblemen wordt de laatste bekende status getoond.
              </p>
            </div>
          </div>
        </div>

        {/* App Links */}
        <div className="bg-white rounded-lg shadow-md p-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Snelle Links
          </h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/2025" className="bg-pink-100 hover:bg-pink-200 p-4 rounded-lg text-center transition-colors">
              <div className="text-2xl mb-2">👥</div>
              <div className="font-semibold text-pink-800">Kijkers App</div>
            </Link>
            
            <Link href="/skipper" className="bg-blue-100 hover:bg-blue-200 p-4 rounded-lg text-center transition-colors">
              <div className="text-2xl mb-2">⚓</div>
              <div className="font-semibold text-blue-800">Schippers App</div>
            </Link>
            
            <a href="https://pridesync-frontend-1gwklbmws-something-breaks-outs-projects.vercel.app" 
               target="_blank" 
               rel="noopener noreferrer"
               className="bg-purple-100 hover:bg-purple-200 p-4 rounded-lg text-center transition-colors">
              <div className="text-2xl mb-2">🎛️</div>
              <div className="font-semibold text-purple-800">Control Dashboard</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
