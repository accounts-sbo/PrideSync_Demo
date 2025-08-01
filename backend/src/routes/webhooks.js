const express = require('express');
const Joi = require('joi');
const logger = require('../services/logger');
const routeMapper = require('../services/routeMapper');
const boatState = require('../services/boatState');
const database = require('../models/database');

const router = express.Router();

/**
 * Extract and save GPS position from webhook payload
 * Scans for Long/Lat fields, timestamp, and accuracy (PosAcc)
 */
async function extractAndSaveGPSPosition(payload, serNo, deviceIMEI, boatNumber = null) {
  logger.info('🔍 Extracting GPS data from webhook payload:', { SerNo: serNo, IMEI: deviceIMEI });

  try {
    // Scan payload for GPS data in Records.Fields array
    let gpsData = null;
    let gpsTimestamp = null;

    if (payload.Records && Array.isArray(payload.Records)) {
      for (const record of payload.Records) {
        if (record.Fields && Array.isArray(record.Fields)) {
          for (const field of record.Fields) {
            // Look for GPS coordinates (Long/Lat or Lng/Lat)
            if ((field.Long !== undefined || field.Lng !== undefined) && field.Lat !== undefined) {
              gpsData = {
                latitude: parseFloat(field.Lat),
                longitude: parseFloat(field.Long || field.Lng),
                altitude: field.Alt ? parseFloat(field.Alt) : null,
                speed: field.Spd ? parseFloat(field.Spd) : null,
                heading: field.Head ? parseFloat(field.Head) : null,
                accuracy: field.PosAcc ? parseFloat(field.PosAcc) : null, // Position accuracy
                pdop: field.PDOP ? parseFloat(field.PDOP) : null, // Dilution of precision
                gpsStatus: field.GpsStat ? parseInt(field.GpsStat) : null
              };

              // Use GPS timestamp if available, otherwise record timestamp
              gpsTimestamp = field.GpsUTC || record.DateUTC || new Date().toISOString();

              logger.info('📍 GPS data extracted:', {
                lat: gpsData.latitude,
                lng: gpsData.longitude,
                accuracy: gpsData.accuracy,
                timestamp: gpsTimestamp,
                SerNo: serNo
              });

              break;
            }
          }
          if (gpsData) break;
        }
      }
    }

    // If no GPS data found, return null
    if (!gpsData || !gpsData.latitude || !gpsData.longitude) {
      logger.warn('⚠️ No valid GPS coordinates found in webhook payload');
      return null;
    }

    // Prepare GPS position data for database (without foreign key constraint)
    const gpsPositionData = {
      tracker_name: serNo ? serNo.toString() : (deviceIMEI || 'unknown'),
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      altitude: gpsData.altitude,
      accuracy: gpsData.accuracy,
      speed: gpsData.speed,
      heading: gpsData.heading,
      timestamp: new Date(gpsTimestamp),
      raw_data: {
        SerNo: serNo,
        IMEI: deviceIMEI,
        gpsStatus: gpsData.gpsStatus,
        pdop: gpsData.pdop,
        originalPayload: payload
      }
    };

    // Save to database using direct insert (bypass foreign key constraint)
    const savedId = await database.saveGPSPositionDirect(gpsPositionData);

    logger.info('✅ GPS position saved to database:', {
      id: savedId,
      SerNo: serNo,
      tracker: gpsPositionData.tracker_name,
      lat: gpsData.latitude,
      lng: gpsData.longitude,
      accuracy: gpsData.accuracy,
      mapped: !!boatNumber
    });

    return gpsPositionData;

  } catch (error) {
    logger.error('❌ Error extracting/saving GPS position:', error);
    throw error;
  }
}

// Middleware to log webhook requests (only for actual webhook endpoints, not monitoring)
async function logWebhookMiddleware(req, res, next) {
  // Skip logging for monitoring endpoints
  if (req.path === '/logs' || req.path === '/stats' || req.path === '/gps-positions') {
    return next();
  }

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

  // Log immediately after response is sent
  res.on('finish', async () => {
    const processingTime = Date.now() - startTime;
    const finalStatus = responseStatus || res.statusCode;

    try {
      logger.info(`🔍 Webhook logging: ${req.method} ${req.path} - Status: ${finalStatus}`);

      const webhookData = {
        endpoint: req.path,
        method: req.method,
        headers: req.headers,
        body: req.body,
        query_params: req.query,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent'),
        response_status: finalStatus,
        response_body: responseBody,
        processing_time_ms: processingTime,
        error_message: null
      };

      await database.logWebhookRequest(webhookData);

      logger.info(`✅ Webhook logged: ${req.method} ${req.path} (${finalStatus}) - ${processingTime}ms`);
    } catch (error) {
      logger.error('❌ Failed to log webhook request:', {
        error: error.message,
        stack: error.stack,
        endpoint: req.path,
        method: req.method,
        status: finalStatus
      });
    }
  });
}

