const express = require('express');
const boatState = require('../services/boatState');
const logger = require('../services/logger');

const router = express.Router();

/**
 * GET /api/boats
 * Get all boat positions and states
 */
router.get('/', async (req, res) => {
  try {
    const boats = boatState.getAllBoatStates();
    
    res.json({
      success: true,
      count: boats.length,
      boats: boats.map(boat => ({
        id: boat.id,
        name: boat.name,
        status: boat.status,
        position: {
          latitude: boat.position.latitude,
          longitude: boat.position.longitude,
          routeProgress: boat.position.routeProgress,
          routeDistance: boat.position.routeDistance,
          speed: boat.position.speed,
          heading: boat.position.heading,
          timestamp: boat.position.timestamp
        },
        corridor: {
          inCorridor: boat.corridor.inCorridor,
          warningCount: boat.corridor.warningCount
        },
        lastUpdate: boat.lastUpdate
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching all boats:', error);
    res.status(500).json({
      error: 'Failed to fetch boat data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/boats/:id
 * Get specific boat state and detailed information
 */
router.get('/:id', async (req, res) => {
  try {
    const boatId = parseInt(req.params.id);
    
    if (isNaN(boatId)) {
      return res.status(400).json({
        error: 'Invalid boat ID',
        provided: req.params.id
      });
    }

    const boat = boatState.getBoatState(boatId);
    
    if (!boat) {
      return res.status(404).json({
        error: 'Boat not found',
        boatId
      });
    }

    // Get position history
    const history = boatState.getBoatHistory(boatId, 20);

    res.json({
      success: true,
      boat: {
        id: boat.id,
        name: boat.name,
        status: boat.status,
        position: boat.position,
        corridor: boat.corridor,
        incidents: boat.incidents.slice(-10), // Last 10 incidents
        created: boat.created,
        lastUpdate: boat.lastUpdate
      },
      history: history,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Error fetching boat ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to fetch boat data',
      boatId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/boats/:id/history
 * Get boat position history
 */
router.get('/:id/history', async (req, res) => {
  try {
    const boatId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    
    if (isNaN(boatId)) {
      return res.status(400).json({
        error: 'Invalid boat ID',
        provided: req.params.id
      });
    }

    const boat = boatState.getBoatState(boatId);
    if (!boat) {
      return res.status(404).json({
        error: 'Boat not found',
        boatId
      });
    }

    const history = boatState.getBoatHistory(boatId, limit);

    res.json({
      success: true,
      boatId,
      count: history.length,
      history,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Error fetching boat history for ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to fetch boat history',
      boatId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/boats/:id/status
 * Update boat status manually (for testing/admin)
 */
router.post('/:id/status', async (req, res) => {
  try {
    const boatId = parseInt(req.params.id);
    const { status, message } = req.body;
    
    if (isNaN(boatId)) {
      return res.status(400).json({
        error: 'Invalid boat ID',
        provided: req.params.id
      });
    }

    if (!status) {
      return res.status(400).json({
        error: 'Status is required',
        validStatuses: ['active', 'waiting', 'finished', 'emergency']
      });
    }

    const validStatuses = ['active', 'waiting', 'finished', 'emergency'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        provided: status,
        validStatuses
      });
    }

    const updatedBoat = await boatState.updateBoatStatus(boatId, status, {
      message: message || `Status updated to ${status}`,
      severity: 'info',
      timestamp: new Date()
    });

    res.json({
      success: true,
      boatId,
      previousStatus: updatedBoat.status,
      newStatus: status,
      message: message || `Status updated to ${status}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Error updating boat status for ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message,
        boatId: req.params.id
      });
    }

    res.status(500).json({
      error: 'Failed to update boat status',
      boatId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
