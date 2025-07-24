'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Boat {
  id: number;
  name: string;
  description?: string;
  votes: number;
  position: number;
  status: string;
}

export default function ViewerApp() {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock data - in productie zou dit van de API komen
  useEffect(() => {
    const mockBoats: Boat[] = [
      {
        id: 1,
        name: "Rainbow Warriors",
        description: "Een prachtige boot vol kleur en diversiteit",
        votes: 42,
        position: 1,
        status: "active"
      },
      {
        id: 2,
        name: "Pride & Joy",
        description: "Muziek, dans en pure vreugde op het water",
        votes: 38,
        position: 2,
        status: "active"
      },
      {
        id: 3,
        name: "Love Boat Amsterdam",
        description: "Liefde en acceptatie voor iedereen",
        votes: 35,
        position: 3,
        status: "active"
      },
      {
        id: 4,
        name: "Unity Float",
        description: "Samen staan we sterk",
        votes: 29,
        position: 4,
        status: "waiting"
      },
      {
        id: 5,
        name: "Spectrum Sailors",
        description: "Alle kleuren van de regenboog",
        votes: 31,
        position: 5,
        status: "waiting"
      }
    ];

    setTimeout(() => {
      setBoats(mockBoats);
      setLoading(false);
    }, 1000);
  }, []);

  const handleVote = (boatId: number) => {
    if (userVote === boatId) {
      // Remove vote
      setUserVote(null);
      setBoats(boats.map(boat => 
        boat.id === boatId 
          ? { ...boat, votes: boat.votes - 1 }
          : boat
      ));
    } else {
      // Add new vote, remove old vote if exists
      setBoats(boats.map(boat => {
        if (boat.id === boatId) {
          return { ...boat, votes: boat.votes + 1 };
        } else if (boat.id === userVote) {
          return { ...boat, votes: boat.votes - 1 };
        }
        return boat;
      }));
      setUserVote(boatId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      case 'finished': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Actief in parade';
      case 'waiting': return 'Wachtend';
      case 'finished': return 'Gefinisht';
      default: return 'Onbekend';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden van parade informatie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Header */}
      <header className="pride-gradient text-white py-4 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold">
              🏳️‍🌈 PrideSync
            </Link>
            <h1 className="text-lg font-semibold">
              Kijkers App 2025
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Message */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Welkom bij de Pride Parade 2025! 🎉
          </h2>
          <p className="text-gray-600">
            Stem op je favoriete boot en ontdek meer over de deelnemers. 
            Je stem helpt ons de publieksprijs te bepalen!
          </p>
        </div>

        {/* Voting Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">Hoe werkt het stemmen?</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Tap op een boot om meer informatie te zien</li>
            <li>• Tap op het hart om te stemmen</li>
            <li>• Je kunt je stem altijd wijzigen</li>
            <li>• Stemmen sluit om 18:00</li>
          </ul>
        </div>

        {/* Boats List */}
        <div className="space-y-4">
          {boats
            .sort((a, b) => b.votes - a.votes)
            .map((boat, index) => (
            <div 
              key={boat.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl font-bold text-gray-400">
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {boat.name}
                      </h3>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(boat.status)}`}>
                        {getStatusText(boat.status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-pink-600">
                      {boat.votes}
                    </div>
                    <div className="text-xs text-gray-500">stemmen</div>
                  </div>
                </div>

                {boat.description && (
                  <p className="text-gray-600 mb-3 text-sm">
                    {boat.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedBoat(boat)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Meer info →
                  </button>
                  
                  <button
                    onClick={() => handleVote(boat.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${
                      userVote === boat.id
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-pink-100'
                    }`}
                  >
                    <span className="text-lg">
                      {userVote === boat.id ? '❤️' : '🤍'}
                    </span>
                    <span className="text-sm font-medium">
                      {userVote === boat.id ? 'Gestemd!' : 'Stem'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Current Vote Status */}
        {userVote && (
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mt-6">
            <div className="flex items-center space-x-2">
              <span className="text-pink-600">❤️</span>
              <span className="text-pink-800 font-medium">
                Je hebt gestemd op: {boats.find(b => b.id === userVote)?.name}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Boat Detail Modal */}
      {selectedBoat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  {selectedBoat.name}
                </h3>
                <button
                  onClick={() => setSelectedBoat(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedBoat.status)}`}>
                    {getStatusText(selectedBoat.status)}
                  </span>
                </div>
                
                <p className="text-gray-600">
                  {selectedBoat.description || "Geen beschrijving beschikbaar."}
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-pink-600 mb-1">
                      {selectedBoat.votes}
                    </div>
                    <div className="text-sm text-gray-500">
                      stemmen ontvangen
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    handleVote(selectedBoat.id);
                    setSelectedBoat(null);
                  }}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    userVote === selectedBoat.id
                      ? 'bg-pink-600 text-white'
                      : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                  }`}
                >
                  {userVote === selectedBoat.id ? '❤️ Gestemd!' : '🤍 Stem op deze boot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
