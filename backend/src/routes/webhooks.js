const express = require('express');
const Joi = require('joi');
const logger = require('../services/logger');
const routeMapper = require('../services/routeMapper');
const boatState = require('../services/boatState');
const database = require('../models/database');

const router = express.Router();

// Middleware to log all webhook requests
async function logWebhookMiddleware(req, res, next) {
  const startTime = Date.now();

  // Store original res.json to capture response
  const originalJson = res.json;
  let responseBody = null;
  let responseStatus = null;

  res.json = function(body) {
    responseBody = body;
    responseStatus = res.statusCode;
    return originalJson.call(this, body);
  };

  // Store original res.status to capture status
  const originalStatus = res.status;
  res.status = function(code) {
    responseStatus = code;
    return originalStatus.call(this, code);
  };

  // Continue to next middleware
  next();

  // Log after response is sent
  res.on('finish', async () => {
    const processingTime = Date.now() - startTime;

    try {
      await database.logWebhookRequest({
        endpoint: req.path,
        method: req.method,
        headers: req.headers,
        body: req.body,
        query_params: req.query,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent'),
        response_status: responseStatus || res.statusCode,
        response_body: responseBody,
        processing_time_ms: processingTime,
        error_message: null
      });
    } catch (error) {
      logger.error('Failed to log webhook request:', error);
    }
  });
}

// Apply logging middleware to all webhook routes
router.use(logWebhookMiddleware);

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

