'use client';

import { useState, useEffect, useCallback } from 'react';

interface SkipperData {
  boatNumber: number;
  boatName: string;
  currentPosition: number; // 1-5 (1=te ver vooruit, 3=perfect, 5=te ver achter)
  targetPosition: number;
  speed: number;
  lastUpdate: string;
  emergencyActive: boolean;
}

export default function SkipperApp() {
  const [skipperData, setSkipperData] = useState<SkipperData>({
    boatNumber: 42,
    boatName: "Rainbow Warrior",
    currentPosition: 3, // Start in green zone
    targetPosition: 3,
    speed: 5.2,
    lastUpdate: new Date().toLocaleTimeString('nl-NL'),
    emergencyActive: false
  });

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');

  // Simuleer real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSkipperData(prev => ({
        ...prev,
        lastUpdate: new Date().toLocaleTimeString('nl-NL'),
        // Simuleer kleine positie wijzigingen
        currentPosition: Math.max(1, Math.min(5, prev.currentPosition + (Math.random() - 0.5) * 0.3))
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getZoneInfo = (position: number) => {
    if (position <= 1.5) {
      return {
        zone: 1,
        color: 'corridor-red',
        textColor: 'text-white',
        message: 'TE VER VOORUIT',
        instruction: 'Vertraag of stop om terug naar groene zone te gaan',
        urgency: 'URGENT'
      };
    } else if (position <= 2.5) {
      return {
        zone: 2,
        color: 'corridor-orange',
        textColor: 'text-white',
        message: 'IETS TE VOORUIT',
        instruction: 'Vertraag lichtjes om in groene zone te komen',
        urgency: 'LET OP'
      };
    } else if (position <= 3.5) {
      return {
        zone: 3,
        color: 'corridor-green',
        textColor: 'text-white',
        message: 'PERFECTE POSITIE',
        instruction: 'Handhaaf huidige snelheid en koers',
        urgency: 'GOED'
      };
    } else if (position <= 4.5) {
      return {
        zone: 4,
        color: 'corridor-orange',
        textColor: 'text-white',
        message: 'IETS TE ACHTER',
        instruction: 'Verhoog snelheid om in groene zone te komen',
        urgency: 'LET OP'
      };
    } else {
      return {
        zone: 5,
        color: 'corridor-red',
        textColor: 'text-white',
        message: 'TE VER ACHTER',
        instruction: 'Verhoog snelheid of meld calamiteit',
        urgency: 'URGENT'
      };
    }
  };

  const handleEmergency = useCallback(() => {
    setShowEmergencyModal(true);
  }, []);

  const submitEmergency = useCallback(() => {
    setSkipperData(prev => ({
      ...prev,
      emergencyActive: true
    }));
    setShowEmergencyModal(false);
    setEmergencyReason('');
    
    // Simuleer dat emergency na 30 seconden wordt opgelost
    setTimeout(() => {
      setSkipperData(prev => ({
        ...prev,
        emergencyActive: false
      }));
    }, 30000);
  }, [emergencyReason]);

  const zoneInfo = getZoneInfo(skipperData.currentPosition);

  return (
    <div className="mobile-full-height bg-gray-900 text-white flex flex-col">
      {/* Header - Compact */}
      <header className="bg-gray-800 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Boot #{skipperData.boatNumber}</h1>
            <p className="text-sm text-gray-300">{skipperData.boatName}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-300">Snelheid</div>
            <div className="text-lg font-bold">{skipperData.speed.toFixed(1)} km/h</div>
          </div>
        </div>
      </header>

      {/* Emergency Status */}
      {skipperData.emergencyActive && (
        <div className="bg-red-600 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-center space-x-2">
            <span className="animate-pulse text-xl">🚨</span>
            <span className="font-bold">CALAMITEIT GEMELD</span>
            <span className="animate-pulse text-xl">🚨</span>
          </div>
        </div>
      )}

      {/* Main Corridor Display */}
      <div className="flex-1 flex flex-col">
        {/* Zone 1 - Te ver vooruit (Rood) */}
        <div className={`flex-1 corridor-red flex items-center justify-center ${
          zoneInfo.zone === 1 ? 'ring-4 ring-yellow-400' : ''
        }`}>
          <div className="text-center px-4">
            <div className="text-4xl font-bold mb-2">1</div>
            <div className="text-lg font-bold">TE VER VOORUIT</div>
            <div className="text-sm opacity-90">VERTRAAG</div>
          </div>
        </div>

        {/* Zone 2 - Iets te vooruit (Oranje) */}
        <div className={`flex-1 corridor-orange flex items-center justify-center ${
          zoneInfo.zone === 2 ? 'ring-4 ring-yellow-400' : ''
        }`}>
          <div className="text-center px-4">
            <div className="text-4xl font-bold mb-2">2</div>
            <div className="text-lg font-bold">IETS TE VOORUIT</div>
            <div className="text-sm opacity-90">LANGZAMER</div>
          </div>
        </div>

        {/* Zone 3 - Perfect (Groen) */}
        <div className={`flex-1 corridor-green flex items-center justify-center ${
          zoneInfo.zone === 3 ? 'ring-4 ring-yellow-400' : ''
        }`}>
          <div className="text-center px-4">
            <div className="text-5xl font-bold mb-2">3</div>
            <div className="text-xl font-bold">PERFECTE POSITIE</div>
            <div className="text-lg opacity-90">✅ HANDHAAF KOERS</div>
          </div>
        </div>

        {/* Zone 4 - Iets te achter (Oranje) */}
        <div className={`flex-1 corridor-orange flex items-center justify-center ${
          zoneInfo.zone === 4 ? 'ring-4 ring-yellow-400' : ''
        }`}>
          <div className="text-center px-4">
            <div className="text-4xl font-bold mb-2">4</div>
            <div className="text-lg font-bold">IETS TE ACHTER</div>
            <div className="text-sm opacity-90">SNELLER</div>
          </div>
        </div>

        {/* Zone 5 - Te ver achter (Rood) */}
        <div className={`flex-1 corridor-red flex items-center justify-center ${
          zoneInfo.zone === 5 ? 'ring-4 ring-yellow-400' : ''
        }`}>
          <div className="text-center px-4">
            <div className="text-4xl font-bold mb-2">5</div>
            <div className="text-lg font-bold">TE VER ACHTER</div>
            <div className="text-sm opacity-90">INHALEN</div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-800 px-4 py-4 flex-shrink-0">
        {/* Current Status */}
        <div className="text-center mb-4">
          <div className="text-sm text-gray-300 mb-1">Huidige instructie:</div>
          <div className="text-lg font-bold text-yellow-400">
            {zoneInfo.instruction}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleEmergency}
            disabled={skipperData.emergencyActive}
            className={`py-3 px-4 rounded-lg font-bold transition-colors ${
              skipperData.emergencyActive
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            🚨 CALAMITEIT
          </button>
          
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-bold transition-colors"
            onClick={() => {
              // Simuleer contact met control
              alert('Verbinding met Pride Control...');
            }}
          >
            📞 CONTACT
          </button>
        </div>

        {/* Last Update */}
        <div className="text-center mt-3 text-xs text-gray-400">
          Laatste update: {skipperData.lastUpdate}
        </div>
      </div>

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white text-black rounded-lg max-w-sm w-full p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">
              🚨 Calamiteit Melden
            </h3>
            
            <div className="space-y-3 mb-6">
              {[
                'Technisch probleem',
                'Medische noodsituatie',
                'Weersomstandigheden',
                'Obstakel in water',
                'Anders'
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setEmergencyReason(reason)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    emergencyReason === reason
                      ? 'bg-red-100 border-red-500 text-red-700'
                      : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="flex-1 py-2 px-4 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={submitEmergency}
                disabled={!emergencyReason}
                className={`flex-1 py-2 px-4 rounded font-bold transition-colors ${
                  emergencyReason
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Melden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