// Apply logging middleware to all webhook routes
router.use(logWebhookMiddleware);

// Enhanced validation schema for KPN GPS webhook - flexible for different formats
const gpsPayloadSchema = Joi.object({
  bootnummer: Joi.number().integer().min(1).max(999).optional(),
  imei: Joi.string().min(10).max(20).optional(), // More flexible IMEI
  IMEI: Joi.string().min(10).max(20).optional(), // KPN uses uppercase IMEI
  SerNo: Joi.number().integer().optional(), // Allow SerNo for tracking
  SerialNumber: Joi.number().integer().optional(), // Alternative serial field
  serial: Joi.number().integer().optional(), // Another alternative
  timestamp: Joi.string().isoDate().optional(), // Optional for simple format
  DateUTC: Joi.string().isoDate().optional(), // KPN uses DateUTC
  latitude: Joi.number().min(-90).max(90).optional(), // Optional for KPN format
  longitude: Joi.number().min(-180).max(180).optional(), // Optional for KPN format
  altitude: Joi.number().optional(),
  accuracy: Joi.number().min(0).optional(),
  speed: Joi.number().min(0).optional(),
  heading: Joi.number().min(0).max(360).optional(),
  // KPN specific fields
  ICCID: Joi.string().optional(),
  ProdId: Joi.number().optional(),
  FW: Joi.string().optional(),
  Records: Joi.array().items(Joi.object({
    SeqNo: Joi.number().optional(),
    Reason: Joi.number().optional(),
    DateUTC: Joi.string().isoDate().optional(),
    Fields: Joi.array().items(Joi.object({
      FType: Joi.number().optional(),
      Lat: Joi.number().optional(),
      Long: Joi.number().optional(),
      Alt: Joi.number().optional(),
      Speed: Joi.number().optional(),
      Course: Joi.number().optional(),
      Sat: Joi.number().optional(),
      HDOP: Joi.number().optional()
    }).unknown(true)).optional()
  }).unknown(true)).optional()
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
          AnalogueData: Joi.object().optional()
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
router.post('/kpn-gps', logWebhookMiddleware, async (req, res) => {
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

    // Extract data from payload - handle both simple and KPN formats
    const { bootnummer, imei, IMEI, timestamp, DateUTC, latitude, longitude, altitude, accuracy, speed, heading, Records } = value;

    // Extract serial number if present in payload
    const serNo = req.body.SerNo || req.body.SerialNumber || req.body.serial || null;

    // Use IMEI or imei (KPN uses uppercase)
    const deviceIMEI = IMEI || imei;

    // Extract GPS data from KPN Records format or direct fields
    let gpsData = null;
    let gpsTimestamp = timestamp || DateUTC;

    if (Records && Array.isArray(Records) && Records.length > 0) {
      // KPN format: extract from Records array
      const record = Records[0]; // Use first record
      gpsTimestamp = gpsTimestamp || record.DateUTC;

      if (record.Fields && Array.isArray(record.Fields)) {
        // Find GPS field (FType 0 or 1 is usually GPS, support both Long and Lng)
        const gpsField = record.Fields.find(field =>
          (field.FType === 0 || field.FType === 1) &&
          field.Lat && (field.Long || field.Lng)
        ) || record.Fields.find(field =>
          field.Lat && (field.Long || field.Lng)
        );

        if (gpsField) {
          gpsData = {
            latitude: gpsField.Lat,
            longitude: gpsField.Long || gpsField.Lng,
            altitude: gpsField.Alt || altitude,
            accuracy: gpsField.Acc || accuracy,
            speed: gpsField.Speed || speed,
            heading: gpsField.Course || heading
          };

          logger.info('🎯 GPS coordinates extracted from Records:', {
            latitude: gpsData.latitude,
            longitude: gpsData.longitude,
            FType: gpsField.FType
          });
        } else {
          logger.warn('❌ No GPS field found in Records.Fields:', record.Fields);
        }
      }
    } else if (latitude && longitude) {
      // Simple format: direct lat/long fields
      gpsData = {
        latitude,
        longitude,
        altitude,
        accuracy,
        speed,
        heading
      };
    }

    if (!gpsData) {
      logger.warn('No GPS coordinates found in payload:', req.body);
      return res.status(200).json({
        success: true,
        message: 'Data received but no GPS coordinates found',
        device: { serNo, IMEI: deviceIMEI, mapped: false }
      });
    }

    // Determine boat identifier and get boat info from database
    let boat = null;
    let boatIdentifier = null;

    if (bootnummer) {
      boat = await database.getBoat(bootnummer);
      boatIdentifier = bootnummer;
    } else if (deviceIMEI) {
      boat = await database.getBoat(deviceIMEI);
      boatIdentifier = deviceIMEI;
    }

    // Log GPS data even if boat not found (for serial tracking)
    logger.info('KPN GPS data received:', {
      bootnummer,
      imei: deviceIMEI,
      serNo,
      coordinates: [gpsData.latitude, gpsData.longitude],
      timestamp: gpsTimestamp,
      boatFound: !!boat,
      recordCount: Records ? Records.length : 0
    });

    if (!boat) {
      logger.warn('GPS data received for unknown boat - logging serial data:', {
        bootnummer,
        imei: deviceIMEI,
        serNo,
        coordinates: [gpsData.latitude, gpsData.longitude],
        timestamp: gpsTimestamp
      });

      // Return success instead of error to keep KPN happy
      return res.status(200).json({
        success: true,
        message: 'GPS data received and logged (device not mapped)',
        device: {
          SerNo: serNo,
          IMEI: deviceIMEI,
          bootnummer,
          mapped: false
        },
        gpsData: {
          timestamp: gpsTimestamp,
          coordinates: [gpsData.latitude, gpsData.longitude],
          ...gpsData
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
      serNo,
      timestamp: gpsTimestamp,
      coordinates: [gpsData.latitude, gpsData.longitude],
      accuracy: gpsData.accuracy,
      speed: gpsData.speed || 'unknown'
    });

    // Map GPS coordinates to parade route
    const routePosition = await routeMapper.mapToRoute({
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      timestamp: new Date(gpsTimestamp)
    });

    if (!routePosition) {
      logger.warn(`Could not map GPS position to route for boat ${actualBoatNumber}`, {
        bootnummer: actualBoatNumber,
        imei: boat.imei,
        serNo,
        coordinates: [gpsData.latitude, gpsData.longitude]
      });

      // Return success even if route mapping fails
      return res.status(200).json({
        success: true,
        message: 'GPS data processed but not mapped to route',
        device: {
          SerNo: serNo,
          IMEI: deviceIMEI,
          mapped: true,
          boatNumber: actualBoatNumber,
          boatName: boat.name
        },
        gpsData: {
          timestamp: gpsTimestamp,
          coordinates: [gpsData.latitude, gpsData.longitude],
          ...gpsData
        }
      });
    }

    // Prepare position data
    const positionData = {
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      timestamp: new Date(gpsTimestamp),
      routeDistance: routePosition.distanceMeters,
      routeProgress: routePosition.progressPercent,
      speed: gpsData.speed || routePosition.estimatedSpeed,
      heading: gpsData.heading || routePosition.heading,
      altitude: gpsData.altitude || null,
      accuracy: accuracy || null
    };

    // Save to database (mapped boats)
    if (actualBoatNumber) {
      try {
        await database.saveBoatPosition(actualBoatNumber, {
          ...positionData,
          imei: boat.imei
        });
      } catch (dbError) {
        logger.error('Failed to save position to database:', dbError);
        // Continue processing even if database save fails
      }
    }

    // Always save GPS data for later analysis (even unmapped devices)
    let gpsPositionData = null;
    let gpsMapped = false;

    try {
      gpsPositionData = await extractAndSaveGPSPosition(req.body, serNo, deviceIMEI, actualBoatNumber);

      if (gpsPositionData) {
        gpsMapped = true;
        logger.info('✅ GPS position saved successfully:', {
          SerNo: serNo,
          IMEI: deviceIMEI,
          boatNumber: actualBoatNumber || 'unmapped',
          latitude: gpsPositionData.latitude,
          longitude: gpsPositionData.longitude,
          accuracy: gpsPositionData.accuracy,
          timestamp: gpsPositionData.timestamp,
          mapped: !!actualBoatNumber
        });
      }
    } catch (saveError) {
      logger.error('Failed to save GPS data for analysis:', saveError);
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
      mapped: gpsMapped, // GPS position successfully saved to database
      gps: gpsPositionData ? {
        latitude: gpsPositionData.latitude,
        longitude: gpsPositionData.longitude,
        accuracy: gpsPositionData.accuracy,
        timestamp: gpsPositionData.timestamp
      } : null,
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
router.post('/tracker-gps', logWebhookMiddleware, async (req, res) => {
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

        // Always save GPS data for later analysis (even unmapped devices)
        let recordGpsData = null;
        try {
          recordGpsData = await extractAndSaveGPSPosition(req.body, SerNo, IMEI, boatNumber);

          if (recordGpsData) {
            logger.info('✅ GPS position saved from tracker-gps webhook:', {
              SerNo,
              IMEI,
              boatNumber: boatNumber || 'unmapped',
              latitude: recordGpsData.latitude,
              longitude: recordGpsData.longitude,
              accuracy: recordGpsData.accuracy,
              timestamp: recordGpsData.timestamp,
              hasRouteMapping: !!routePosition
            });
          }
        } catch (saveError) {
          logger.error('Failed to save GPS data for analysis:', saveError);
        }

        processedRecords.push({
          SeqNo: record.SeqNo,
          serNo: SerNo,
          imei: IMEI,
          timestamp: timestamp.toISOString(),
          coordinates: [latitude, longitude],
          routeProgress: routePosition?.progressPercent || null,
          boatNumber: boatNumber || null,
          mapped: !!recordGpsData, // GPS successfully saved to database
          gps: recordGpsData ? {
            latitude: recordGpsData.latitude,
            longitude: recordGpsData.longitude,
            accuracy: recordGpsData.accuracy
          } : null
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
router.post('/kpn-serial', logWebhookMiddleware, async (req, res) => {
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

    logger.info(`📋 Fetching webhook logs: limit=${limit}, offset=${offset}`);

    const logs = await database.getWebhookLogs(limit, offset);
    const stats = await database.getWebhookStats();

    logger.info(`📊 Webhook logs retrieved: ${logs.length} logs, ${stats.total_requests} total`);

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
      },
      debug: {
        logsCount: logs.length,
        totalRequests: stats.total_requests,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error fetching webhook logs:', error);
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

/**
 * Get Latest GPS Positions
 * GET /api/webhooks/gps-positions
 *
 * Returns latest GPS positions for all tracked devices for map display
 */
router.get('/gps-positions', async (req, res) => {
  try {
    const positions = await database.getLatestGPSPositions();

    res.json({
      success: true,
      data: positions,
      count: positions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching GPS positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GPS positions',
      message: error.message
    });
  }
});

/**
 * Test Webhook Logging
 * POST /api/webhooks/test-log
 *
 * Creates a test webhook log entry for debugging
 */
router.post('/test-log', logWebhookMiddleware, async (req, res) => {
  try {
    logger.info('🧪 Creating test webhook log entry');

    const testData = {
      endpoint: '/api/webhooks/test-log',
      method: 'POST',
      headers: req.headers,
      body: req.body || { test: 'data', timestamp: new Date().toISOString() },
      query_params: req.query,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      response_status: 200,
      response_body: { success: true, test: true },
      processing_time_ms: Math.floor(Math.random() * 100) + 10,
      error_message: null
    };

    await database.logWebhookRequest(testData);

    logger.info('✅ Test webhook log created successfully');

    res.json({
      success: true,
      message: 'Test webhook log created',
      data: testData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to create test webhook log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test log',
      message: error.message
    });
  }
});

/**
 * Test GPS Position Save
 * POST /api/webhooks/test-gps
 *
 * Creates a test GPS position for debugging database save
 */
router.post('/test-gps', async (req, res) => {
  try {
    logger.info('🧪 Testing GPS position save');

    const testGPSData = {
      tracker_name: 'TEST_TRACKER',
      kpn_tracker_id: 9999999,
      pride_boat_id: null,
      parade_position: null,
      latitude: 52.3676,
      longitude: 4.9041,
      altitude: 10,
      accuracy: null,
      speed: 0,
      heading: 90,
      timestamp: new Date(),
      raw_data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    logger.info('🗺️ Attempting to save test GPS position:', testGPSData);

    const savedId = await database.saveGPSPosition(testGPSData);

    logger.info('✅ Test GPS position saved with ID:', savedId);

    // Get latest positions to verify
    const positions = await database.getLatestGPSPositions();

    res.json({
      success: true,
      message: 'Test GPS position saved',
      savedId: savedId,
      totalPositions: positions.length,
      testData: testGPSData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to save test GPS position:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save test GPS position',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
