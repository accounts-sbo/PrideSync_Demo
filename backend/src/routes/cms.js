const express = require('express');
const Joi = require('joi');
const logger = require('../services/logger');
const database = require('../models/database');

const router = express.Router();

// Validation schemas
const boatSchema = Joi.object({
  boat_number: Joi.number().integer().min(1).max(999).required(),
  name: Joi.string().min(1).max(255).required(),
  imei: Joi.string().length(15).pattern(/^\d+$/).optional(),
  description: Joi.string().max(1000).optional(),
  captain_name: Joi.string().max(255).optional(),
  captain_phone: Joi.string().max(20).optional(),
  status: Joi.string().valid('waiting', 'active', 'finished', 'emergency').optional()
});

const updateBoatSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  imei: Joi.string().length(15).pattern(/^\d+$/).optional(),
  description: Joi.string().max(1000).optional(),
  captain_name: Joi.string().max(255).optional(),
  captain_phone: Joi.string().max(20).optional(),
  status: Joi.string().valid('waiting', 'active', 'finished', 'emergency').optional()
});

/**
 * GET /api/cms/boats
 * Get all boats for CMS management
 */
router.get('/boats', async (req, res) => {
  try {
    const boats = await database.getAllBoats();
    
    res.json({
      success: true,
      count: boats.length,
      boats: boats
    });
  } catch (error) {
    logger.error('Error fetching boats for CMS:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch boats'
    });
  }
});

/**
 * GET /api/cms/boats/:identifier
 * Get specific boat by number or IMEI
 */
router.get('/boats/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const boat = await database.getBoat(identifier);
    
    if (!boat) {
      return res.status(404).json({
        success: false,
        error: 'Boat not found',
        identifier: identifier
      });
    }
    
    res.json({
      success: true,
      boat: boat
    });
  } catch (error) {
    logger.error('Error fetching boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/cms/boats
 * Create new boat
 */
router.post('/boats', async (req, res) => {
  try {
    // Validate input
    const { error, value } = boatSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details[0].message,
        received: req.body
      });
    }

    // Check if boat number already exists
    const existingBoat = await database.getBoat(value.boat_number);
    if (existingBoat) {
      return res.status(409).json({
        success: false,
        error: 'Boat number already exists',
        boat_number: value.boat_number
      });
    }

    // Check if IMEI already exists (if provided)
    if (value.imei) {
      const existingImei = await database.getBoat(value.imei);
      if (existingImei) {
        return res.status(409).json({
          success: false,
          error: 'IMEI already exists',
          imei: value.imei
        });
      }
    }

    // Create boat
    const newBoat = await database.createBoat(value);
    
    logger.info('New boat created via CMS:', {
      boat_number: newBoat.boat_number,
      name: newBoat.name,
      imei: newBoat.imei
    });

    res.status(201).json({
      success: true,
      message: 'Boat created successfully',
      boat: newBoat
    });

  } catch (error) {
    logger.error('Error creating boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create boat'
    });
  }
});

/**
 * PUT /api/cms/boats/:boatNumber
 * Update existing boat
 */
router.put('/boats/:boatNumber', async (req, res) => {
  try {
    const boatNumber = parseInt(req.params.boatNumber);
    
    if (isNaN(boatNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid boat number'
      });
    }

    // Validate input
    const { error, value } = updateBoatSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    // Check if boat exists
    const existingBoat = await database.getBoat(boatNumber);
    if (!existingBoat) {
      return res.status(404).json({
        success: false,
        error: 'Boat not found',
        boat_number: boatNumber
      });
    }

    // Check IMEI uniqueness if updating IMEI
    if (value.imei && value.imei !== existingBoat.imei) {
      const imeiCheck = await database.getBoat(value.imei);
      if (imeiCheck && imeiCheck.boat_number !== boatNumber) {
        return res.status(409).json({
          success: false,
          error: 'IMEI already exists',
          imei: value.imei
        });
      }
    }

    // Update boat
    const updatedBoat = await database.updateBoat(boatNumber, value);
    
    logger.info('Boat updated via CMS:', {
      boat_number: boatNumber,
      changes: value
    });

    res.json({
      success: true,
      message: 'Boat updated successfully',
      boat: updatedBoat
    });

  } catch (error) {
    logger.error('Error updating boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/cms/boats/:boatNumber
 * Delete boat
 */
router.delete('/boats/:boatNumber', async (req, res) => {
  try {
    const boatNumber = parseInt(req.params.boatNumber);
    
    if (isNaN(boatNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid boat number'
      });
    }

    const deletedBoat = await database.deleteBoat(boatNumber);
    
    if (!deletedBoat) {
      return res.status(404).json({
        success: false,
        error: 'Boat not found',
        boat_number: boatNumber
      });
    }

    logger.info('Boat deleted via CMS:', {
      boat_number: boatNumber,
      name: deletedBoat.name
    });

    res.json({
      success: true,
      message: 'Boat deleted successfully',
      boat: deletedBoat
    });

  } catch (error) {
    logger.error('Error deleting boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/cms/stats
 * Get CMS statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const boats = await database.getAllBoats();
    
    const stats = {
      total_boats: boats.length,
      by_status: {
        waiting: boats.filter(b => b.status === 'waiting').length,
        active: boats.filter(b => b.status === 'active').length,
        finished: boats.filter(b => b.status === 'finished').length,
        emergency: boats.filter(b => b.status === 'emergency').length
      },
      with_imei: boats.filter(b => b.imei).length,
      without_imei: boats.filter(b => !b.imei).length
    };

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching CMS stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
