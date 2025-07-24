const express = require('express');
const Joi = require('joi');
const logger = require('../services/logger');
const routeMapper = require('../services/routeMapper');
const boatState = require('../services/boatState');
const database = require('../models/database');

const router = express.Router();

// Enhanced validation schema for KPN GPS webhook
const gpsPayloadSchema = Joi.object({
  bootnummer: Joi.number().integer().min(1).max(999).optional(),
  imei: Joi.string().length(15).pattern(/^\d+$/).optional(),
  timestamp: Joi.string().isoDate().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  altitude: Joi.number().optional(),
  accuracy: Joi.number().min(0).optional(),
  speed: Joi.number().min(0).optional(),
  heading: Joi.number().min(0).max(360).optional()
}).or('bootnummer', 'imei'); // At least one of bootnummer or imei is required

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

    const { bootnummer, imei, timestamp, latitude, longitude, altitude, accuracy, speed, heading } = value;

    // Determine boat identifier and get boat info from database
    let boat = null;
    let boatIdentifier = null;

    if (bootnummer) {
      boat = await database.getBoat(bootnummer);
      boatIdentifier = bootnummer;
    } else if (imei) {
      boat = await database.getBoat(imei);
      boatIdentifier = imei;
    }

    if (!boat) {
      logger.warn('GPS data received for unknown boat:', {
        bootnummer,
        imei,
        coordinates: [latitude, longitude]
      });

      return res.status(404).json({
        error: 'Boat not found',
        message: 'No boat registered with this number or IMEI',
        bootnummer,
        imei,
        coordinates: [latitude, longitude]
      });
    }

    const actualBoatNumber = boat.boat_number;

    logger.info(`GPS update received for boat ${actualBoatNumber}`, {
      bootnummer: actualBoatNumber,
      imei: boat.imei,
      timestamp,
      coordinates: [latitude, longitude],
      accuracy,
      speed: speed || 'unknown'
    });

    // Map GPS coordinates to parade route
    const routePosition = await routeMapper.mapToRoute({
      latitude,
      longitude,
      timestamp: new Date(timestamp)
    });

    if (!routePosition) {
      logger.warn(`Could not map GPS position to route for boat ${actualBoatNumber}`, {
        bootnummer: actualBoatNumber,
        imei: boat.imei,
        coordinates: [latitude, longitude]
      });

      return res.status(422).json({
        error: 'GPS position could not be mapped to parade route',
        bootnummer: actualBoatNumber,
        imei: boat.imei,
        coordinates: [latitude, longitude]
      });
    }

    // Prepare position data
    const positionData = {
      latitude,
      longitude,
      timestamp: new Date(timestamp),
      routeDistance: routePosition.distanceMeters,
      routeProgress: routePosition.progressPercent,
      speed: speed || routePosition.estimatedSpeed,
      heading: heading || routePosition.heading,
      altitude: altitude || null,
      accuracy: accuracy || null
    };

    // Save to database
    try {
      await database.saveBoatPosition(actualBoatNumber, {
        ...positionData,
        imei: boat.imei
      });
    } catch (dbError) {
      logger.error('Failed to save position to database:', dbError);
      // Continue processing even if database save fails
    }

    // Update in-memory boat state
    const updatedBoat = await boatState.updateBoatPosition(actualBoatNumber, positionData);

    // Trigger corridor algorithm and status updates
    await updateBoatState(actualBoatNumber, updatedBoat);

    const processingTime = Date.now() - startTime;

    logger.info(`GPS update processed successfully for boat ${actualBoatNumber}`, {
      bootnummer: actualBoatNumber,
      imei: boat.imei,
      routeProgress: routePosition.progressPercent,
      processingTimeMs: processingTime
    });

    // Return success response with debug info
    res.status(200).json({
      success: true,
      bootnummer: actualBoatNumber,
      imei: boat.imei,
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
