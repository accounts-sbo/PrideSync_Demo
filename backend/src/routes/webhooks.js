const express = require('express');
const Joi = require('joi');
const logger = require('../services/logger');
const routeMapper = require('../services/routeMapper');
const boatState = require('../services/boatState');

const router = express.Router();

// Validation schema for KPN GPS webhook
const gpsPayloadSchema = Joi.object({
  bootnummer: Joi.number().integer().min(1).max(999).required(),
  timestamp: Joi.string().isoDate().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

/**
 * KPN GPS Webhook Endpoint
 * POST /api/webhooks/kpn-gps
 * 
 * Receives real-time GPS updates from KPN for parade boats
 * Maps GPS coordinates to parade route and updates boat state
 */
router.post('/kpn-gps', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate payload
    const { error, value } = gpsPayloadSchema.validate(req.body);
    if (error) {
      logger.warn('Invalid GPS payload received:', {
        error: error.details[0].message,
        payload: req.body
      });
      
      return res.status(400).json({
        error: 'Invalid payload',
        details: error.details[0].message,
        received: req.body
      });
    }

    const { bootnummer, timestamp, latitude, longitude } = value;
    
    logger.info(`GPS update received for boat ${bootnummer}`, {
      bootnummer,
      timestamp,
      coordinates: [latitude, longitude]
    });

    // Map GPS coordinates to parade route
    const routePosition = await routeMapper.mapToRoute({
      latitude,
      longitude,
      timestamp: new Date(timestamp)
    });

    if (!routePosition) {
      logger.warn(`Could not map GPS position to route for boat ${bootnummer}`, {
        bootnummer,
        coordinates: [latitude, longitude]
      });
      
      return res.status(422).json({
        error: 'GPS position could not be mapped to parade route',
        bootnummer,
        coordinates: [latitude, longitude]
      });
    }

    // Update boat state with new position
    const updatedBoat = await boatState.updateBoatPosition(bootnummer, {
      latitude,
      longitude,
      timestamp: new Date(timestamp),
      routeDistance: routePosition.distanceMeters,
      routeProgress: routePosition.progressPercent,
      speed: routePosition.estimatedSpeed,
      heading: routePosition.heading
    });

    // Trigger corridor algorithm and status updates
    await updateBoatState(bootnummer, updatedBoat);

    const processingTime = Date.now() - startTime;
    
    logger.info(`GPS update processed successfully for boat ${bootnummer}`, {
      bootnummer,
      routeProgress: routePosition.progressPercent,
      processingTimeMs: processingTime
    });

    // Return success response with debug info
    res.status(200).json({
      success: true,
      bootnummer,
      processed: {
        timestamp: new Date().toISOString(),
        routeProgress: `${routePosition.progressPercent.toFixed(2)}%`,
        routeDistance: `${routePosition.distanceMeters}m`,
        processingTimeMs: processingTime
      },
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          originalCoordinates: [latitude, longitude],
          mappedPosition: routePosition,
          boatState: updatedBoat
        }
      })
    });

  } catch (error) {
    logger.error('Error processing GPS webhook:', {
      error: error.message,
      stack: error.stack,
      payload: req.body
    });

    res.status(500).json({
      error: 'Internal server error processing GPS update',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message
      })
    });
  }
});

/**
 * Update boat state and trigger status changes
 * @param {number} bootId - Boat ID
 * @param {Object} boatData - Updated boat data
 */
async function updateBoatState(bootId, boatData) {
  try {
    // Check corridor status
    const corridorStatus = await boatState.checkCorridor(bootId);
    
    // Update boat status based on position and corridor
    if (corridorStatus.outOfCorridor) {
      await boatState.updateBoatStatus(bootId, 'corridor_warning', {
        message: 'Boat is outside designated corridor',
        severity: 'warning',
        timestamp: new Date()
      });
    }

    // Check for incidents or emergencies
    const incidentStatus = await boatState.checkForIncidents(bootId, boatData);
    if (incidentStatus.hasIncident) {
      await boatState.triggerIncident(bootId, incidentStatus);
    }

    // Notify frontend via API or WebSocket
    await notifyFrontend(bootId, {
      position: boatData,
      status: corridorStatus,
      incidents: incidentStatus
    });

  } catch (error) {
    logger.error(`Error updating boat state for boat ${bootId}:`, error);
  }
}

/**
 * Notify frontend of boat status changes
 * @param {number} bootId - Boat ID
 * @param {Object} statusData - Status update data
 */
async function notifyFrontend(bootId, statusData) {
  // TODO: Implement WebSocket or Server-Sent Events for real-time updates
  // For now, data is available via API endpoints
  logger.debug(`Status update ready for boat ${bootId}`, statusData);
}

module.exports = router;
