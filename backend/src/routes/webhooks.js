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
  imei: Joi.string().min(10).max(20).optional(), // More flexible IMEI
  SerNo: Joi.number().integer().optional(), // Allow SerNo for tracking
  SerialNumber: Joi.number().integer().optional(), // Alternative serial field
  serial: Joi.number().integer().optional(), // Another alternative
  timestamp: Joi.string().isoDate().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  altitude: Joi.number().optional(),
  accuracy: Joi.number().min(0).optional(),
  speed: Joi.number().min(0).optional(),
  heading: Joi.number().min(0).max(360).optional()
}).unknown(true); // Allow unknown fields for flexibility

// Flexible validation schema for tracker device webhook format
// Accepts real KPN data with various field combinations
const trackerPayloadSchema = Joi.object({
  SerNo: Joi.number().integer().required(),
  IMEI: Joi.string().min(10).max(20).required(), // More flexible IMEI length
  ICCID: Joi.string().optional(),
  ProdId: Joi.number().integer().optional(),
  FW: Joi.string().optional(),
  Records: Joi.array().items(
    Joi.object({
      SeqNo: Joi.number().integer().optional(), // Made optional
      Reason: Joi.number().integer().optional(), // Made optional
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
          FType: Joi.number().integer().optional(), // Made optional
          DIn: Joi.number().optional(),
          DOut: Joi.number().optional(),
          DevStat: Joi.number().optional(),
          AnalogueData: Joi.object().optional(),
          // Allow any additional fields that KPN might send
          ...Joi.object().pattern(Joi.string(), Joi.any()).optional()
        }).unknown(true) // Allow unknown fields
      ).optional() // Made optional in case Records structure varies
    }).unknown(true) // Allow unknown fields at record level
  ).required()
}).unknown(true); // Allow unknown fields at top level

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

    // Extract serial number if present in payload
    const serNo = req.body.SerNo || req.body.SerialNumber || req.body.serial || null;

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

    // Log GPS data even if boat not found (for serial tracking)
    logger.info('KPN GPS data received:', {
      bootnummer,
      imei,
      serNo,
      coordinates: [latitude, longitude],
      timestamp,
      boatFound: !!boat
    });

    if (!boat) {
      logger.warn('GPS data received for unknown boat - logging serial data:', {
        bootnummer,
        imei,
        serNo,
        coordinates: [latitude, longitude]
      });

      // Return success instead of error to keep KPN happy
      return res.status(200).json({
        success: true,
        message: 'GPS data received and logged (boat not mapped)',
        device: {
          bootnummer,
          imei,
          serNo,
          mapped: false
        },
        gpsData: {
          timestamp,
          coordinates: [latitude, longitude],
          altitude,
          accuracy,
          speed,
          heading
        },
        processed: {
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime
        }
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
    let boatNumber = null;

    if (!deviceMapping) {
      logger.warn('GPS data received for unmapped device - storing serial data anyway:', {
        SerNo,
        IMEI,
        recordCount: Records.length
      });
      // Continue processing even without mapping - just log the serial data
    } else {
      boatNumber = deviceMapping.boat_number;
      logger.info('GPS data received for mapped device:', {
        SerNo,
        IMEI,
        boatNumber,
        recordCount: Records.length
      });
    }

    const boatName = deviceMapping?.boat_name || 'Unmapped Device';

    const processedRecords = [];

    // Process each GPS record
    for (const record of Records) {
      try {
        // Find GPS field - try multiple methods for flexibility
        let gpsField = null;

        if (record.Fields && Array.isArray(record.Fields)) {
          // Method 1: Find GPS data by FType 0
          gpsField = record.Fields.find(field => field.FType === 0);

          // Method 2: Find any field with Lat/Long if FType method fails
          if (!gpsField || !gpsField.Lat || !gpsField.Long) {
            gpsField = record.Fields.find(field => field.Lat && field.Long);
          }
        }

        // Method 3: Check if GPS data is directly in the record
        if (!gpsField && record.Lat && record.Long) {
          gpsField = record;
        }

        if (!gpsField || !gpsField.Lat || !gpsField.Long) {
          logger.debug('Record without valid GPS data skipped', {
            SeqNo: record.SeqNo,
            hasFields: !!record.Fields,
            fieldsCount: record.Fields?.length || 0,
            recordKeys: Object.keys(record)
          });
          continue;
        }

        const { Lat: latitude, Long: longitude, Alt: altitude, Spd: speed, Head: heading, PosAcc: accuracy, GpsUTC } = gpsField;

        // Use GPS timestamp or record timestamp
        const timestamp = new Date(GpsUTC || record.DateUTC);

        // Prepare basic position data
        const positionData = {
          latitude,
          longitude,
          timestamp,
          speed: speed || null,
          heading: heading || null,
          altitude: altitude || null,
          accuracy: accuracy || null,
          serNo: SerNo,
          imei: IMEI
        };

        // Try to map GPS coordinates to parade route (only if we have a boat mapping)
        let routePosition = null;
        if (boatNumber) {
          try {
            routePosition = await routeMapper.mapToRoute({
              latitude,
              longitude,
              timestamp
            });

            if (routePosition) {
              positionData.routeDistance = routePosition.distanceMeters;
              positionData.routeProgress = routePosition.progressPercent;
              positionData.speed = speed || routePosition.estimatedSpeed;
              positionData.heading = heading || routePosition.heading;
            }
          } catch (routeError) {
            logger.warn('Route mapping failed, continuing with basic GPS data:', routeError.message);
          }
        }

        // Save to database (only if we have a boat number)
        if (boatNumber) {
          try {
            await database.saveBoatPosition(boatNumber, {
              ...positionData,
              device_imei: IMEI
            });

            // Update in-memory boat state
            const updatedBoat = await boatState.updateBoatPosition(boatNumber, positionData);

            // Trigger corridor algorithm and status updates
            await updateBoatState(boatNumber, updatedBoat);
          } catch (dbError) {
            logger.error('Failed to save position to database:', dbError);
            // Continue processing even if database save fails
          }
        }

        // Always log the GPS data for serial tracking
        logger.info('GPS data processed:', {
          SerNo,
          IMEI,
          boatNumber: boatNumber || 'unmapped',
          latitude,
          longitude,
          timestamp: timestamp.toISOString(),
          hasRouteMapping: !!routePosition
        });

        processedRecords.push({
          SeqNo: record.SeqNo,
          serNo: SerNo,
          imei: IMEI,
          timestamp: timestamp.toISOString(),
          coordinates: [latitude, longitude],
          routeProgress: routePosition?.progressPercent || null,
          boatNumber: boatNumber || null,
          mapped: !!boatNumber
        });

        logger.debug(`GPS record processed`, {
          SeqNo: record.SeqNo,
          SerNo,
          IMEI,
          boatNumber: boatNumber || 'unmapped',
          routeProgress: routePosition?.progressPercent || null
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

    logger.info(`Tracker GPS update processed`, {
      SerNo,
      IMEI,
      boatNumber: boatNumber || 'unmapped',
      boatName,
      totalRecords: Records.length,
      processedRecords: processedRecords.length,
      processingTimeMs: processingTime,
      mapped: !!boatNumber
    });

    // Always return success response (even for unmapped devices)
    res.status(200).json({
      success: true,
      message: boatNumber ? 'GPS data processed and mapped to boat' : 'GPS data received and logged (device not mapped)',
      device: {
        SerNo,
        IMEI,
        mapped: !!boatNumber,
        boatNumber: boatNumber || null,
        boatName: boatName || null
      },
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
 * KPN Serial Data Webhook Endpoint
 * POST /api/webhooks/kpn-serial
 *
 * Simplified endpoint for KPN serial data with minimal validation
 * Accepts any JSON payload and extracts GPS data flexibly
 */
router.post('/kpn-serial', async (req, res) => {
  const startTime = Date.now();

  try {
    logger.info('KPN Serial webhook received:', {
      body: req.body,
      headers: req.headers,
      ip: req.ip
    });

    // Very basic validation - just check if we have some data
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Invalid payload - expected JSON object',
        received: req.body
      });
    }

    const payload = req.body;
    let processedRecords = [];

    // Extract SerNo/IMEI for identification
    const serNo = payload.SerNo || payload.SerialNumber || payload.serial;
    const imei = payload.IMEI || payload.imei;

    logger.info('Processing KPN serial data:', { serNo, imei });

    // Try to extract GPS data from various possible structures
    let records = [];

    if (payload.Records && Array.isArray(payload.Records)) {
      records = payload.Records;
    } else if (payload.records && Array.isArray(payload.records)) {
      records = payload.records;
    } else if (payload.data && Array.isArray(payload.data)) {
      records = payload.data;
    } else if (payload.Lat && payload.Long) {
      // Single GPS record
      records = [payload];
    }

    for (const record of records) {
      try {
        let lat = null, lng = null, timestamp = null;

        // Try different ways to extract GPS coordinates
        if (record.Lat && record.Long) {
          lat = record.Lat;
          lng = record.Long;
        } else if (record.latitude && record.longitude) {
          lat = record.latitude;
          lng = record.longitude;
        } else if (record.Fields && Array.isArray(record.Fields)) {
          for (const field of record.Fields) {
            if (field.Lat && field.Long) {
              lat = field.Lat;
              lng = field.Long;
              break;
            }
          }
        }

        // Try different timestamp formats
        timestamp = record.GpsUTC || record.DateUTC || record.timestamp || record.time || new Date().toISOString();

        if (lat && lng) {
          processedRecords.push({
            latitude: lat,
            longitude: lng,
            timestamp: timestamp,
            serNo: serNo,
            imei: imei,
            rawRecord: record
          });

          logger.info('GPS data extracted:', {
            serNo,
            imei,
            lat,
            lng,
            timestamp
          });
        }
      } catch (recordError) {
        logger.warn('Error processing record:', recordError);
      }
    }

    const processingTime = Date.now() - startTime;

    // Return success response
    res.status(200).json({
      success: true,
      message: 'KPN serial data received',
      serNo,
      imei,
      processed: {
        timestamp: new Date().toISOString(),
        totalRecords: records.length,
        processedRecords: processedRecords.length,
        processingTimeMs: processingTime
      },
      gpsData: processedRecords,
      debug: {
        originalPayload: payload
      }
    });

  } catch (error) {
    logger.error('Error processing KPN serial webhook:', {
      error: error.message,
      stack: error.stack,
      payload: req.body
    });

    res.status(500).json({
      error: 'Internal server error processing KPN serial data',
      timestamp: new Date().toISOString(),
      details: error.message
    });
  }
});

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
