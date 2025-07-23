const express = require('express');
const router = express.Router();
const proximityCalculator = require('../services/proximityCalculator');
const gpsService = require('../services/gpsService');
const frequencyManager = require('../services/frequencyManager');

// GET /api/locations/nearest - Vind dichtstbijzijnde boot
router.get('/nearest', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat and lon parameters are required' });
    }
    
    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    
    const boats = await gpsService.getAllBoats();
    const nearestBoat = proximityCalculator.findNearestBoat(userLat, userLon, boats);
    
    if (!nearestBoat) {
      return res.status(404).json({ error: 'No boats found' });
    }
    
    const frequency = await frequencyManager.getBoatFrequency(nearestBoat.id);
    
    res.json({
      boatId: nearestBoat.id,
      frequency,
      distance: nearestBoat.distance,
      boatLocation: {
        lat: nearestBoat.lat,
        lon: nearestBoat.lon
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/locations/all - Haal alle bootlocaties op
router.get('/all', async (req, res) => {
  try {
    const boats = await gpsService.getAllBoats();
    res.json(boats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

