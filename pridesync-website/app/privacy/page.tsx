import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Terug naar hoofdpagina
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Privacy Verklaring
        </h1>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">
              Gegevensverzameling
            </h2>
            <p className="text-gray-600">
              PrideSync verzamelt alleen de gegevens die noodzakelijk zijn voor het functioneren 
              van het parade coördinatiesysteem. Dit omvat GPS-locaties van boten, stemgegevens 
              van kijkers (anoniem), en technische logs voor systeembeheer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">
              Gebruik van Gegevens
            </h2>
            <p className="text-gray-600">
              Verzamelde gegevens worden uitsluitend gebruikt voor:
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li>Real-time coördinatie van de Pride parade</li>
              <li>Veiligheidsmonitoring en emergency response</li>
              <li>Anonieme statistieken en publieksprijs bepaling</li>
              <li>Technische systeemoptimalisatie</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">
              Gegevensbeveiliging
            </h2>
            <p className="text-gray-600">
              Alle gegevens worden beveiligd opgeslagen en versleuteld getransmitteerd. 
              Toegang is beperkt tot geautoriseerd personeel en wordt gelogd voor auditdoeleinden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">
              Contact
            </h2>
            <p className="text-gray-600">
              Voor vragen over privacy kunt u contact opnemen via:{' '}
              <a href="mailto:privacy@pridesync.nl" className="text-blue-600 hover:text-blue-700">
                privacy@pridesync.nl
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
