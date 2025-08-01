'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

interface Boat {
  id: number;
  name: string;
  theme: string;
  organisation?: string;
  position: number;
  hearts: number;
  stars: number;
  distance?: string;
  lat?: number;
  lon?: number;
}

interface UserStats {
  totalVotes: number;
  boatsVoted: number;
  heartsGiven: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: UserStats) => boolean;
  unlocked: boolean;
  unlockedAt?: Date;
}

interface UserLocation {
  lat: number;
  lon: number;
  timestamp: number;
}

interface NearestBoatInfo {
  boat: Boat;
  distance: number;
  distanceText: string;
}

// Heart Animation Component
const HeartAnimation = ({ x, y }: { x: number, y: number }) => {

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: x - 30,
        top: y - 30,
        animation: 'floatUp 1.5s ease-out forwards'
      }}
    >
      <div className="flex space-x-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="text-3xl drop-shadow-lg"
            style={{
              animation: `floatHeart 1.5s ease-out forwards`,
              animationDelay: `${i * 0.15}s`,
              filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))'
            }}
          >
            💖
          </div>
        ))}
      </div>
    </div>
  );
};

// Star Animation Component
const StarAnimation = ({ x, y }: { x: number, y: number }) => {

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: x - 30,
        top: y - 30,
        animation: 'floatUp 1.5s ease-out forwards'
      }}
    >
      <div className="flex space-x-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="text-3xl drop-shadow-lg"
            style={{
              animation: `floatHeart 1.5s ease-out forwards`,
              animationDelay: `${i * 0.15}s`,
              filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))'
            }}
          >
            ⭐
          </div>
        ))}
      </div>
    </div>
  );
};