// Validation schema for tracker device webhook format
const trackerPayloadSchema = Joi.object({
  SerNo: Joi.number().integer().required(),
  IMEI: Joi.string().length(15).pattern(/^\d+$/).required(),
  ICCID: Joi.string().optional(),
  ProdId: Joi.number().integer().optional(),
  FW: Joi.string().optional(),
  Records: Joi.array().items(
    Joi.object({
      SeqNo: Joi.number().integer().required(),
      Reason: Joi.number().integer().required(),
      DateUTC: Joi.string().required(),
      Fields: Joi.array().items(
        Joi.object({
          GpsUTC: Joi.string().optional(),
          Lat: Joi.number().min(-90).max(90).optional(),
          Long: Joi.number().min(-180).max(180).optional(),
          Alt: Joi.number().optional(),
          Spd: Joi.number().min(0).optional(),
          SpdAcc: Joi.number().optional(),
          Head: Joi.number().min(0).max(360).optional(),
          PDOP: Joi.number().optional(),
          PosAcc: Joi.number().optional(),
          GpsStat: Joi.number().optional(),
          FType: Joi.number().integer().required(),
          DIn: Joi.number().optional(),
          DOut: Joi.number().optional(),
          DevStat: Joi.number().optional(),
          AnalogueData: Joi.object().optional()
        })
      ).required()
    })
  ).required()
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
 * Tracker Device GPS Webhook Endpoint
 * POST /api/webhooks/tracker-gps
 *
 * Receives GPS updates from tracker devices in the format:
 * {"SerNo":1326997,"IMEI":"353760970649317","Records":[...]}
 */
router.post('/tracker-gps', async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate payload
    const { error, value } = trackerPayloadSchema.validate(req.body);
    if (error) {
      logger.warn('Invalid tracker payload received:', {
        error: error.details[0].message,
        payload: req.body
      });

      return res.status(400).json({
        error: 'Invalid payload',
        details: error.details[0].message,
        received: req.body
      });
    }

    const { SerNo, IMEI, Records } = value;

    // Get device mapping from IMEI
    const deviceMapping = await database.getDeviceMappingByIMEI(IMEI);
    if (!deviceMapping) {
      logger.warn('GPS data received for unmapped device:', {
        SerNo,
        IMEI,
        recordCount: Records.length
      });

      return res.status(404).json({
        error: 'Device not mapped to any boat',
        message: 'Please configure device mapping in CMS',
        SerNo,
        IMEI,
        recordCount: Records.length
      });
    }

    const boatNumber = deviceMapping.boat_number;
    const boatName = deviceMapping.boat_name;

    logger.info(`GPS update received for boat ${boatNumber} (${boatName})`, {
      SerNo,
      IMEI,
      boatNumber,
      recordCount: Records.length
    });

    const processedRecords = [];

    // Process each GPS record
    for (const record of Records) {
      try {
        // Find GPS field (FType = 0)
        const gpsField = record.Fields.find(field => field.FType === 0);

        if (!gpsField || !gpsField.Lat || !gpsField.Long) {
          logger.debug('Record without valid GPS data skipped', { SeqNo: record.SeqNo });
          continue;
        }

        const { Lat: latitude, Long: longitude, Alt: altitude, Spd: speed, Head: heading, PosAcc: accuracy, GpsUTC } = gpsField;

        // Use GPS timestamp or record timestamp
        const timestamp = new Date(GpsUTC || record.DateUTC);

        // Map GPS coordinates to parade route
        const routePosition = await routeMapper.mapToRoute({
          latitude,
          longitude,
          timestamp
        });

        if (!routePosition) {
          logger.warn(`Could not map GPS position to route for boat ${boatNumber}`, {
            boatNumber,
            IMEI,
            coordinates: [latitude, longitude],
            SeqNo: record.SeqNo
          });
          continue;
        }

        // Prepare position data
        const positionData = {
          latitude,
          longitude,
          timestamp,
          routeDistance: routePosition.distanceMeters,
          routeProgress: routePosition.progressPercent,
          speed: speed || routePosition.estimatedSpeed,
          heading: heading || routePosition.heading,
          altitude: altitude || null,
          accuracy: accuracy || null
        };

        // Save to database
        try {
          await database.saveBoatPosition(boatNumber, {
            ...positionData,
            imei: IMEI,
            device_imei: IMEI
          });
        } catch (dbError) {
          logger.error('Failed to save position to database:', dbError);
          // Continue processing even if database save fails
        }

        // Update in-memory boat state
        const updatedBoat = await boatState.updateBoatPosition(boatNumber, positionData);

        // Trigger corridor algorithm and status updates
        await updateBoatState(boatNumber, updatedBoat);

        processedRecords.push({
          SeqNo: record.SeqNo,
          timestamp: timestamp.toISOString(),
          coordinates: [latitude, longitude],
          routeProgress: routePosition.progressPercent
        });

        logger.debug(`GPS record processed for boat ${boatNumber}`, {
          SeqNo: record.SeqNo,
          routeProgress: routePosition.progressPercent
        });

      } catch (recordError) {
        logger.error('Error processing GPS record:', {
          error: recordError.message,
          SeqNo: record.SeqNo,
          boatNumber
        });
      }
    }

    const processingTime = Date.now() - startTime;

    logger.info(`Tracker GPS update processed for boat ${boatNumber}`, {
      boatNumber,
      boatName,
      IMEI,
      totalRecords: Records.length,
      processedRecords: processedRecords.length,
      processingTimeMs: processingTime
    });

    // Return success response
    res.status(200).json({
      success: true,
      boatNumber,
      boatName,
      IMEI,
      SerNo,
      processed: {
        timestamp: new Date().toISOString(),
        totalRecords: Records.length,
        processedRecords: processedRecords.length,
        processingTimeMs: processingTime
      },
      records: processedRecords,
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          deviceMapping,
          rawPayload: req.body
        }
      })
    });

  } catch (error) {
    logger.error('Error processing tracker GPS webhook:', {
      error: error.message,
      stack: error.stack,
      payload: req.body
    });

    res.status(500).json({
      error: 'Internal server error processing tracker GPS update',
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

/**
 * Get Webhook Logs
 * GET /api/webhooks/logs
 *
 * Returns recent webhook requests for monitoring
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const logs = await database.getWebhookLogs(limit, offset);
    const stats = await database.getWebhookStats();

    res.json({
      success: true,
      data: {
        logs,
        stats,
        pagination: {
          limit,
          offset,
          total: stats.total_requests
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching webhook logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhook logs',
      message: error.message
    });
  }
});

/**
 * Get Webhook Statistics
 * GET /api/webhooks/stats
 *
 * Returns webhook usage statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await database.getWebhookStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching webhook stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhook stats',
      message: error.message
    });
  }
});

module.exports = router;
