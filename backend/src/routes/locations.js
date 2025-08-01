const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const { getLatestGPSPositions, getAllPrideBoats } = require('../models/database');

// GPS service using real database data with improved boat-tracker matching
const gpsService = {
  async getAllBoats() {
    try {
      // Get latest GPS positions from database
      const gpsPositions = await getLatestGPSPositions();
      const prideBoats = await getAllPrideBoats();
      const boatTrackerMappings = await getAllActiveBoatTrackerMappings();

      if (!gpsPositions || gpsPositions.length === 0) {
        logger.warn('No GPS positions found, using fallback data');
        return await this.getFallbackBoats();
      }

      // Create mapping from tracker_name to pride boat via boat_tracker_mappings
      const trackerToPrideBoatMap = new Map();
      boatTrackerMappings.forEach(mapping => {
        if (mapping.tracker_name && mapping.is_active) {
          trackerToPrideBoatMap.set(mapping.tracker_name, {
            pride_boat_id: mapping.pride_boat_id,
            parade_position: mapping.parade_position
          });
        }
      });

      // Create a map of pride boat data by ID and parade position
      const prideBoatMap = new Map();
      prideBoats.forEach(boat => {
        prideBoatMap.set(boat.id, boat);
        prideBoatMap.set(boat.parade_position, boat);
      });

      // Combine GPS positions with pride boat data using proper mappings
      const boats = [];
      const processedTrackers = new Set();

      gpsPositions.forEach(pos => {
        if (processedTrackers.has(pos.tracker_name)) return;
        processedTrackers.add(pos.tracker_name);

        // Find matching pride boat using proper mapping
        let prideBoat = null;

        // First try to find via boat-tracker mapping
        const mapping = trackerToPrideBoatMap.get(pos.tracker_name);
        if (mapping) {
          prideBoat = prideBoatMap.get(mapping.pride_boat_id) || prideBoatMap.get(mapping.parade_position);
        }

        // Fallback: try direct parade_position match from GPS data
        if (!prideBoat && pos.parade_position) {
          prideBoat = prideBoatMap.get(pos.parade_position);
        }

        // Last resort: try name-based matching
        if (!prideBoat) {
          for (const [key, boat] of prideBoatMap) {
            if (typeof key === 'string' && (
                key.toLowerCase().includes(pos.tracker_name.toLowerCase()) ||
                pos.tracker_name.toLowerCase().includes(key.toLowerCase())
            )) {
              prideBoat = boat;
              break;
            }
          }
        }

        // Create boat object with complete pride boat information
        const boat = {
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
          accuracy: pos.accuracy,
          // Additional pride boat data for voting app
          captain_name: prideBoat?.captain_name || null,
          boat_type: prideBoat?.boat_type || null,
          status: prideBoat?.status || 'active',
          pride_boat_id: prideBoat?.id || null
        };

        boats.push(boat);
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

// GET /api/locations/pride-boats - Get all pride boats data for leaderboard
router.get('/pride-boats', async (req, res) => {
  try {
    const prideBoats = await getAllPrideBoats();

    // Transform data for frontend use
    const boats = prideBoats.map(boat => ({
      id: boat.id,
      parade_position: boat.parade_position,
      name: boat.boat_name,
      organisation: boat.organisation,
      theme: boat.theme,
      description: boat.description,
      captain_name: boat.captain_name,
      boat_type: boat.boat_type,
      status: boat.status,
      created_at: boat.created_at,
      updated_at: boat.updated_at
    }));

    logger.info(`✅ Retrieved ${boats.length} pride boats for leaderboard`);

    res.json({
      success: true,
      data: boats,
      count: boats.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching pride boats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pride boats data'
    });
  }
});

module.exports = router;