export default function PrideBoatBallot() {
  const [currentBoat, setCurrentBoat] = useState<Boat | null>(null);
  const [userVotes, setUserVotes] = useState<{[key: number]: number}>({});
  const [userStats, setUserStats] = useState<UserStats>({ totalVotes: 0, boatsVoted: 0, heartsGiven: 0 });
  const [showModal, setShowModal] = useState<'leaderboard' | 'achievements' | 'help' | 'ideas' | null>(null);
  const [boats, setBoats] = useState<Boat[]>([]);

  // GPS related state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [nearestBoat, setNearestBoat] = useState<NearestBoatInfo | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showGpsOverlay, setShowGpsOverlay] = useState(true);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Swipe and animation state
  const [heartAnimations, setHeartAnimations] = useState<Array<{id: string, x: number, y: number}>>([]);
  const [lastHeartTime, setLastHeartTime] = useState(0);
  const [isHeartCooldown, setIsHeartCooldown] = useState(false);
  const [votingInProgress, setVotingInProgress] = useState(false);

  // Star animation state
  const [starAnimations, setStarAnimations] = useState<Array<{id: string, x: number, y: number}>>([]);
  const [lastStarTime, setLastStarTime] = useState(0);
  const [isStarCooldown, setIsStarCooldown] = useState(false);
  const [starTouchStart, setStarTouchStart] = useState<{x: number, y: number, time: number} | null>(null);

  // Achievements state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showAchievementPopup, setShowAchievementPopup] = useState<Achievement | null>(null);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Power Hour tracking
  const [powerHourVotes, setPowerHourVotes] = useState<number[]>([]);

  // Boat-specific tracking for complex achievements
  const [boatHearts, setBoatHearts] = useState<{[key: number]: boolean}>({});
  const [boatStars, setBoatStars] = useState<{[key: number]: number}>({});

  // Define achievements - Volledige, definitieve lijst (1–15)
  const achievementDefinitions: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
    {
      id: 'first_love',
      name: 'First Love ❤️',
      description: 'Eerste like',
      icon: '❤️',
      condition: (stats) => stats.heartsGiven >= 1
    },
    {
      id: 'starstruck',
      name: 'Starstruck ⭐️',
      description: 'Eerste ster',
      icon: '⭐️',
      condition: (stats) => stats.totalVotes >= 1
    },
    {
      id: 'full_shine',
      name: 'Full Shine ✨',
      description: '5 sterren op 1 boot',
      icon: '✨',
      condition: (stats) => {
        // Check if any boat has 5 stars from this user
        return Object.values(userVotes).some(votes => votes >= 5);
      }
    },
    {
      id: 'swipe_master',
      name: 'Swipe Master 🎯',
      description: '10 boten gestemd',
      icon: '🎯',
      condition: (stats) => stats.boatsVoted >= 10
    },
    {
      id: 'lover_not_fighter',
      name: 'Lover, Not a Fighter 💘',
      description: '25 hartjes',
      icon: '💘',
      condition: (stats) => stats.heartsGiven >= 25
    },
    {
      id: 'critics_choice',
      name: 'Critic\'s Choice 🧠',
      description: '25 sterren',
      icon: '🧠',
      condition: (stats) => stats.totalVotes >= 25
    },
    {
      id: 'perfect_match',
      name: 'Perfect Match 💞',
      description: 'Hartje + 3 sterren op 1 boot',
      icon: '💞',
      condition: (stats) => {
        const perfectMatchBoats = localStorage.getItem('perfectMatchBoats');
        return perfectMatchBoats ? JSON.parse(perfectMatchBoats).length > 0 : false;
      }
    },
    {
      id: 'boat_fanatic',
      name: 'Boat Fanatic 🛥️',
      description: '40+ boten gestemd',
      icon: '🛥️',
      condition: (stats) => stats.boatsVoted >= 40
    },
    {
      id: 'all_in',
      name: 'All In 🌈',
      description: '5 sterren + hartje op 1 boot',
      icon: '🌈',
      condition: (stats) => {
        const allInBoats = localStorage.getItem('allInBoats');
        return allInBoats ? JSON.parse(allInBoats).length > 0 : false;
      }
    },
    {
      id: 'power_hour',
      name: 'Power Hour ⏱️',
      description: '50 stemmen in 1 uur',
      icon: '⏱️',
      condition: (stats) => {
        const powerHourAchieved = localStorage.getItem('powerHourAchieved');
        return powerHourAchieved === 'true';
      }
    },
    {
      id: 'pride_legend',
      name: 'Pride Legend 🌟',
      description: 'Alle 1–10 achievements behaald',
      icon: '🌟',
      condition: (stats) => {
        const firstTenIds = ['first_love', 'starstruck', 'full_shine', 'swipe_master', 'lover_not_fighter', 'critics_choice', 'perfect_match', 'boat_fanatic', 'all_in', 'power_hour'];
        return firstTenIds.every(id => achievements.find(a => a.id === id)?.unlocked);
      }
    },
    {
      id: 'heart_storm',
      name: 'Heart Storm 💓',
      description: '150 hartjes',
      icon: '💓',
      condition: (stats) => stats.heartsGiven >= 150
    },
    {
      id: 'love_machine',
      name: 'Love Machine ❤️‍🔥',
      description: '200 hartjes',
      icon: '❤️‍🔥',
      condition: (stats) => stats.heartsGiven >= 200
    },
    {
      id: 'star_collector',
      name: 'Star Collector 🌠',
      description: '100 sterren',
      icon: '🌠',
      condition: (stats) => stats.totalVotes >= 100
    },
    {
      id: 'pride_perfection',
      name: 'Pride Perfection 👑',
      description: 'Alle 14 bovenstaande behaald',
      icon: '👑',
      condition: (stats) => {
        const firstFourteenIds = ['first_love', 'starstruck', 'full_shine', 'swipe_master', 'lover_not_fighter', 'critics_choice', 'perfect_match', 'boat_fanatic', 'all_in', 'power_hour', 'pride_legend', 'heart_storm', 'love_machine', 'star_collector'];
        return firstFourteenIds.every(id => achievements.find(a => a.id === id)?.unlocked);
      }
    }
  ];

  // Initialize achievements and tracking data
  const initializeAchievements = () => {
    const savedAchievements = localStorage.getItem('achievements');
    let needsReset = false;

    if (savedAchievements) {
      const parsed = JSON.parse(savedAchievements);
      // Check if we have the correct number of achievements (15)
      if (parsed.length !== 15) {
        console.log(`Resetting achievements: found ${parsed.length}, expected 15`);
        needsReset = true;
      } else {
        setAchievements(parsed);
      }
    } else {
      needsReset = true;
    }

    if (needsReset) {
      const initialAchievements = achievementDefinitions.map(def => ({
        ...def,
        unlocked: false
      }));
      setAchievements(initialAchievements);
      localStorage.setItem('achievements', JSON.stringify(initialAchievements));
      console.log('Initialized 15 achievements');
    }

    // Load tracking data
    const savedBoatHearts = localStorage.getItem('boatHearts');
    if (savedBoatHearts) {
      setBoatHearts(JSON.parse(savedBoatHearts));
    }

    const savedBoatStars = localStorage.getItem('boatStars');
    if (savedBoatStars) {
      setBoatStars(JSON.parse(savedBoatStars));
    }
  };

  // Track Power Hour votes
  const trackPowerHourVote = () => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Add current vote timestamp
    const newVotes = [...powerHourVotes, now];

    // Filter votes from last hour
    const recentVotes = newVotes.filter(timestamp => timestamp > oneHourAgo);

    setPowerHourVotes(recentVotes);

    // Check if Power Hour achievement is unlocked
    if (recentVotes.length >= 50) {
      localStorage.setItem('powerHourAchieved', 'true');
      return true;
    }

    return false;
  };

  // Check Perfect Match achievement (heart + 3 stars on same boat)
  const checkPerfectMatch = (boatId: number) => {
    const hasHeart = boatHearts[boatId];
    const starCount = boatStars[boatId] || 0;

    if (hasHeart && starCount >= 3) {
      const perfectMatchBoats = JSON.parse(localStorage.getItem('perfectMatchBoats') || '[]');
      if (!perfectMatchBoats.includes(boatId)) {
        perfectMatchBoats.push(boatId);
        localStorage.setItem('perfectMatchBoats', JSON.stringify(perfectMatchBoats));
        return true;
      }
    }
    return false;
  };

  // Check All In achievement (5 stars + heart on same boat)
  const checkAllIn = (boatId: number) => {
    const hasHeart = boatHearts[boatId];
    const starCount = boatStars[boatId] || 0;

    if (hasHeart && starCount >= 5) {
      const allInBoats = JSON.parse(localStorage.getItem('allInBoats') || '[]');
      if (!allInBoats.includes(boatId)) {
        allInBoats.push(boatId);
        localStorage.setItem('allInBoats', JSON.stringify(allInBoats));
        return true;
      }
    }
    return false;
  };

  // Check for new achievements
  const checkAchievements = (stats: UserStats) => {
    const currentAchievements = [...achievements];
    let hasNewAchievement = false;

    achievementDefinitions.forEach(def => {
      const achievement = currentAchievements.find(a => a.id === def.id);
      if (achievement && !achievement.unlocked && def.condition(stats)) {
        achievement.unlocked = true;
        achievement.unlockedAt = new Date();
        hasNewAchievement = true;
        setNewAchievement(achievement);

        // Show achievement popup
        setTimeout(() => {
          setShowAchievementPopup(achievement);
        }, 500);
      }
    });

    if (hasNewAchievement) {
      setAchievements(currentAchievements);
      localStorage.setItem('achievements', JSON.stringify(currentAchievements));
    }
  };

  // Get latest unlocked achievement for display
  const getLatestAchievement = () => {
    const unlockedAchievements = achievements.filter(a => a.unlocked);
    if (unlockedAchievements.length === 0) return null;

    return unlockedAchievements.reduce((latest, current) => {
      if (!latest.unlockedAt || !current.unlockedAt) return latest;
      return current.unlockedAt > latest.unlockedAt ? current : latest;
    });
  };

  // Debug function to reset achievements
  const resetAchievements = () => {
    localStorage.removeItem('achievements');
    localStorage.removeItem('boatHearts');
    localStorage.removeItem('boatStars');
    localStorage.removeItem('perfectMatchBoats');
    localStorage.removeItem('allInBoats');
    localStorage.removeItem('powerHourAchieved');
    initializeAchievements();
    console.log('All achievements reset');
  };

  // Load boats from API
  useEffect(() => {
    loadBoats();
    loadUserStats();
    initializeAchievements();
  }, []);

  // Debug: Log achievements count when they change
  useEffect(() => {
    console.log(`Achievements loaded: ${achievements.length}/15`);
    if (achievements.length > 0) {
      console.log('Achievement IDs:', achievements.map(a => a.id));
    }
  }, [achievements]);

  // GPS functions
  const requestLocationPermission = async () => {
    try {
      setGpsError(null);
      const position = await api.gps.getCurrentPosition();

      const location: UserLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        timestamp: Date.now()
      };

      setUserLocation(location);
      setGpsEnabled(true);

      // Find nearest boat immediately
      await findNearestBoat(location.lat, location.lon);

      // Start watching position for updates
      const watchId = await api.gps.watchPosition(
        async (position) => {
          const newLocation: UserLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: Date.now()
          };
          setUserLocation(newLocation);
          await findNearestBoat(newLocation.lat, newLocation.lon);
        },
        (error) => {
          console.error('GPS watch error:', error);
          setGpsError('GPS tracking error: ' + error.message);
        }
      );

      setGpsWatchId(watchId);

    } catch (error: any) {
      console.error('GPS permission error:', error);
      setGpsEnabled(false);

      // Handle different GPS error types
      if (error.code === 1) {
        setGpsError('Locatie toegang geweigerd. Geef toestemming in je browser instellingen.');
      } else if (error.code === 2) {
        setGpsError('Locatie niet beschikbaar. Controleer je GPS instellingen.');
      } else if (error.code === 3) {
        setGpsError('Locatie timeout. Probeer het opnieuw.');
      } else if (error.message.includes('not supported')) {
        setGpsError('GPS wordt niet ondersteund door je browser.');
      } else {
        setGpsError('GPS fout: ' + (error.message || 'Onbekende fout'));
      }
    }
  };

  const findNearestBoat = async (lat: number, lon: number) => {
    try {
      const result = await api.locations.getNearestBoat(lat, lon);

      if (result.success) {
        setNearestBoat(result.data);

        // Update current boat to nearest boat if GPS is enabled
        if (gpsEnabled && result.data.boat) {
          setCurrentBoat(result.data.boat);
        }

        // Clear any previous errors
        setGpsError(null);
      } else {
        setGpsError('Kon dichtstbijzijnde boot niet vinden');
      }
    } catch (error: any) {
      console.error('Error finding nearest boat:', error);

      // Handle different types of errors
      if (error.message.includes('fetch')) {
        setGpsError('Geen internetverbinding. Controleer je verbinding.');
      } else {
        setGpsError('Fout bij zoeken naar boten. Probeer opnieuw.');
      }
    }
  };

  const stopGpsTracking = () => {
    if (gpsWatchId !== null) {
      api.gps.clearWatch(gpsWatchId);
      setGpsWatchId(null);
    }
    setGpsEnabled(false);
    setUserLocation(null);
    setNearestBoat(null);
    setGpsError(null);
  };

  const handleGoLive = async () => {
    setIsGpsLoading(true);
    setGpsError(null);
    try {
      await requestLocationPermission();
      // Add fade out animation delay, then hide overlay
      setTimeout(() => {
        setShowGpsOverlay(false);
        setIsGpsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Failed to get location:', error);
      setGpsError('Kon locatie niet ophalen. Probeer het opnieuw.');
      setIsGpsLoading(false);
    }
  };

  // Cleanup GPS watch on unmount
  useEffect(() => {
    return () => {
      if (gpsWatchId !== null) {
        api.gps.clearWatch(gpsWatchId);
      }
    };
  }, [gpsWatchId]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadBoats = async () => {
    try {
      const result = await api.voting.getBoats();

      if (result.success && result.data.length > 0) {
        setBoats(result.data);
        setCurrentBoat(result.data[0]); // Start met eerste boot
      } else {
        // Fallback to mock data if API fails
        const mockBoats: Boat[] = [
          { id: 1, name: "Rainbow Warriors", theme: "Music & Dance", position: 1, hearts: 127, stars: 89 },
          { id: 2, name: "Pride & Joy", theme: "Love & Unity", position: 2, hearts: 98, stars: 76 },
          { id: 3, name: "Spectrum Sailors", theme: "Diversity", position: 3, hearts: 156, stars: 92 },
          { id: 4, name: "Unity Float", theme: "Together Strong", position: 4, hearts: 84, stars: 67 },
          { id: 5, name: "Love Boat Amsterdam", theme: "Acceptance", position: 5, hearts: 112, stars: 78 }
        ];
        setBoats(mockBoats);
        setCurrentBoat(mockBoats[0]);
      }
    } catch (error) {
      console.error('Error loading boats:', error);
      // Use mock data as fallback
      const mockBoats: Boat[] = [
        { id: 1, name: "Rainbow Warriors", theme: "Music & Dance", position: 1, hearts: 127, stars: 89 },
        { id: 2, name: "Pride & Joy", theme: "Love & Unity", position: 2, hearts: 98, stars: 76 },
        { id: 3, name: "Spectrum Sailors", theme: "Diversity", position: 3, hearts: 156, stars: 92 }
      ];
      setBoats(mockBoats);
      setCurrentBoat(mockBoats[0]);
    }
  };

  const getUserStarVotes = (boatId: number): number => {
    return userVotes[boatId] || 0;
  };

  const handleVote = async (boatId: number, voteType: 'heart' | 'star') => {
    if (votingInProgress) return;

    // Check star limit
    if (voteType === 'star' && getUserStarVotes(boatId) >= 5) {
      return;
    }

    setVotingInProgress(true);

    try {
      const userSession = getUserSession();
      await api.voting.vote(boatId, voteType, userSession);

      // Update boats state
      setBoats(prev => prev.map(boat =>
        boat.id === boatId
          ? {
              ...boat,
              [voteType === 'heart' ? 'hearts' : 'stars']: boat[voteType === 'heart' ? 'hearts' : 'stars'] + 1
            }
          : boat
      ));

      // Update user votes for star tracking
      if (voteType === 'star') {
        setUserVotes(prev => ({
          ...prev,
          [boatId]: (prev[boatId] || 0) + 1
        }));
      }

      // Update user stats
      const newStats = {
        ...userStats,
        totalVotes: userStats.totalVotes + 1,
        boatsVoted: voteType === 'star' && getUserStarVotes(boatId) === 0
          ? userStats.boatsVoted + 1
          : userStats.boatsVoted,
        heartsGiven: voteType === 'heart' ? userStats.heartsGiven + 1 : userStats.heartsGiven
      };
      setUserStats(newStats);

      // Check for achievements
      checkAchievements(newStats);

    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setVotingInProgress(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const userSession = getUserSession();
      const result = await api.voting.getUserVotes(userSession);

      if (result.success) {
        setUserStats({
          totalVotes: result.data.stars_given,
          boatsVoted: result.data.boats_voted,
          heartsGiven: result.data.hearts_given
        });

        // Set user votes for star limits
        const votes: {[key: number]: number} = {};
        Object.entries(result.data.votes_by_boat).forEach(([boatId, boatVotes]: [string, any]) => {
          votes[parseInt(boatId)] = boatVotes.stars || 0;
        });
        setUserVotes(votes);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const getUserSession = () => {
    let session = localStorage.getItem('pride_user_session');
    if (!session) {
      session = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('pride_user_session', session);
    }
    return session;
  };

  // Swipe detection state
  const [touchStart, setTouchStart] = useState<{x: number, y: number, time: number} | null>(null);

  // Swipe detection functions
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showGpsOverlay) return; // Disable swipe when GPS overlay is shown
    const touch = e.touches[0];
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || showGpsOverlay) return; // Disable swipe when GPS overlay is shown

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStart.time;

    // Check if it's a swipe up (negative deltaY means up)
    const isSwipeUp = deltaY < -50 && Math.abs(deltaX) < 100 && deltaTime < 500;



    if (isSwipeUp) {
      e.preventDefault();
      triggerHeartAnimation(touch.clientX, touch.clientY);
      sendHeart();
    }

    setTouchStart(null);
  };

  // Star swipe detection functions
  const handleStarTouchStart = (e: React.TouchEvent) => {
    console.log('Star touch start detected');

    // Check conditions
    if (showGpsOverlay) {
      console.log('Star touch blocked - GPS overlay is shown');
      return;
    }
    if (isStarCooldown) {
      console.log('Star touch blocked by cooldown');
      return;
    }
    if (!currentBoat) {
      console.log('Star touch blocked - no current boat');
      return;
    }
    if ((userVotes[currentBoat.id] || 0) >= 5) {
      console.log('Star touch blocked - 5 star limit reached');
      return;
    }

    const touch = e.touches[0];
    setStarTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
  };

  const handleStarTouchEnd = (e: React.TouchEvent) => {
    if (!starTouchStart || showGpsOverlay) return; // Disable swipe when GPS overlay is shown

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - starTouchStart.x;
    const deltaY = touch.clientY - starTouchStart.y;
    const deltaTime = Date.now() - starTouchStart.time;

    // Check if it's a swipe up (negative deltaY means up)
    const isSwipeUp = deltaY < -50 && Math.abs(deltaX) < 100 && deltaTime < 500;

    console.log('Star touch end:', { deltaX, deltaY, deltaTime, isSwipeUp });

    if (isSwipeUp) {
      e.preventDefault();
      triggerStarAnimation(touch.clientX, touch.clientY);
      sendStar();
    }

    setStarTouchStart(null);
  };

  const triggerHeartAnimation = (x: number, y: number) => {
    // Check cooldown (max 1 per second)
    const now = Date.now();
    if (now - lastHeartTime < 1000) {
      return;
    }

    setLastHeartTime(now);
    setIsHeartCooldown(true);

    // Get the hearts section element to calculate relative position
    const heartsSection = document.querySelector('.hearts-section') as HTMLElement;
    if (heartsSection) {
      const rect = heartsSection.getBoundingClientRect();
      const relativeX = x - rect.left;
      const relativeY = y - rect.top;

      // Create new heart animation with relative coordinates
      const animationId = `heart-${now}-${Math.random()}`;
      setHeartAnimations(prev => [...prev, { id: animationId, x: relativeX, y: relativeY }]);

      // Remove animation after 1.5 seconds
      setTimeout(() => {
        setHeartAnimations(prev => prev.filter(anim => anim.id !== animationId));
      }, 1500);
    }

    // Reset cooldown after 1 second
    setTimeout(() => {
      setIsHeartCooldown(false);
    }, 1000);

    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Add audio feedback (simple beep using Web Audio API)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // Audio feedback failed, continue silently
      console.log('Audio feedback not available');
    }
  };

  const triggerStarAnimation = (x: number, y: number) => {
    console.log('triggerStarAnimation called with:', x, y);

    // Check cooldown (max 1 per second)
    const now = Date.now();
    if (now - lastStarTime < 1000) {
      console.log('Star animation blocked by cooldown');
      return;
    }

    // Check 5-star limit per boat
    if (!currentBoat) {
      console.log('No current boat');
      return;
    }
    const currentVotes = userVotes[currentBoat.id] || 0;
    if (currentVotes >= 5) {
      console.log('Star animation blocked by 5-star limit');
      return;
    }

    console.log('Star animation proceeding...');

    setLastStarTime(now);
    setIsStarCooldown(true);

    // Get the stars section element to calculate relative position
    const starsSection = document.querySelector('.stars-section') as HTMLElement;
    if (starsSection) {
      const rect = starsSection.getBoundingClientRect();
      const relativeX = x - rect.left;
      const relativeY = y - rect.top;

      // Create new star animation with relative coordinates
      const animationId = `star-${now}-${Math.random()}`;
      setStarAnimations(prev => [...prev, { id: animationId, x: relativeX, y: relativeY }]);

      // Remove animation after 1.5 seconds
      setTimeout(() => {
        setStarAnimations(prev => prev.filter(anim => anim.id !== animationId));
      }, 1500);
    }

    // Reset cooldown after 1 second
    setTimeout(() => {
      setIsStarCooldown(false);
    }, 1000);

    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate([30, 30, 30]); // Different pattern for stars
    }

    // Add audio feedback (higher pitch for stars)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime); // Higher pitch for stars
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // Audio feedback failed, continue silently
      console.log('Audio feedback not available');
    }
  };

  const sendHeart = async () => {
    if (!currentBoat) return;

    try {
      const userSession = getUserSession();
      await api.voting.vote(currentBoat.id, 'heart', userSession);

      // Update local state optimistically with pulse animation
      setBoats(boats.map(boat =>
        boat.id === currentBoat.id
          ? { ...boat, hearts: boat.hearts + 1 }
          : boat
      ));

      const newStats = {
        ...userStats,
        heartsGiven: userStats.heartsGiven + 1
      };

      setUserStats(newStats);

      // Track boat-specific heart
      const newBoatHearts = { ...boatHearts, [currentBoat.id]: true };
      setBoatHearts(newBoatHearts);
      localStorage.setItem('boatHearts', JSON.stringify(newBoatHearts));

      // Track Power Hour vote
      trackPowerHourVote();

      // Check complex achievements
      checkPerfectMatch(currentBoat.id);
      checkAllIn(currentBoat.id);

      // Check for new achievements
      checkAchievements(newStats);

      // Trigger pulse animation on heart counter
      const heartCounter = document.querySelector('.heart-counter');
      if (heartCounter) {
        heartCounter.classList.add('heart-pulse');
        setTimeout(() => {
          heartCounter.classList.remove('heart-pulse');
        }, 600);
      }
    } catch (error) {
      console.error('Error sending heart:', error);
    }
  };

  const sendStar = async () => {
    if (!currentBoat) return;

    const currentVotes = userVotes[currentBoat.id] || 0;
    if (currentVotes >= 5) return; // Max 5 sterren per boot

    try {
      const userSession = getUserSession();
      await api.voting.vote(currentBoat.id, 'star', userSession);

      // Update local state optimistically
      setBoats(boats.map(boat =>
        boat.id === currentBoat.id
          ? { ...boat, stars: boat.stars + 1 }
          : boat
      ));

      setUserVotes(prev => ({
        ...prev,
        [currentBoat.id]: currentVotes + 1
      }));

      const newStats = {
        ...userStats,
        totalVotes: userStats.totalVotes + 1,
        boatsVoted: Object.keys({...userVotes, [currentBoat.id]: currentVotes + 1}).length
      };

      setUserStats(newStats);

      // Track boat-specific stars
      const newStarCount = currentVotes + 1;
      const newBoatStars = { ...boatStars, [currentBoat.id]: newStarCount };
      setBoatStars(newBoatStars);
      localStorage.setItem('boatStars', JSON.stringify(newBoatStars));

      // Track Power Hour vote
      trackPowerHourVote();

      // Check complex achievements
      checkPerfectMatch(currentBoat.id);
      checkAllIn(currentBoat.id);

      // Check for new achievements
      checkAchievements(newStats);

      // Trigger pulse animation on star counter
      const starCounter = document.querySelector('.star-counter');
      if (starCounter) {
        starCounter.classList.add('heart-pulse');
        setTimeout(() => {
          starCounter.classList.remove('heart-pulse');
        }, 600);
      }
    } catch (error) {
      console.error('Error sending star:', error);
      // Show user-friendly error message
      alert('Er ging iets mis bij het stemmen. Probeer het opnieuw.');
    }
  };

  const nextBoat = () => {
    if (!currentBoat) return;
    const currentIndex = boats.findIndex(b => b.id === currentBoat.id);
    const nextIndex = (currentIndex + 1) % boats.length;
    setCurrentBoat(boats[nextIndex]);
  };

  const sortedBoats = [...boats].sort((a, b) => b.stars - a.stars);

  // Idea form component
  const IdeaForm = ({ onSubmit }: { onSubmit: (idea: string, email: string) => void }) => {
    const [idea, setIdea] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!idea.trim()) return;

      setIsSubmitting(true);
      try {
        await onSubmit(idea, email);
      } finally {
        setIsSubmitting(false);
        setIdea('');
        setEmail('');
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-800">Jouw idee voor WorldPride 2026</label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            rows={4}
            placeholder="Deel je idee voor een nog betere PrideSync ervaring..."
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-800">Email (optioneel)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            placeholder="je@email.com"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !idea.trim()}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {isSubmitting ? '💭 Versturen...' : '💡 Verstuur Idee'}
        </button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-500 to-blue-500">
      {/* GPS Overlay */}
      {showGpsOverlay && (
        <div
          className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] transition-opacity duration-500 ${
            isGpsLoading ? 'opacity-100' : 'opacity-100'
          }`}
          style={{
            animation: showGpsOverlay ? 'fadeIn 0.3s ease-out' : 'fadeOut 0.5s ease-out forwards'
          }}
        >
          <div className="bg-white bg-opacity-90 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            {/* PrideSync Logo */}
            <div className="mb-6">
              <div className="w-[70%] h-auto mx-auto mb-4">
                <img
                  src="/pridesync-new-logo.svg"
                  alt="PrideSync Logo"
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>

            {/* Prompt Text */}
            <div className="mb-8">
              <p className="text-lg font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-2">
                🎉 Ready to go?
              </p>
              <p className="text-gray-600">
                Turn on GPS to find boats near you!
              </p>
            </div>

            {/* Go Live Button */}
            <button
              onClick={handleGoLive}
              disabled={isGpsLoading}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 ${
                isGpsLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 transform hover:scale-105 shadow-lg hover:shadow-xl'
              }`}
            >
              {isGpsLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Getting location...</span>
                </div>
              ) : (
                'Go Live 🚀'
              )}
            </button>

            {/* Error Message */}
            {gpsError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{gpsError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GPS Status Indicator */}
      <div className="fixed top-4 right-4 z-50">
        <div className={`w-4 h-4 rounded-full ${gpsEnabled ? 'bg-green-500' : 'bg-red-500'} shadow-lg`}></div>
      </div>



      {/* Achievement Popup */}
      {showAchievementPopup && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[10000] pointer-events-none"
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full text-center transform animate-bounce pointer-events-auto"
            onClick={() => {
              setShowAchievementPopup(null);
              // Trigger fly-to-button animation
              if (newAchievement) {
                setTimeout(() => {
                  const achievementButton = document.querySelector('[data-achievement-button]');
                  if (achievementButton) {
                    achievementButton.classList.add('achievement-fly-in');
                    setTimeout(() => {
                      achievementButton.classList.remove('achievement-fly-in');
                    }, 1000);
                  }
                }, 100);
              }
            }}
          >
            {/* Achievement Icon with Glow Effect */}
            <div className="relative mb-6">
              <div className="text-8xl animate-pulse">
                {showAchievementPopup.icon}
              </div>
              <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-30 animate-ping"></div>
            </div>

            {/* Achievement Text */}
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Achievement Unlocked!
            </h2>

            {/* Achievement Number Badge */}
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-bold text-lg mb-3">
              #{achievements.findIndex(a => a.id === showAchievementPopup.id) + 1}
            </div>

            <h3 className="text-xl font-semibold text-yellow-600 mb-2">
              {showAchievementPopup.name}
            </h3>
            <p className="text-gray-600 mb-6">
              {showAchievementPopup.description}
            </p>

            {/* Celebration Effects */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-bounce"
                  style={{
                    left: `${20 + i * 12}%`,
                    top: `${10 + (i % 2) * 20}%`,
                    animationDelay: `${i * 0.2}s`,
                    fontSize: '1.5rem'
                  }}
                >
                  🎉
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowAchievementPopup(null);
                // Trigger fly-to-button animation
                if (newAchievement) {
                  setTimeout(() => {
                    const achievementButton = document.querySelector('[data-achievement-button]');
                    if (achievementButton) {
                      achievementButton.classList.add('achievement-fly-in');
                      setTimeout(() => {
                        achievementButton.classList.remove('achievement-fly-in');
                      }, 1000);
                    }
                  }, 100);
                }
              }}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-3 rounded-full font-bold hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105"
            >
              Awesome! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="pride-gradient text-white py-3 px-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            🏳️‍🌈 PrideSync
          </Link>
          <div className="flex items-center space-x-3">
            {!isOnline && (
              <div className="bg-red-500 text-white px-2 py-1 rounded text-xs">
                Offline
              </div>
            )}
            {gpsEnabled && (
              <div className="bg-green-500 text-white px-2 py-1 rounded text-xs">
                📍 GPS
              </div>
            )}
            <h1 className="text-sm font-semibold">Pride Boat Ballot 2025</h1>
          </div>
        </div>
      </header>

      {/* Main Voting Area - Only show when GPS overlay is hidden */}
      {!showGpsOverlay && (
        <div className="h-[50vh] flex">
        {/* Hearts Section */}
        <div
          className={`hearts-section flex-1 bg-gradient-to-br from-pink-400 to-pink-600 flex flex-col items-center justify-center text-white cursor-pointer active:scale-95 transition-all duration-300 relative overflow-hidden ${
            isHeartCooldown ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          onClick={!isHeartCooldown ? (e) => {
            // For desktop/click, trigger animation at center of element
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            triggerHeartAnimation(centerX, centerY);
            sendHeart();
          } : undefined}
          onTouchStart={!isHeartCooldown ? handleTouchStart : undefined}
          onTouchEnd={!isHeartCooldown ? handleTouchEnd : undefined}
        >
          <div className="text-6xl mb-4">💖</div>
          <div className="text-lg font-semibold">
            {isHeartCooldown ? 'Wait...' : 'Swipe up'}
          </div>
          <div className="text-sm opacity-90">
            {isHeartCooldown ? 'Cooldown active' : 'Send Love'}
          </div>
          {isHeartCooldown && (
            <div className="text-xs mt-2 opacity-75 animate-pulse">
              ⏱️ 1 second cooldown
            </div>
          )}





          {/* Heart Animations */}
          {heartAnimations.map((animation) => (
            <HeartAnimation
              key={animation.id}
              x={animation.x}
              y={animation.y}
            />
          ))}
        </div>

        {/* Stars Section */}
        <div
          className={`stars-section flex-1 bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center text-white cursor-pointer active:scale-95 transition-all duration-300 relative overflow-hidden ${
            isStarCooldown || (currentBoat && (userVotes[currentBoat.id] || 0) >= 5) ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          onClick={!isStarCooldown && currentBoat && (userVotes[currentBoat.id] || 0) < 5 ? (e) => {
            // For desktop/click, trigger animation at center of element
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            triggerStarAnimation(centerX, centerY);
            sendStar();
          } : undefined}
          onTouchStart={handleStarTouchStart}
          onTouchEnd={handleStarTouchEnd}
        >
          <div className="text-6xl mb-4">⭐</div>
          <div className="text-lg font-semibold">
            {isStarCooldown ? 'Wait...' :
             currentBoat && (userVotes[currentBoat.id] || 0) >= 5 ? 'Max reached' : 'Swipe up'}
          </div>
          <div className="text-sm opacity-90">
            {isStarCooldown ? 'Cooldown active' :
             currentBoat && (userVotes[currentBoat.id] || 0) >= 5 ? '5/5 stars given' : 'Give Stars'}
          </div>
          {currentBoat && (
            <div className="text-xs mt-2 opacity-75">
              {userVotes[currentBoat.id] || 0}/5 used
            </div>
          )}
          {isStarCooldown && (
            <div className="text-xs mt-1 opacity-75 animate-pulse">
              ⏱️ 1 second cooldown
            </div>
          )}



          {/* Star Animations */}
          {starAnimations.map((animation) => (
            <StarAnimation
              key={animation.id}
              x={animation.x}
              y={animation.y}
            />
          ))}


        </div>
      </div>
      )}

      {/* Current Boat Info - Only show when GPS overlay is hidden */}
      {!showGpsOverlay && currentBoat && (
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
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 heart-counter">
                <span>💖</span>
                <span className="font-semibold">{currentBoat.hearts}</span>
              </div>
              <div className="flex items-center space-x-1 star-counter">
                <span>⭐</span>
                <span className="font-semibold">{currentBoat.stars}</span>
              </div>
            </div>

            {/* GPS Distance Info */}
            {nearestBoat && nearestBoat.boat.id === currentBoat.id && (
              <div className="flex items-center space-x-1 bg-white bg-opacity-20 rounded-full px-3 py-1">
                <span>📍</span>
                <span className="text-sm font-semibold">{nearestBoat.distanceText}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons Grid - Only show when GPS overlay is hidden */}
      {!showGpsOverlay && (
        <div className="grid grid-cols-2 gap-4 p-4 mt-4">
        <button
          onClick={() => setShowModal('achievements')}
          className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white p-6 rounded-xl text-center relative overflow-hidden transition-all duration-300"
          data-achievement-button
        >
          {(() => {
            const latestAchievement = getLatestAchievement();
            const unlockedCount = achievements.filter(a => a.unlocked).length;

            return (
              <>
                <div className="text-3xl mb-2">
                  {latestAchievement ? latestAchievement.icon : '🏆'}
                </div>
                <div className="font-semibold">Achievements</div>
                <div className="text-sm opacity-90">
                  {unlockedCount}/{achievements.length} unlocked
                </div>
                {latestAchievement && (
                  <div className="text-xs opacity-75 mt-1">
                    Latest: #{achievements.findIndex(a => a.id === latestAchievement.id) + 1} {latestAchievement.name}
                  </div>
                )}
              </>
            );
          })()}
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
      )}

      {/* PrideSync Live Button - Only show when GPS overlay is hidden */}
      {!showGpsOverlay && (
        <div className="text-center p-4">
          <button className={`text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all duration-300 ${
            gpsEnabled
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-red-500 hover:bg-red-600'
          }`}>
            {gpsEnabled ? '🟢 PrideSync Live' : '🔴 PrideSync Live'}
          </button>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto pointer-events-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
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
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {sortedBoats.map((boat, index) => (
                    <div key={boat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{boat.name}</div>
                          <div className="text-xs text-gray-600 truncate">{boat.theme}</div>
                          {boat.organisation && (
                            <div className="text-xs text-gray-500 truncate">{boat.organisation}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right mr-2">
                          <div className="font-bold text-purple-600 text-sm">{boat.stars} ⭐</div>
                          <div className="text-xs text-gray-500">{boat.hearts} 💖</div>
                        </div>
                        {/* Voting buttons */}
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => handleVote(boat.id, 'heart')}
                            className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
                            disabled={votingInProgress}
                          >
                            💖
                          </button>
                          <button
                            onClick={() => handleVote(boat.id, 'star')}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                              getUserStarVotes(boat.id) >= 5
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-500 hover:text-yellow-600'
                            }`}
                            disabled={votingInProgress || getUserStarVotes(boat.id) >= 5}
                            title={getUserStarVotes(boat.id) >= 5 ? 'Maximum 5 sterren per boot' : 'Stem met een ster'}
                          >
                            ⭐
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sortedBoats.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">🚢</div>
                      <div>Geen boten gevonden</div>
                    </div>
                  )}
                </div>
              )}

              {showModal === 'achievements' && (
                <div className="space-y-4">
                  {/* Stats Summary */}
                  <div className="text-center p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg">
                    <div className="text-3xl mb-2">🎉</div>
                    <div className="font-bold text-lg text-gray-800">Your Stats</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div>⭐ {userStats.totalVotes} votes cast</div>
                      <div>🚢 {userStats.boatsVoted} boats voted for</div>
                      <div>💖 {userStats.heartsGiven} hearts sent</div>
                    </div>
                  </div>

                  {/* Achievement Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-800">Progress</span>
                      <span className="text-sm text-gray-600">
                        {achievements.filter(a => a.unlocked).length}/{achievements.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${(achievements.filter(a => a.unlocked).length / achievements.length) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Achievements List - Volledige, definitieve lijst (1–15) */}
                  <div className="space-y-3">
                    {achievements.map((achievement, index) => (
                      <div
                        key={achievement.id}
                        className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                          achievement.unlocked
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-md'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {/* Achievement Number */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            achievement.unlocked
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>

                          {/* Achievement Icon */}
                          <div className={`text-3xl ${achievement.unlocked ? 'animate-bounce' : 'grayscale opacity-50'}`}>
                            {achievement.icon}
                          </div>

                          {/* Achievement Info */}
                          <div className="flex-1">
                            <div className={`font-semibold ${achievement.unlocked ? 'text-green-800' : 'text-gray-500'}`}>
                              {achievement.name}
                            </div>
                            <div className={`text-sm ${achievement.unlocked ? 'text-green-600' : 'text-gray-400'}`}>
                              {achievement.description}
                            </div>
                            {achievement.unlocked && achievement.unlockedAt && (
                              <div className="text-xs text-green-500 mt-1">
                                Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {/* Checkmark for unlocked achievements */}
                          {achievement.unlocked && (
                            <div className="text-green-500">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showModal === 'help' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-800">Hoe werkt stemmen?</h4>
                    <p className="text-sm text-gray-600">Tap op de ster-kant om te stemmen. Je kunt maximaal 5 sterren per boot geven.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-800">Wat zijn hartjes?</h4>
                    <p className="text-sm text-gray-600">Hartjes zijn onbeperkt en tonen je waardering. Tap op de hart-kant om liefde te sturen!</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-800">Hoe wissel ik van boot?</h4>
                    <p className="text-sm text-gray-600">Gebruik de pijl-knop naast de bootnaam om naar de volgende boot te gaan.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-800">Wanneer sluit het stemmen?</h4>
                    <p className="text-sm text-gray-600">Stemmen sluit om 18:00 na afloop van de parade.</p>
                  </div>
                </div>
              )}

              {showModal === 'ideas' && (
                <IdeaForm onSubmit={async (idea, email) => {
                  try {
                    const userSession = getUserSession();
                    await api.voting.submitIdea(idea, email, userSession);

                    alert('Bedankt voor je idee! We nemen het mee in overweging voor WorldPride 2026.');
                    setShowModal(null);
                  } catch (error) {
                    console.error('Error submitting idea:', error);
                    alert('Er ging iets mis bij het versturen van je idee. Probeer het later opnieuw.');
                  }
                }} />
              )}


            </div>
          </div>
        </div>
      )}
    </div>
  );
}
