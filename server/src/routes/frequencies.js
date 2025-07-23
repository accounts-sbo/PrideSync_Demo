const express = require('express');
const router = express.Router();
const frequencyManager = require('../services/frequencyManager');

// GET /api/frequencies - Haal alle frequentietoewijzingen op
router.get('/', async (req, res) => {
  try {
    const assignments = await frequencyManager.getAllAssignments();
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/frequencies/assign - Wijs frequentie toe aan boot
router.post('/assign', async (req, res) => {
  try {
    const { boatId, frequency } = req.body;
    
    if (!boatId || !frequency) {
      return res.status(400).json({ error: 'BoatId and frequency are required' });
    }
    
    await frequencyManager.assignFrequency(boatId, frequency);
    res.json({ success: true, boatId, frequency });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/frequencies/available - Haal beschikbare frequenties op
router.get('/available', async (req, res) => {
  try {
    const available = await frequencyManager.getAvailableFrequencies();
    res.json(available);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

