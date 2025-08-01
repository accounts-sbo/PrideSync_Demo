const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const { getLatestGPSPositions, getAllPrideBoats } = require('../models/database');

// GPS service using real database data
const gpsService = {
  async getAllBoats() {
    try {
      // Get latest GPS positions from database
      const gpsPositions = await getLatestGPSPositions();
      const prideBoats = await getAllPrideBoats();

      if (!gpsPositions || gpsPositions.length === 0) {
        logger.warn('No GPS positions found, using fallback data');
        return await this.getFallbackBoats();
      }

      // Create a map of tracker_name to pride boat info
      const prideBoatMap = new Map();
      prideBoats.forEach(boat => {
        // Try to match by parade_position or boat_name
        prideBoatMap.set(boat.parade_position.toString(), boat);
        prideBoatMap.set(boat.boat_name.toLowerCase(), boat);
      });

      // Combine GPS positions with pride boat data
      const boats = [];
      const processedTrackers = new Set();

      gpsPositions.forEach(pos => {
        if (processedTrackers.has(pos.tracker_name)) return;
        processedTrackers.add(pos.tracker_name);

        // Try to find matching pride boat
        let prideBoat = prideBoatMap.get(pos.tracker_name) ||
                       prideBoatMap.get(pos.tracker_name.toLowerCase()) ||
                       prideBoatMap.get(pos.parade_position?.toString());

        // If no direct match, try to find by similar name
        if (!prideBoat) {
          for (const [key, boat] of prideBoatMap) {
            if (key.includes(pos.tracker_name.toLowerCase()) ||
                pos.tracker_name.toLowerCase().includes(key)) {
              prideBoat = boat;
              break;
            }
          }
        }

        boats.push({
          id: prideBoat?.parade_position || pos.parade_position || boats.length + 1,
          name: prideBoat?.boat_name || pos.tracker_name,
          lat: parseFloat(pos.latitude),
          lon: parseFloat(pos.longitude),
          theme: prideBoat?.theme || 'Pride Boat',
          organisation: prideBoat?.organisation || 'Pride Amsterdam',
          description: prideBoat?.description || '',
          position: prideBoat?.parade_position || boats.length + 1,
          tracker_name: pos.tracker_name,
          timestamp: pos.timestamp,
          accuracy: pos.accuracy
        });
      });

      logger.info(`✅ Retrieved ${boats.length} boats with GPS positions from database`);
      return boats;

    } catch (error) {
      logger.error('❌ Error getting boats from database:', error);
      return await this.getFallbackBoats();
    }
  },

  async getFallbackBoats() {
    // Fallback mock data when database is not available
    return [
      {
        id: 1,
        name: "Rainbow Warriors",
        lat: 52.3676,
        lon: 4.9041,
        theme: "Music & Dance",
        organisation: "Pride Amsterdam",
        description: "A vibrant boat celebrating music and dance",
        position: 1,
        tracker_name: "mock_tracker_1"
      },
      {
        id: 2,
        name: "Pride & Joy",
        lat: 52.3656,
        lon: 4.9061,
        theme: "Love & Unity",
        organisation: "COC Nederland",
        description: "Spreading love and unity across the canals",
        position: 2,
        tracker_name: "mock_tracker_2"
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
    
    const boats = await gpsService.getAllBoats();
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
    const boats = await gpsService.getAllBoats();
    
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
