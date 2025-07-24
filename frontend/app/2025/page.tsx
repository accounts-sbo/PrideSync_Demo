'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Boat {
  id: number;
  name: string;
  theme: string;
  position: number;
  hearts: number;
  stars: number;
  distance?: string;
}

interface UserStats {
  totalVotes: number;
  boatsVoted: number;
  heartsGiven: number;
}

export default function PrideBoatBallot() {
  const [currentBoat, setCurrentBoat] = useState<Boat | null>(null);
  const [userVotes, setUserVotes] = useState<{[key: number]: number}>({});
  const [userStats, setUserStats] = useState<UserStats>({ totalVotes: 0, boatsVoted: 0, heartsGiven: 0 });
  const [showModal, setShowModal] = useState<'leaderboard' | 'achievements' | 'help' | 'ideas' | null>(null);
  const [boats, setBoats] = useState<Boat[]>([]);

  // Mock data - in productie zou dit van de API komen
  useEffect(() => {
    const mockBoats: Boat[] = [
      { id: 1, name: "Rainbow Warriors", theme: "Music & Dance", position: 1, hearts: 127, stars: 89 },
      { id: 2, name: "Pride & Joy", theme: "Love & Unity", position: 2, hearts: 98, stars: 76 },
      { id: 3, name: "Spectrum Sailors", theme: "Diversity", position: 3, hearts: 156, stars: 92 },
      { id: 4, name: "Unity Float", theme: "Together Strong", position: 4, hearts: 84, stars: 67 },
      { id: 5, name: "Love Boat Amsterdam", theme: "Acceptance", position: 5, hearts: 112, stars: 78 }
    ];
    
    setBoats(mockBoats);
    setCurrentBoat(mockBoats[0]); // Start met eerste boot
  }, []);

  const sendHeart = () => {
    if (!currentBoat) return;
    
    setBoats(boats.map(boat => 
      boat.id === currentBoat.id 
        ? { ...boat, hearts: boat.hearts + 1 }
        : boat
    ));
    
    setUserStats(prev => ({ 
      ...prev, 
      heartsGiven: prev.heartsGiven + 1 
    }));
  };

  const sendStar = () => {
    if (!currentBoat) return;
    
    const currentVotes = userVotes[currentBoat.id] || 0;
    if (currentVotes >= 5) return; // Max 5 sterren per boot
    
    setBoats(boats.map(boat => 
      boat.id === currentBoat.id 
        ? { ...boat, stars: boat.stars + 1 }
        : boat
    ));
    
    setUserVotes(prev => ({
      ...prev,
      [currentBoat.id]: currentVotes + 1
    }));
    
    setUserStats(prev => ({ 
      ...prev, 
      totalVotes: prev.totalVotes + 1,
      boatsVoted: Object.keys({...userVotes, [currentBoat.id]: currentVotes + 1}).length
    }));
  };

  const nextBoat = () => {
    if (!currentBoat) return;
    const currentIndex = boats.findIndex(b => b.id === currentBoat.id);
    const nextIndex = (currentIndex + 1) % boats.length;
    setCurrentBoat(boats[nextIndex]);
  };

  const sortedBoats = [...boats].sort((a, b) => b.stars - a.stars);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-500 to-blue-500">
      {/* Header */}
      <header className="pride-gradient text-white py-3 px-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            🏳️‍🌈 PrideSync
          </Link>
          <h1 className="text-sm font-semibold">Pride Boat Ballot 2025</h1>
        </div>
      </header>

      {/* Main Voting Area */}
      <div className="h-[50vh] flex">
        {/* Hearts Section */}
        <div 
          className="flex-1 bg-gradient-to-br from-pink-400 to-pink-600 flex flex-col items-center justify-center text-white cursor-pointer active:scale-95 transition-transform"
          onClick={sendHeart}
        >
          <div className="text-6xl mb-4">💖</div>
          <div className="text-lg font-semibold">Swipe up</div>
          <div className="text-sm opacity-90">Send Love</div>
        </div>

        {/* Stars Section */}
        <div 
          className="flex-1 bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center text-white cursor-pointer active:scale-95 transition-transform"
          onClick={sendStar}
        >
          <div className="text-6xl mb-4">⭐</div>
          <div className="text-lg font-semibold">Swipe up</div>
          <div className="text-sm opacity-90">Give Stars</div>
          {currentBoat && (
            <div className="text-xs mt-2 opacity-75">
              {userVotes[currentBoat.id] || 0}/5 used
            </div>
          )}
        </div>
      </div>

      {/* Current Boat Info */}
      {currentBoat && (
        <div className="bg-gradient-to-r from-blue-400 to-purple-500 text-white p-4 mx-4 rounded-lg mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold">
                #{currentBoat.position}
              </div>
              <div>
                <h2 className="text-lg font-bold">{currentBoat.name}</h2>
                <p className="text-sm opacity-90">{currentBoat.theme}</p>
              </div>
            </div>
            <button 
              onClick={nextBoat}
              className="bg-white bg-opacity-20 rounded-full p-2"
            >
              ⏭️
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <span>💖</span>
              <span className="font-semibold">{currentBoat.hearts}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>⭐</span>
              <span className="font-semibold">{currentBoat.stars}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-2 gap-4 p-4 mt-4">
        <button
          onClick={() => setShowModal('achievements')}
          className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white p-6 rounded-xl text-center"
        >
          <div className="text-3xl mb-2">🏆</div>
          <div className="font-semibold">Achievements</div>
          <div className="text-sm opacity-90">{userStats.totalVotes} unlocked</div>
        </button>

        <button
          onClick={() => setShowModal('leaderboard')}
          className="bg-gradient-to-br from-purple-400 to-pink-500 text-white p-6 rounded-xl text-center"
        >
          <div className="text-3xl mb-2">🏆</div>
          <div className="font-semibold">Top 3</div>
          <div className="text-sm opacity-90">Leaderboard</div>
        </button>

        <button
          onClick={() => setShowModal('ideas')}
          className="bg-gradient-to-br from-green-400 to-blue-500 text-white p-6 rounded-xl text-center"
        >
          <div className="text-3xl mb-2">💡</div>
          <div className="font-semibold">Ideas</div>
          <div className="text-sm opacity-90">Suggestions</div>
        </button>

        <button
          onClick={() => setShowModal('help')}
          className="bg-gradient-to-br from-red-400 to-pink-500 text-white p-6 rounded-xl text-center"
        >
          <div className="text-3xl mb-2">❓</div>
          <div className="font-semibold">Help</div>
          <div className="text-sm opacity-90">FAQ</div>
        </button>
      </div>

      {/* PrideSync Live Button */}
      <div className="text-center p-4">
        <button className="bg-red-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg">
          🔴 PrideSync Live
        </button>
      </div>

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {showModal === 'leaderboard' && '🏆 Leaderboard'}
                  {showModal === 'achievements' && '🏆 Your Achievements'}
                  {showModal === 'help' && '❓ Help & FAQ'}
                  {showModal === 'ideas' && '💡 Ideas for 2026'}
                </h3>
                <button 
                  onClick={() => setShowModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {showModal === 'leaderboard' && (
                <div className="space-y-3">
                  {sortedBoats.slice(0, 10).map((boat, index) => (
                    <div key={boat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold">{boat.name}</div>
                          <div className="text-sm text-gray-600">{boat.theme}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-purple-600">{boat.stars} ⭐</div>
                        <div className="text-sm text-gray-500">{boat.hearts} 💖</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showModal === 'achievements' && (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg">
                    <div className="text-3xl mb-2">🎉</div>
                    <div className="font-bold text-lg">Your Stats</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div>⭐ {userStats.totalVotes} votes cast</div>
                      <div>🚢 {userStats.boatsVoted} boats voted for</div>
                      <div>💖 {userStats.heartsGiven} hearts sent</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className={`p-3 rounded-lg ${userStats.totalVotes >= 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      🌟 First Vote - Cast your first star
                    </div>
                    <div className={`p-3 rounded-lg ${userStats.totalVotes >= 5 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      🎯 Active Voter - Cast 5 stars
                    </div>
                    <div className={`p-3 rounded-lg ${userStats.boatsVoted >= 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      🚢 Boat Explorer - Vote for 3 different boats
                    </div>
                    <div className={`p-3 rounded-lg ${userStats.heartsGiven >= 10 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      💖 Love Spreader - Send 10 hearts
                    </div>
                  </div>
                </div>
              )}

              {showModal === 'help' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Hoe werkt stemmen?</h4>
                    <p className="text-sm text-gray-600">Tap op de ster-kant om te stemmen. Je kunt maximaal 5 sterren per boot geven.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Wat zijn hartjes?</h4>
                    <p className="text-sm text-gray-600">Hartjes zijn onbeperkt en tonen je waardering. Tap op de hart-kant om liefde te sturen!</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Hoe wissel ik van boot?</h4>
                    <p className="text-sm text-gray-600">Gebruik de pijl-knop naast de bootnaam om naar de volgende boot te gaan.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Wanneer sluit het stemmen?</h4>
                    <p className="text-sm text-gray-600">Stemmen sluit om 18:00 na afloop van de parade.</p>
                  </div>
                </div>
              )}

              {showModal === 'ideas' && (
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Jouw idee voor WorldPride 2026</label>
                    <textarea 
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      rows={4}
                      placeholder="Deel je idee voor een nog betere PrideSync ervaring..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email (optioneel)</label>
                    <input 
                      type="email"
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="je@email.com"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold"
                  >
                    💡 Verstuur Idee
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
