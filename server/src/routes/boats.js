const express = require('express');
const router = express.Router();
const gpsService = require('../services/gpsService');
const frequencyManager = require('../services/frequencyManager');

// GET /api/boats - Haal alle boten op
router.get('/', async (req, res) => {
  try {
    const boats = await gpsService.getAllBoats();
    const boatsWithFrequencies = await Promise.all(
      boats.map(async (boat) => ({
        ...boat,
        frequency: await frequencyManager.getBoatFrequency(boat.id)
      }))
    );
    res.json(boatsWithFrequencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/boats/:boatId/frequency - Haal frequentie op voor specifieke boot
router.get('/:boatId/frequency', async (req, res) => {
  try {
    const { boatId } = req.params;
    const frequency = await frequencyManager.getBoatFrequency(boatId);
    res.json({ boatId, frequency });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/boats/:boatId/location - Update bootlocatie
router.post('/:boatId/location', async (req, res) => {
  try {
    const { boatId } = req.params;
    const { lat, lon } = req.body;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat and lon are required' });
    }
    
    await gpsService.updateBoatLocation(boatId, lat, lon);
    res.json({ success: true, boatId, lat, lon });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


