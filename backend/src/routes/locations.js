const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

// Mock GPS service for now - will be replaced when colleague's database work is ready
const mockGpsService = {
  async getAllBoats() {
    // Mock boat data with GPS coordinates around Amsterdam
    return [
      {
        id: 1,
        name: "Rainbow Warriors",
        lat: 52.3676,
        lon: 4.9041,
        theme: "Music & Dance",
        position: 1,
        hearts: 127,
        stars: 89
      },
      {
        id: 2,
        name: "Pride & Joy", 
        lat: 52.3656,
        lon: 4.9061,
        theme: "Love & Unity",
        position: 2,
        hearts: 98,
        stars: 76
      },
      {
        id: 3,
        name: "Spectrum Sailors",
        lat: 52.3696,
        lon: 4.9021,
        theme: "Diversity", 
        position: 3,
        hearts: 156,
        stars: 92
      },
      {
        id: 4,
        name: "Unity Float",
        lat: 52.3636,
        lon: 4.9081,
        theme: "Together Strong",
        position: 4,
        hearts: 84,
        stars: 67
      },
      {
        id: 5,
        name: "Love Boat Amsterdam",
        lat: 52.3716,
        lon: 4.9001,
        theme: "Acceptance",
        position: 5,
        hearts: 112,
        stars: 78
      }
    ];
  }
};

// Proximity calculator utility
const proximityCalculator = {
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  toRad(degrees) {
    return degrees * (Math.PI/180);
  },

  findNearestBoat(userLat, userLon, boats) {
    if (!boats || boats.length === 0) {
      return null;
    }

    let nearestBoat = null;
    let minDistance = Infinity;

    boats.forEach(boat => {
      const distance = this.calculateDistance(userLat, userLon, boat.lat, boat.lon);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestBoat = {
          ...boat,
          distance: Math.round(distance * 1000) / 1000 // Round to 3 decimals
        };
      }
    });

    return nearestBoat;
  }
};

// GET /api/locations/nearest - Find nearest boat to user location
router.get('/nearest', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ 
        success: false,
        error: 'Lat and lon parameters are required' 
      });
    }
    
    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    
    if (isNaN(userLat) || isNaN(userLon)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lat/lon coordinates'
      });
    }
    
    const boats = await mockGpsService.getAllBoats();
    const nearestBoat = proximityCalculator.findNearestBoat(userLat, userLon, boats);
    
    if (!nearestBoat) {
      return res.status(404).json({ 
        success: false,
        error: 'No boats found' 
      });
    }
    
    logger.info('Nearest boat found', {
      userLocation: [userLat, userLon],
      nearestBoat: nearestBoat.name,
      distance: nearestBoat.distance
    });
    
    res.json({
      success: true,
      data: {
        boat: nearestBoat,
        distance: nearestBoat.distance,
        distanceText: nearestBoat.distance < 1 
          ? `${Math.round(nearestBoat.distance * 1000)}m`
          : `${nearestBoat.distance.toFixed(1)}km`
      }
    });
  } catch (error) {
    logger.error('Error finding nearest boat:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// GET /api/locations/all - Get all boat locations
router.get('/all', async (req, res) => {
  try {
    const boats = await mockGpsService.getAllBoats();
    
    res.json({
      success: true,
      data: boats
    });
  } catch (error) {
    logger.error('Error fetching boat locations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;
