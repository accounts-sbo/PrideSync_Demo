const { Pool } = require('pg');
const redis = require('redis');
const logger = require('../services/logger');

// PostgreSQL connection
let pgPool = null;
let redisClient = null;

// In-memory storage fallback
let inMemoryBoats = [];
let inMemoryPositions = [];
let inMemoryVotes = [];
let inMemoryDeviceMappings = [];
let inMemoryWebhookLogs = [];

/**
 * Initialize database connections
 */
async function initializeDatabase() {
  try {
    // Initialize PostgreSQL
    if (process.env.DATABASE_URL) {
      try {
        pgPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          acquireTimeoutMillis: 5000,
          statement_timeout: 10000,
          query_timeout: 10000
        });

        // Test PostgreSQL connection with timeout
        const client = await Promise.race([
          pgPool.connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 5000)
          )
        ]);
        await client.query('SELECT NOW()');
        client.release();

        logger.info('✅ PostgreSQL connected successfully');

        // Create tables if they don't exist
        await createTables();
      } catch (pgError) {
        logger.error('❌ PostgreSQL connection failed:', pgError.message);
        logger.warn('⚠️ Continuing without PostgreSQL - using in-memory storage');
        pgPool = null;
      }
    } else {
      logger.warn('⚠️ No DATABASE_URL provided, using in-memory storage');
    }

    // Initialize Redis
    if (process.env.REDIS_URL) {
      try {
        redisClient = redis.createClient({
          url: process.env.REDIS_URL,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              logger.error('Redis server connection refused');
              return new Error('Redis server connection refused');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              logger.error('Redis retry time exhausted');
              return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
              logger.error('Redis max retry attempts reached');
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        await redisClient.connect();
        logger.info('✅ Redis connected successfully');
      } catch (redisError) {
        logger.error('❌ Redis connection failed:', redisError.message);
        logger.warn('⚠️ Continuing without Redis - using in-memory caching');
        redisClient = null;
      }
    } else {
      logger.warn('⚠️ No REDIS_URL provided, using in-memory caching');
    }

  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    logger.warn('⚠️ Continuing without database connections - some features may be limited');
    // Don't throw error - allow app to start without database
  }
}

/**
 * Create database tables
 */
async function createTables() {
  // Pride Boats table (Official parade boats from organization)
  const createPrideBoatsTable = `
    CREATE TABLE IF NOT EXISTS pride_boats (
      id SERIAL PRIMARY KEY,
      parade_position INTEGER UNIQUE NOT NULL,
      boat_name VARCHAR(255) NOT NULL,
      organisation VARCHAR(255),
      theme TEXT,
      description TEXT,
      captain_name VARCHAR(255),
      captain_phone VARCHAR(20),
      captain_email VARCHAR(255),
      boat_type VARCHAR(100),
      length_meters DECIMAL(5,2),
      width_meters DECIMAL(5,2),
      max_persons INTEGER,
      status VARCHAR(50) DEFAULT 'registered',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // KPN Trackers table (Physical tracking devices)
  const createKPNTrackersTable = `
    CREATE TABLE IF NOT EXISTS kpn_trackers (
      id SERIAL PRIMARY KEY,
      tracker_name VARCHAR(50) UNIQUE NOT NULL, -- KPN "Name" field (e.g., "1326954")
      asset_code VARCHAR(20) NOT NULL, -- P1, P2, O1, O2, R1, etc.
      asset_type VARCHAR(50) DEFAULT 'Boat',
      device_type VARCHAR(100),
      serial_number VARCHAR(50),
      imei VARCHAR(20),
      enabled BOOLEAN DEFAULT true,
      last_connected TIMESTAMP,
      last_trip TIMESTAMP,
      current_status VARCHAR(100),
      odometer_km DECIMAL(10,2),
      run_hours DECIMAL(10,2),
      project VARCHAR(50),
      department VARCHAR(50),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Boat-Tracker Mappings (Links Pride boats to KPN trackers)
  const createBoatTrackerMappingsTable = `
    CREATE TABLE IF NOT EXISTS boat_tracker_mappings (
      id SERIAL PRIMARY KEY,
      pride_boat_id INTEGER,
      kpn_tracker_id INTEGER,
      parade_position INTEGER,
      tracker_name VARCHAR(50),
      asset_code VARCHAR(20),
      is_active BOOLEAN DEFAULT true,
      mapped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      mapped_by VARCHAR(100),
      notes TEXT,
      FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE CASCADE,
      FOREIGN KEY (kpn_tracker_id) REFERENCES kpn_trackers(id) ON DELETE CASCADE,
      FOREIGN KEY (parade_position) REFERENCES pride_boats(parade_position) ON DELETE CASCADE,
      UNIQUE(pride_boat_id, is_active) -- Only one active mapping per boat
    );
  `;

  // Votes table for the 2025 voting app (updated for new structure)
  const createVotesTable = `
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      pride_boat_id INTEGER,
      parade_position INTEGER,
      vote_type VARCHAR(10) CHECK(vote_type IN ('heart', 'star')),
      user_session VARCHAR(255),
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE CASCADE,
      FOREIGN KEY (parade_position) REFERENCES pride_boats(parade_position) ON DELETE CASCADE
    );
  `;

  // GPS Positions table (linked to trackers)
  const createPositionsTable = `
    CREATE TABLE IF NOT EXISTS gps_positions (
      id SERIAL PRIMARY KEY,
      tracker_name VARCHAR(50) NOT NULL, -- KPN tracker name from webhook
      kpn_tracker_id INTEGER,
      pride_boat_id INTEGER,
      parade_position INTEGER,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      route_distance INTEGER DEFAULT 0,
      route_progress DECIMAL(5, 2) DEFAULT 0,
      speed DECIMAL(5, 2) DEFAULT 0,
      heading INTEGER DEFAULT 0,
      distance_from_route DECIMAL(6, 2) DEFAULT 0,
      altitude DECIMAL(8, 2),
      accuracy DECIMAL(6, 2),
      timestamp TIMESTAMP NOT NULL,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      raw_data JSONB, -- Store original webhook data
      FOREIGN KEY (kpn_tracker_id) REFERENCES kpn_trackers(id) ON DELETE SET NULL,
      FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE SET NULL
    );
  `;

  const createIncidentsTable = `
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      tracker_name VARCHAR(50),
      kpn_tracker_id INTEGER,
      pride_boat_id INTEGER,
      parade_position INTEGER,
      incident_type VARCHAR(100) NOT NULL,
      severity VARCHAR(20) DEFAULT 'info',
      message TEXT,
      metadata JSONB,
      timestamp TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kpn_tracker_id) REFERENCES kpn_trackers(id) ON DELETE SET NULL,
      FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE SET NULL
    );
  `;

  // Webhook logs table for monitoring incoming data
  const createWebhookLogsTable = `
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id SERIAL PRIMARY KEY,
      endpoint VARCHAR(100) NOT NULL,
      method VARCHAR(10) NOT NULL,
      headers JSONB,
      body JSONB,
      query_params JSONB,
      ip_address INET,
      user_agent TEXT,
      response_status INTEGER,
      response_body JSONB,
      processing_time_ms INTEGER,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_gps_positions_tracker_name ON gps_positions(tracker_name);
    CREATE INDEX IF NOT EXISTS idx_gps_positions_timestamp ON gps_positions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_gps_positions_pride_boat ON gps_positions(pride_boat_id);
    CREATE INDEX IF NOT EXISTS idx_boat_tracker_mappings_active ON boat_tracker_mappings(is_active);
    CREATE INDEX IF NOT EXISTS idx_kpn_trackers_asset_code ON kpn_trackers(asset_code);
    CREATE INDEX IF NOT EXISTS idx_pride_boats_position ON pride_boats(parade_position);
    CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint ON webhook_logs(endpoint);
    CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
  `;

  try {
    await pgPool.query(createPrideBoatsTable);
    await pgPool.query(createKPNTrackersTable);
    await pgPool.query(createBoatTrackerMappingsTable);
    await pgPool.query(createVotesTable);
    await pgPool.query(createPositionsTable);
    await pgPool.query(createIncidentsTable);
    await pgPool.query(createWebhookLogsTable);
    await pgPool.query(createIndexes);

    logger.info('✅ Database tables created/verified successfully');
    logger.info('📊 New structure: pride_boats, kpn_trackers, boat_tracker_mappings, webhook_logs');
  } catch (error) {
    logger.error('❌ Error creating database tables:', error);
    throw error;
  }
}

/**
 * Reset database - Drop and recreate all tables
 */
async function resetDatabase() {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const dropTables = `
    DROP TABLE IF EXISTS incidents CASCADE;
    DROP TABLE IF EXISTS gps_positions CASCADE;
    DROP TABLE IF EXISTS votes CASCADE;
    DROP TABLE IF EXISTS boat_tracker_mappings CASCADE;
    DROP TABLE IF EXISTS kpn_trackers CASCADE;
    DROP TABLE IF EXISTS pride_boats CASCADE;

    -- Drop old tables if they exist
    DROP TABLE IF EXISTS boat_incidents CASCADE;
    DROP TABLE IF EXISTS boat_positions CASCADE;
    DROP TABLE IF EXISTS device_mappings CASCADE;
    DROP TABLE IF EXISTS boats CASCADE;
  `;

  try {
    await pgPool.query(dropTables);
    logger.info('🗑️ Old tables dropped');

    await createTables();
    logger.info('✅ Database reset complete with new structure');
  } catch (error) {
    logger.error('❌ Error resetting database:', error);
    throw error;
  }
}

/**
 * Save boat position to database
 */
async function saveBoatPosition(boatNumber, positionData) {
  if (!pgPool) {
    // Save to in-memory storage
    const position = {
      id: inMemoryPositions.length + 1,
      boat_number: boatNumber,
      imei: positionData.imei || null,
      latitude: positionData.latitude,
      longitude: positionData.longitude,
      route_distance: positionData.routeDistance || 0,
      route_progress: positionData.routeProgress || 0,
      speed: positionData.speed || 0,
      heading: positionData.heading || 0,
      distance_from_route: positionData.distanceFromRoute || 0,
      altitude: positionData.altitude || null,
      accuracy: positionData.accuracy || null,
      timestamp: positionData.timestamp,
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    inMemoryPositions.push(position);
    logger.debug(`Position saved (in-memory) for boat ${boatNumber}`, {
      id: position.id,
      imei: positionData.imei
    });
    return position;
  }

  const query = `
    INSERT INTO boat_positions (
      boat_number, imei, latitude, longitude, route_distance, route_progress,
      speed, heading, distance_from_route, altitude, accuracy, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id;
  `;

  const values = [
    boatNumber,
    positionData.imei || null,
    positionData.latitude,
    positionData.longitude,
    positionData.routeDistance || 0,
    positionData.routeProgress || 0,
    positionData.speed || 0,
    positionData.heading || 0,
    positionData.distanceFromRoute || 0,
    positionData.altitude || null,
    positionData.accuracy || null,
    positionData.timestamp
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.debug(`Position saved for boat ${boatNumber}`, {
      id: result.rows[0].id,
      imei: positionData.imei
    });
    return result.rows[0].id;
  } catch (error) {
    logger.error(`Error saving position for boat ${boatNumber}:`, error);
    throw error;
  }
}

/**
 * Save GPS position data for analysis (all devices, mapped and unmapped)
 */
async function saveGPSPosition(gpsData) {
  logger.info('📍 saveGPSPosition called with data:', {
    tracker_name: gpsData.tracker_name,
    latitude: gpsData.latitude,
    longitude: gpsData.longitude,
    timestamp: gpsData.timestamp
  });

  if (!pgPool) {
    logger.warn('❌ No database connection, skipping GPS position save');
    return;
  }

  const query = `
    INSERT INTO gps_positions (
      tracker_name, kpn_tracker_id, pride_boat_id, parade_position,
      latitude, longitude, altitude, accuracy, speed, heading,
      timestamp, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id
  `;

  const values = [
    gpsData.tracker_name,
    gpsData.kpn_tracker_id,
    gpsData.pride_boat_id,
    gpsData.parade_position,
    gpsData.latitude,
    gpsData.longitude,
    gpsData.altitude,
    gpsData.accuracy,
    gpsData.speed,
    gpsData.heading,
    gpsData.timestamp,
    JSON.stringify(gpsData.raw_data)
  ];

  try {
    logger.info('💾 Inserting GPS position into database...');
    const result = await pgPool.query(query, values);
    logger.info(`✅ GPS position saved for tracker ${gpsData.tracker_name}`, {
      id: result.rows[0].id,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude
    });
    return result.rows[0].id;
  } catch (error) {
    logger.error(`Error saving GPS position for tracker ${gpsData.tracker_name}:`, error);
    throw error;
  }
}

/**
 * Get latest GPS positions for all tracked devices
 */
async function getLatestGPSPositions() {
  logger.info('📋 getLatestGPSPositions called');

  if (!pgPool) {
    logger.warn('❌ No database connection, returning empty GPS positions');
    return [];
  }

  // First check if table exists and has data
  try {
    const countResult = await pgPool.query('SELECT COUNT(*) FROM gps_positions');
    const totalCount = parseInt(countResult.rows[0].count);
    logger.info(`📊 Total GPS positions in database: ${totalCount}`);
  } catch (error) {
    logger.error('❌ Error checking GPS positions count:', error);
  }

  // Simple query first to debug
  const query = `
    SELECT
      tracker_name,
      kpn_tracker_id,
      pride_boat_id,
      parade_position,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      timestamp,
      raw_data,
      received_at
    FROM gps_positions
    ORDER BY timestamp DESC
    LIMIT 50
  `;

  try {
    const result = await pgPool.query(query);
    logger.info(`✅ Retrieved ${result.rows.length} latest GPS positions`);
    return result.rows;
  } catch (error) {
    logger.error('❌ Error getting latest GPS positions:', error);
    throw error;
  }
}

/**
 * Save boat incident to database
 */
async function saveBoatIncident(boatNumber, incidentData) {
  if (!pgPool) {
    logger.debug('No database connection, skipping incident save');
    return;
  }

  const query = `
    INSERT INTO boat_incidents (
      boat_number, incident_type, severity, message, metadata, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `;

  const values = [
    boatNumber,
    incidentData.type,
    incidentData.severity || 'info',
    incidentData.message,
    JSON.stringify(incidentData.metadata || {}),
    incidentData.timestamp
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.debug(`Incident saved for boat ${boatNumber}`, { id: result.rows[0].id });
    return result.rows[0].id;
  } catch (error) {
    logger.error(`Error saving incident for boat ${boatNumber}:`, error);
    throw error;
  }
}

/**
 * Get boat position history from database
 */
async function getBoatPositionHistory(boatNumber, limit = 50) {
  if (!pgPool) {
    return [];
  }

  const query = `
    SELECT * FROM boat_positions 
    WHERE boat_number = $1 
    ORDER BY timestamp DESC 
    LIMIT $2;
  `;

  try {
    const result = await pgPool.query(query, [boatNumber, limit]);
    return result.rows;
  } catch (error) {
    logger.error(`Error fetching position history for boat ${boatNumber}:`, error);
    return [];
  }
}

/**
 * Cache data in Redis
 */
async function cacheSet(key, value, expireSeconds = 300) {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.setEx(key, expireSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error(`Error setting cache for key ${key}:`, error);
  }
}

/**
 * Get data from Redis cache
 */
async function cacheGet(key) {
  if (!redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
}

/**
 * Delete data from Redis cache
 */
async function cacheDel(key) {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error(`Error deleting cache for key ${key}:`, error);
  }
}

/**
 * CRUD Operations for Boats
 */

/**
 * Create a new boat
 */
async function createBoat(boatData) {
  if (!pgPool) {
    // Use in-memory storage as fallback
    const newBoat = {
      id: inMemoryBoats.length + 1,
      boat_number: boatData.boat_number,
      name: boatData.name,
      imei: boatData.imei || null,
      description: boatData.description || null,
      captain_name: boatData.captain_name || null,
      captain_phone: boatData.captain_phone || null,
      status: boatData.status || 'waiting',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check for duplicate boat numbers
    const existingBoat = inMemoryBoats.find(b => b.boat_number === boatData.boat_number);
    if (existingBoat) {
      throw new Error(`Boat with number ${boatData.boat_number} already exists`);
    }

    inMemoryBoats.push(newBoat);
    logger.info(`Boat created (in-memory): ${boatData.name}`, { boat_number: boatData.boat_number });
    return newBoat;
  }

  const query = `
    INSERT INTO boats (boat_number, name, imei, description, captain_name, captain_phone, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [
    boatData.boat_number,
    boatData.name,
    boatData.imei || null,
    boatData.description || null,
    boatData.captain_name || null,
    boatData.captain_phone || null,
    boatData.status || 'waiting'
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.info(`Boat created: ${boatData.name}`, { boat_number: boatData.boat_number });
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating boat:', error);
    throw error;
  }
}

/**
 * Get all boats
 */
async function getAllBoats() {
  if (!pgPool) {
    // Return in-memory boats sorted by boat number
    return inMemoryBoats.sort((a, b) => a.boat_number - b.boat_number);
  }

  const query = 'SELECT * FROM boats ORDER BY boat_number ASC';

  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching boats:', error);
    return [];
  }
}

/**
 * Get boat by number or IMEI
 */
async function getBoat(identifier) {
  if (!pgPool) {
    // Search in-memory boats by boat_number or imei
    return inMemoryBoats.find(boat =>
      boat.boat_number == identifier || boat.imei === identifier
    ) || null;
  }

  const query = `
    SELECT * FROM boats
    WHERE boat_number = $1 OR imei = $1
    LIMIT 1;
  `;

  try {
    const result = await pgPool.query(query, [identifier]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching boat:', error);
    return null;
  }
}

/**
 * Update boat
 */
async function updateBoat(boatNumber, updateData) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      fields.push(`${key} = $${paramCount}`);
      values.push(updateData[key]);
      paramCount++;
    }
  });

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(boatNumber);

  const query = `
    UPDATE boats
    SET ${fields.join(', ')}
    WHERE boat_number = $${paramCount}
    RETURNING *;
  `;

  try {
    const result = await pgPool.query(query, values);
    logger.info(`Boat updated: ${boatNumber}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating boat:', error);
    throw error;
  }
}

/**
 * Delete boat
 */
async function deleteBoat(boatNumber) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const query = 'DELETE FROM boats WHERE boat_number = $1 RETURNING *';

  try {
    const result = await pgPool.query(query, [boatNumber]);
    if (result.rows.length > 0) {
      logger.info(`Boat deleted: ${boatNumber}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    logger.error('Error deleting boat:', error);
    throw error;
  }
}

/**
 * Device Mapping Functions
 */

/**
 * Create device mapping
 */
async function createDeviceMapping(mappingData) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const query = `
    INSERT INTO device_mappings (boat_id, boat_number, device_imei, device_serial, mac_address, is_active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    mappingData.boat_id || null,
    mappingData.boat_number,
    mappingData.device_imei,
    mappingData.device_serial || null,
    mappingData.mac_address || null,
    mappingData.is_active !== undefined ? mappingData.is_active : true
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.info(`Device mapping created for boat ${mappingData.boat_number}`, {
      imei: mappingData.device_imei
    });
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating device mapping:', error);
    throw error;
  }
}

/**
 * Get device mapping by IMEI
 */
async function getDeviceMappingByIMEI(imei) {
  if (!pgPool) {
    return null;
  }

  const query = `
    SELECT dm.*, b.name as boat_name, b.organisation, b.theme
    FROM device_mappings dm
    LEFT JOIN boats b ON dm.boat_number = b.boat_number
    WHERE dm.device_imei = $1 AND dm.is_active = true
    LIMIT 1;
  `;

  try {
    const result = await pgPool.query(query, [imei]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching device mapping:', error);
    return null;
  }
}

/**
 * Get all device mappings
 */
async function getAllDeviceMappings() {
  if (!pgPool) {
    return [];
  }

  const query = `
    SELECT dm.*, b.name as boat_name, b.organisation, b.theme
    FROM device_mappings dm
    LEFT JOIN boats b ON dm.boat_number = b.boat_number
    ORDER BY dm.boat_number ASC;
  `;

  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching device mappings:', error);
    return [];
  }
}

/**
 * Update device mapping
 */
async function updateDeviceMapping(id, updateData) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      fields.push(`${key} = $${paramCount}`);
      values.push(updateData[key]);
      paramCount++;
    }
  });

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const query = `
    UPDATE device_mappings
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *;
  `;

  try {
    const result = await pgPool.query(query, values);
    logger.info(`Device mapping updated: ${id}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating device mapping:', error);
    throw error;
  }
}

/**
 * Get all Pride boats
 */
async function getAllPrideBoats() {
  if (!pgPool) {
    return [];
  }

  const query = `
    SELECT * FROM pride_boats
    ORDER BY parade_position ASC, nr ASC;
  `;

  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching Pride boats:', error);
    return [];
  }
}

/**
 * Get all KPN trackers
 */
async function getAllKPNTrackers() {
  if (!pgPool) {
    return [];
  }

  const query = `
    SELECT * FROM kpn_trackers
    ORDER BY asset_code ASC;
  `;

  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching KPN trackers:', error);
    return [];
  }
}

/**
 * Get all boat-tracker mappings with details
 */
async function getAllBoatTrackerMappings() {
  if (!pgPool) {
    return [];
  }

  const query = `
    SELECT
      btm.*,
      pb.nr as pride_boat_nr,
      pb.naam as pride_boat_naam,
      pb.organisatie_boot as pride_boat_organisatie,
      pb.parade_position as pride_boat_position,
      kt.asset_code as kpn_tracker_asset_code,
      kt.name as kpn_tracker_name,
      kt.device_type as kpn_tracker_device_type
    FROM boat_tracker_mappings btm
    LEFT JOIN pride_boats pb ON btm.pride_boat_id = pb.id
    LEFT JOIN kpn_trackers kt ON btm.kpn_tracker_id = kt.id
    ORDER BY pb.parade_position ASC, pb.nr ASC;
  `;

  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching boat-tracker mappings:', error);
    return [];
  }
}

/**
 * Get active boat-tracker mappings
 */
async function getAllActiveBoatTrackerMappings() {
  if (!pgPool) {
    return [];
  }

  const query = `
    SELECT
      btm.*,
      pb.nr as pride_boat_nr,
      pb.naam as pride_boat_naam,
      kt.asset_code as kpn_tracker_asset_code,
      kt.name as kpn_tracker_name
    FROM boat_tracker_mappings btm
    LEFT JOIN pride_boats pb ON btm.pride_boat_id = pb.id
    LEFT JOIN kpn_trackers kt ON btm.kpn_tracker_id = kt.id
    WHERE btm.is_active = true
    ORDER BY pb.parade_position ASC, pb.nr ASC;
  `;

  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching active boat-tracker mappings:', error);
    return [];
  }
}

/**
 * Get active mappings for a specific boat
 */
async function getActiveBoatTrackerMappings(prideBoatId) {
  if (!pgPool) {
    return [];
  }

  const query = `
    SELECT * FROM boat_tracker_mappings
    WHERE pride_boat_id = $1 AND is_active = true;
  `;

  try {
    const result = await pgPool.query(query, [prideBoatId]);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching active mappings for boat:', error);
    return [];
  }
}

/**
 * Create boat-tracker mapping
 */
async function createBoatTrackerMapping(mappingData) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const query = `
    INSERT INTO boat_tracker_mappings (pride_boat_id, kpn_tracker_id, notes, is_active)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const values = [
    mappingData.pride_boat_id,
    mappingData.kpn_tracker_id,
    mappingData.notes || null,
    mappingData.is_active !== undefined ? mappingData.is_active : true
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.info(`Boat-tracker mapping created: Pride boat ${mappingData.pride_boat_id} -> KPN tracker ${mappingData.kpn_tracker_id}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating boat-tracker mapping:', error);
    throw error;
  }
}

/**
 * Deactivate all mappings for a boat
 */
async function deactivateBoatTrackerMappings(prideBoatId) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const query = `
    UPDATE boat_tracker_mappings
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE pride_boat_id = $1;
  `;

  try {
    await pgPool.query(query, [prideBoatId]);
    logger.info(`Deactivated all mappings for Pride boat ${prideBoatId}`);
  } catch (error) {
    logger.error('Error deactivating boat mappings:', error);
    throw error;
  }
}

/**
 * Deactivate specific mapping
 */
async function deactivateBoatTrackerMapping(mappingId) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const query = `
    UPDATE boat_tracker_mappings
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1;
  `;

  try {
    await pgPool.query(query, [mappingId]);
    logger.info(`Deactivated boat-tracker mapping ${mappingId}`);
  } catch (error) {
    logger.error('Error deactivating boat-tracker mapping:', error);
    throw error;
  }
}

/**
 * Close database connections
 */
async function closeConnections() {
  try {
    if (pgPool) {
      await pgPool.end();
      logger.info('PostgreSQL connection closed');
    }

    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', closeConnections);
process.on('SIGTERM', closeConnections);

/**
 * Bulk import boats from CSV data
 */
async function bulkImportBoats(boatsData) {
  if (!pgPool) {
    throw new Error('Database not available');
  }

  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    const insertedBoats = [];

    for (const boat of boatsData) {
      const query = `
        INSERT INTO boats (boat_number, name, organisation, theme, mac_address)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (boat_number)
        DO UPDATE SET
          name = EXCLUDED.name,
          organisation = EXCLUDED.organisation,
          theme = EXCLUDED.theme,
          mac_address = EXCLUDED.mac_address,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const values = [
        boat.boat_number,
        boat.name,
        boat.organisation || null,
        boat.theme || null,
        boat.mac_address || null
      ];

      const result = await client.query(query, values);
      insertedBoats.push(result.rows[0]);
    }

    await client.query('COMMIT');
    logger.info(`Bulk imported ${insertedBoats.length} boats`);
    return insertedBoats;

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error bulk importing boats:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Voting Functions
 */

/**
 * Record a vote
 */
async function recordVote(voteData) {
  if (!pgPool) {
    // Use in-memory storage fallback
    const vote = {
      id: inMemoryVotes.length + 1,
      boat_id: voteData.boat_id || null,
      boat_number: voteData.boat_number,
      vote_type: voteData.vote_type,
      user_session: voteData.user_session,
      ip_address: voteData.ip_address || null,
      user_agent: voteData.user_agent || null,
      created_at: new Date().toISOString()
    };

    inMemoryVotes.push(vote);
    logger.debug(`Vote recorded (in-memory): ${voteData.vote_type} for boat ${voteData.boat_number}`);
    return vote;
  }

  const query = `
    INSERT INTO votes (boat_id, boat_number, vote_type, user_session, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    voteData.boat_id || null,
    voteData.boat_number,
    voteData.vote_type,
    voteData.user_session,
    voteData.ip_address || null,
    voteData.user_agent || null
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.debug(`Vote recorded: ${voteData.vote_type} for boat ${voteData.boat_number}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error recording vote:', error);
    throw error;
  }
}

/**
 * Get vote counts for all boats
 */
async function getVoteCounts() {
  if (!pgPool) {
    // Use in-memory storage fallback with demo data
    const demoBoats = [
      { boat_number: 1, name: 'Rainbow Warriors', organisation: 'Pride Amsterdam', theme: 'Music & Dance' },
      { boat_number: 2, name: 'Love Boat', organisation: 'COC Nederland', theme: 'Love & Unity' },
      { boat_number: 3, name: 'Freedom Float', organisation: 'EuroPride', theme: 'Freedom' },
      { boat_number: 4, name: 'Unity Express', organisation: 'LGBTI+ Alliance', theme: 'Unity' },
      { boat_number: 5, name: 'Pride Power', organisation: 'Amsterdam Pride', theme: 'Power' }
    ];

    // Calculate vote counts from in-memory votes
    const voteCounts = demoBoats.map(boat => {
      const boatVotes = inMemoryVotes.filter(v => v.boat_number === boat.boat_number);
      const hearts = boatVotes.filter(v => v.vote_type === 'heart').length;
      const stars = boatVotes.filter(v => v.vote_type === 'star').length;

      return {
        ...boat,
        hearts: hearts + (boat.boat_number === 1 ? 127 : Math.floor(Math.random() * 50)), // Add some demo votes
        stars: stars + (boat.boat_number === 1 ? 89 : Math.floor(Math.random() * 30)),
        total_votes: hearts + stars
      };
    });

    return voteCounts.sort((a, b) => b.stars - a.stars || b.hearts - a.hearts);
  }

  const query = `
    SELECT
      b.boat_number,
      b.name,
      b.organisation,
      b.theme,
      COUNT(CASE WHEN v.vote_type = 'heart' THEN 1 END) as hearts,
      COUNT(CASE WHEN v.vote_type = 'star' THEN 1 END) as stars,
      COUNT(v.id) as total_votes
    FROM boats b
    LEFT JOIN votes v ON b.boat_number = v.boat_number
    GROUP BY b.boat_number, b.name, b.organisation, b.theme
    ORDER BY stars DESC, hearts DESC, b.boat_number ASC;
  `;

  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching vote counts:', error);
    return [];
  }
}

/**
 * Get user vote history
 */
async function getUserVotes(userSession) {
  if (!pgPool) {
    // Use in-memory storage fallback
    const userVotes = inMemoryVotes.filter(v => v.user_session === userSession);

    // Group by boat_number and vote_type
    const groupedVotes = {};
    userVotes.forEach(vote => {
      const key = `${vote.boat_number}-${vote.vote_type}`;
      if (!groupedVotes[key]) {
        groupedVotes[key] = {
          boat_number: vote.boat_number,
          vote_type: vote.vote_type,
          count: 0
        };
      }
      groupedVotes[key].count++;
    });

    return Object.values(groupedVotes).sort((a, b) => a.boat_number - b.boat_number);
  }

  const query = `
    SELECT boat_number, vote_type, COUNT(*) as count
    FROM votes
    WHERE user_session = $1
    GROUP BY boat_number, vote_type
    ORDER BY boat_number ASC;
  `;

  try {
    const result = await pgPool.query(query, [userSession]);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching user votes:', error);
    return [];
  }
}

// === NEW CRUD FUNCTIONS FOR RESTRUCTURED DATABASE ===

/**
 * Pride Boats CRUD
 */
async function createPrideBoat(boatData) {
  if (!pgPool) {
    // In-memory fallback
    const newBoat = {
      id: inMemoryBoats.length + 1,
      parade_position: boatData.parade_position,
      boat_name: boatData.boat_name,
      organisation: boatData.organisation || null,
      theme: boatData.theme || null,
      description: boatData.description || null,
      captain_name: boatData.captain_name || null,
      captain_phone: boatData.captain_phone || null,
      status: boatData.status || 'registered',
      created_at: new Date().toISOString()
    };

    inMemoryBoats.push(newBoat);
    logger.info(`Pride boat created (in-memory): ${boatData.boat_name}`, { parade_position: boatData.parade_position });
    return newBoat;
  }

  const query = `
    INSERT INTO pride_boats (parade_position, boat_name, organisation, theme, description, captain_name, captain_phone, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  const values = [
    boatData.parade_position,
    boatData.boat_name,
    boatData.organisation || null,
    boatData.theme || null,
    boatData.description || null,
    boatData.captain_name || null,
    boatData.captain_phone || null,
    boatData.status || 'registered'
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.info(`Pride boat created: ${boatData.boat_name}`, { parade_position: boatData.parade_position });
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating pride boat:', error);
    throw error;
  }
}

async function getAllPrideBoats() {
  if (!pgPool) {
    return inMemoryBoats.sort((a, b) => a.parade_position - b.parade_position);
  }

  const query = 'SELECT * FROM pride_boats ORDER BY parade_position ASC';
  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching pride boats:', error);
    return [];
  }
}

/**
 * KPN Trackers CRUD
 */
async function createKPNTracker(trackerData) {
  if (!pgPool) {
    // In-memory fallback
    const newTracker = {
      id: inMemoryDeviceMappings.length + 1,
      tracker_name: trackerData.tracker_name,
      asset_code: trackerData.asset_code,
      device_type: trackerData.device_type || null,
      serial_number: trackerData.serial_number || null,
      enabled: trackerData.enabled !== undefined ? trackerData.enabled : true,
      created_at: new Date().toISOString()
    };

    inMemoryDeviceMappings.push(newTracker);
    logger.info(`KPN tracker created (in-memory): ${trackerData.tracker_name}`, { asset_code: trackerData.asset_code });
    return newTracker;
  }

  const query = `
    INSERT INTO kpn_trackers (tracker_name, asset_code, asset_type, device_type, serial_number, imei, enabled, current_status, project, department, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;

  const values = [
    trackerData.tracker_name,
    trackerData.asset_code,
    trackerData.asset_type || 'Boat',
    trackerData.device_type || null,
    trackerData.serial_number || null,
    trackerData.imei || null,
    trackerData.enabled !== undefined ? trackerData.enabled : true,
    trackerData.current_status || null,
    trackerData.project || null,
    trackerData.department || null,
    trackerData.description || null
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.info(`KPN tracker created: ${trackerData.tracker_name}`, { asset_code: trackerData.asset_code });
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating KPN tracker:', error);
    throw error;
  }
}

async function getAllKPNTrackers() {
  if (!pgPool) {
    return inMemoryDeviceMappings.sort((a, b) => a.asset_code.localeCompare(b.asset_code));
  }

  const query = 'SELECT * FROM kpn_trackers ORDER BY asset_code ASC';
  try {
    const result = await pgPool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching KPN trackers:', error);
    return [];
  }
}

async function getKPNTrackerByName(trackerName) {
  if (!pgPool) {
    return inMemoryDeviceMappings.find(t => t.tracker_name === trackerName) || null;
  }

  const query = 'SELECT * FROM kpn_trackers WHERE tracker_name = $1';
  try {
    const result = await pgPool.query(query, [trackerName]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching KPN tracker by name:', error);
    return null;
  }
}

/**
 * Webhook Logging Functions
 */
async function logWebhookRequest(webhookData) {
  logger.info(`logWebhookRequest called for: ${webhookData.method} ${webhookData.endpoint}`);

  if (!pgPool) {
    logger.info('Using in-memory webhook logging (no PostgreSQL connection)');

    // In-memory fallback
    const logEntry = {
      id: inMemoryWebhookLogs.length + 1,
      endpoint: webhookData.endpoint,
      method: webhookData.method,
      headers: webhookData.headers,
      body: webhookData.body,
      query_params: webhookData.query_params,
      ip_address: webhookData.ip_address,
      user_agent: webhookData.user_agent,
      response_status: webhookData.response_status,
      response_body: webhookData.response_body,
      processing_time_ms: webhookData.processing_time_ms,
      error_message: webhookData.error_message,
      created_at: new Date().toISOString()
    };

    inMemoryWebhookLogs.unshift(logEntry); // Add to beginning

    // Keep only last 100 entries in memory
    if (inMemoryWebhookLogs.length > 100) {
      inMemoryWebhookLogs = inMemoryWebhookLogs.slice(0, 100);
    }

    logger.info(`Webhook logged (in-memory): ${webhookData.endpoint}, total logs: ${inMemoryWebhookLogs.length}`, { status: webhookData.response_status });
    return logEntry;
  }

  const query = `
    INSERT INTO webhook_logs (endpoint, method, headers, body, query_params, ip_address, user_agent, response_status, response_body, processing_time_ms, error_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;

  const values = [
    webhookData.endpoint,
    webhookData.method,
    JSON.stringify(webhookData.headers),
    JSON.stringify(webhookData.body),
    JSON.stringify(webhookData.query_params),
    webhookData.ip_address,
    webhookData.user_agent,
    webhookData.response_status,
    JSON.stringify(webhookData.response_body),
    webhookData.processing_time_ms,
    webhookData.error_message
  ];

  try {
    const result = await pgPool.query(query, values);
    logger.debug(`Webhook logged: ${webhookData.endpoint}`, { id: result.rows[0].id, status: webhookData.response_status });
    return result.rows[0];
  } catch (error) {
    logger.error('Error logging webhook:', error);
    throw error;
  }
}

async function getWebhookLogs(limit = 50, offset = 0) {
  logger.info(`getWebhookLogs called: limit=${limit}, offset=${offset}`);

  if (!pgPool) {
    logger.info(`Returning in-memory logs: ${inMemoryWebhookLogs.length} total logs`);
    const result = inMemoryWebhookLogs.slice(offset, offset + limit);
    logger.info(`Returning ${result.length} logs from in-memory storage`);
    return result;
  }

  const query = `
    SELECT * FROM webhook_logs
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;

  try {
    const result = await pgPool.query(query, [limit, offset]);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching webhook logs:', error);
    return [];
  }
}

async function getWebhookStats() {
  if (!pgPool) {
    const total = inMemoryWebhookLogs.length;
    const last24h = inMemoryWebhookLogs.filter(log =>
      new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    return {
      total_requests: total,
      last_24h: last24h,
      endpoints: [...new Set(inMemoryWebhookLogs.map(log => log.endpoint))],
      latest_request: inMemoryWebhookLogs[0]?.created_at || null
    };
  }

  const query = `
    SELECT
      COUNT(*) as total_requests,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
      MAX(created_at) as latest_request,
      array_agg(DISTINCT endpoint) as endpoints
    FROM webhook_logs
  `;

  try {
    const result = await pgPool.query(query);
    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching webhook stats:', error);
    return { total_requests: 0, last_24h: 0, endpoints: [], latest_request: null };
  }
}

/**
 * Test database connection for health checks
 */
async function testConnection() {
  if (pgPool) {
    const client = await Promise.race([
      pgPool.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 3000)
      )
    ]);
    await client.query('SELECT 1');
    client.release();
    return true;
  }
  throw new Error('No database connection available');
}

/**
 * Database Statistics and Table Inspection Functions
 */
async function getDatabaseStats() {
  logger.info('📊 Getting database statistics');

  if (!pgPool) {
    logger.warn('❌ No database connection for stats');
    return { tables: [], total_tables: 0, total_rows: 0 };
  }

  try {
    // Get all tables in the public schema
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const tablesResult = await pgPool.query(tablesQuery);
    const tables = [];
    let totalRows = 0;

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;

      try {
        // Get row count
        const countResult = await pgPool.query(`SELECT COUNT(*) FROM "${tableName}"`);
        const rowCount = parseInt(countResult.rows[0].count);

        // Get column info
        const columnsQuery = `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `;
        const columnsResult = await pgPool.query(columnsQuery, [tableName]);
        const columns = columnsResult.rows.map(row => row.column_name);

        tables.push({
          table_name: tableName,
          row_count: rowCount,
          columns: columns
        });

        totalRows += rowCount;
      } catch (error) {
        logger.warn(`⚠️ Could not get stats for table ${tableName}:`, error.message);
        tables.push({
          table_name: tableName,
          row_count: 0,
          columns: []
        });
      }
    }

    return {
      tables: tables,
      total_tables: tables.length,
      total_rows: totalRows
    };
  } catch (error) {
    logger.error('❌ Error getting database stats:', error);
    throw error;
  }
}

async function getTableData(tableName, limit = 100) {
  logger.info(`📋 Getting data from table: ${tableName}`);

  if (!pgPool) {
    logger.warn('❌ No database connection for table data');
    return { columns: [], rows: [], total_count: 0 };
  }

  try {
    // Validate table name exists (prevent SQL injection)
    const tableExistsQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    `;
    const tableExists = await pgPool.query(tableExistsQuery, [tableName]);

    if (tableExists.rows.length === 0) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    // Get column names
    const columnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    const columnsResult = await pgPool.query(columnsQuery, [tableName]);
    const columns = columnsResult.rows.map(row => row.column_name);

    // Get total count
    const countResult = await pgPool.query(`SELECT COUNT(*) FROM "${tableName}"`);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get data with limit
    const dataQuery = `SELECT * FROM "${tableName}" ORDER BY 1 DESC LIMIT $1`;
    const dataResult = await pgPool.query(dataQuery, [limit]);

    return {
      columns: columns,
      rows: dataResult.rows,
      total_count: totalCount
    };
  } catch (error) {
    logger.error(`❌ Error getting table data for ${tableName}:`, error);
    throw error;
  }
}

async function getCleanGPSData(limit = 100) {
  logger.info(`📍 Getting clean GPS data (limit: ${limit})`);

  if (!pgPool) {
    logger.warn('❌ No database connection for clean GPS data');
    return [];
  }

  try {
    // Check if gps_clean table exists, if not use gps_positions
    const tableExistsQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'gps_clean'
    `;
    const tableExists = await pgPool.query(tableExistsQuery);

    let query;
    if (tableExists.rows.length > 0) {
      // Use gps_clean table
      query = `
        SELECT
          tracker_id,
          latitude,
          longitude,
          accuracy,
          timestamp
        FROM gps_clean
        ORDER BY timestamp DESC
        LIMIT $1
      `;
    } else {
      // Use gps_positions table
      query = `
        SELECT
          tracker_name as tracker_id,
          latitude,
          longitude,
          accuracy,
          timestamp
        FROM gps_positions
        ORDER BY timestamp DESC
        LIMIT $1
      `;
    }

    const result = await pgPool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    logger.error('❌ Error getting clean GPS data:', error);
    throw error;
  }
}

async function createGPSCleanTable() {
  logger.info('🔧 Creating GPS clean table');

  if (!pgPool) {
    throw new Error('Database not available');
  }

  try {
    // Create the gps_clean table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS gps_clean (
        id SERIAL PRIMARY KEY,
        tracker_id VARCHAR(50) NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy DECIMAL(6, 2),
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pgPool.query(createTableQuery);

    // Create index for performance
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_gps_clean_tracker_id ON gps_clean(tracker_id);
      CREATE INDEX IF NOT EXISTS idx_gps_clean_timestamp ON gps_clean(timestamp);
    `;

    await pgPool.query(createIndexQuery);

    // Migrate existing data from gps_positions
    const migrateQuery = `
      INSERT INTO gps_clean (tracker_id, latitude, longitude, accuracy, timestamp)
      SELECT
        tracker_name as tracker_id,
        latitude,
        longitude,
        accuracy,
        timestamp
      FROM gps_positions
      WHERE NOT EXISTS (
        SELECT 1 FROM gps_clean
        WHERE gps_clean.tracker_id = gps_positions.tracker_name
        AND gps_clean.timestamp = gps_positions.timestamp
      )
    `;

    const migrateResult = await pgPool.query(migrateQuery);

    logger.info(`✅ GPS clean table created and ${migrateResult.rowCount} rows migrated`);

    return {
      table_created: true,
      migrated_rows: migrateResult.rowCount
    };
  } catch (error) {
    logger.error('❌ Error creating GPS clean table:', error);
    throw error;
  }
}

async function forceCreateTables() {
  logger.info('🔧 Force creating all database tables');

  if (!pgPool) {
    throw new Error('Database not available - no PostgreSQL connection');
  }

  try {
    // First, check if we can connect to the database
    const testQuery = 'SELECT NOW() as current_time';
    const testResult = await pgPool.query(testQuery);
    logger.info('✅ Database connection verified:', testResult.rows[0]);

    // Create all tables with explicit SQL
    const createTablesSQL = `
      -- Pride Boats table
      CREATE TABLE IF NOT EXISTS pride_boats (
        id SERIAL PRIMARY KEY,
        parade_position INTEGER UNIQUE NOT NULL,
        boat_name VARCHAR(255) NOT NULL,
        organisation VARCHAR(255),
        theme TEXT,
        description TEXT,
        captain_name VARCHAR(255),
        captain_phone VARCHAR(20),
        captain_email VARCHAR(255),
        boat_type VARCHAR(100),
        length_meters DECIMAL(5,2),
        width_meters DECIMAL(5,2),
        max_persons INTEGER,
        status VARCHAR(50) DEFAULT 'registered',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- KPN Trackers table
      CREATE TABLE IF NOT EXISTS kpn_trackers (
        id SERIAL PRIMARY KEY,
        tracker_name VARCHAR(50) UNIQUE NOT NULL,
        asset_code VARCHAR(20) NOT NULL,
        asset_type VARCHAR(50) DEFAULT 'Boat',
        device_type VARCHAR(100),
        serial_number VARCHAR(50),
        imei VARCHAR(20),
        enabled BOOLEAN DEFAULT true,
        last_connected TIMESTAMP,
        last_trip TIMESTAMP,
        current_status VARCHAR(100),
        odometer_km DECIMAL(10,2),
        run_hours DECIMAL(10,2),
        project VARCHAR(50),
        department VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Boat-Tracker Mappings
      CREATE TABLE IF NOT EXISTS boat_tracker_mappings (
        id SERIAL PRIMARY KEY,
        pride_boat_id INTEGER,
        kpn_tracker_id INTEGER,
        parade_position INTEGER,
        tracker_name VARCHAR(50),
        asset_code VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        mapped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        mapped_by VARCHAR(100),
        notes TEXT,
        FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE CASCADE,
        FOREIGN KEY (kpn_tracker_id) REFERENCES kpn_trackers(id) ON DELETE CASCADE,
        FOREIGN KEY (parade_position) REFERENCES pride_boats(parade_position) ON DELETE CASCADE,
        UNIQUE(pride_boat_id, is_active)
      );

      -- Votes table
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        pride_boat_id INTEGER,
        parade_position INTEGER,
        vote_type VARCHAR(10) CHECK(vote_type IN ('heart', 'star')),
        user_session VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE CASCADE,
        FOREIGN KEY (parade_position) REFERENCES pride_boats(parade_position) ON DELETE CASCADE
      );

      -- GPS Positions table
      CREATE TABLE IF NOT EXISTS gps_positions (
        id SERIAL PRIMARY KEY,
        tracker_name VARCHAR(50) NOT NULL,
        kpn_tracker_id INTEGER,
        pride_boat_id INTEGER,
        parade_position INTEGER,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        route_distance INTEGER DEFAULT 0,
        route_progress DECIMAL(5, 2) DEFAULT 0,
        speed DECIMAL(5, 2) DEFAULT 0,
        heading INTEGER DEFAULT 0,
        distance_from_route DECIMAL(6, 2) DEFAULT 0,
        altitude DECIMAL(8, 2),
        accuracy DECIMAL(6, 2),
        timestamp TIMESTAMP NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB,
        FOREIGN KEY (kpn_tracker_id) REFERENCES kpn_trackers(id) ON DELETE SET NULL,
        FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE SET NULL
      );

      -- Incidents table
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        tracker_name VARCHAR(50),
        kpn_tracker_id INTEGER,
        pride_boat_id INTEGER,
        parade_position INTEGER,
        incident_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        message TEXT,
        metadata JSONB,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kpn_tracker_id) REFERENCES kpn_trackers(id) ON DELETE SET NULL,
        FOREIGN KEY (pride_boat_id) REFERENCES pride_boats(id) ON DELETE SET NULL
      );

      -- Webhook logs table (CRITICAL for KPN monitoring)
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(100) NOT NULL,
        method VARCHAR(10) NOT NULL,
        headers JSONB,
        body JSONB,
        query_params JSONB,
        ip_address INET,
        user_agent TEXT,
        response_status INTEGER,
        response_body JSONB,
        processing_time_ms INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Execute the table creation
    await pgPool.query(createTablesSQL);
    logger.info('✅ All tables created successfully');

    // Create indexes
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_gps_positions_tracker_name ON gps_positions(tracker_name);
      CREATE INDEX IF NOT EXISTS idx_gps_positions_timestamp ON gps_positions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_gps_positions_pride_boat ON gps_positions(pride_boat_id);
      CREATE INDEX IF NOT EXISTS idx_boat_tracker_mappings_active ON boat_tracker_mappings(is_active);
      CREATE INDEX IF NOT EXISTS idx_kpn_trackers_asset_code ON kpn_trackers(asset_code);
      CREATE INDEX IF NOT EXISTS idx_pride_boats_position ON pride_boats(parade_position);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint ON webhook_logs(endpoint);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
    `;

    await pgPool.query(createIndexesSQL);
    logger.info('✅ All indexes created successfully');

    // Verify tables were created
    const verifyQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const verifyResult = await pgPool.query(verifyQuery);
    const tableNames = verifyResult.rows.map(row => row.table_name);

    logger.info('✅ Database tables verified:', tableNames);

    return {
      success: true,
      tables_created: tableNames,
      total_tables: tableNames.length,
      message: 'All database tables force created successfully'
    };

  } catch (error) {
    logger.error('❌ Error force creating database tables:', error);
    throw error;
  }
}

async function processBoatsCSV(csvContent) {
  logger.info('📊 Processing boats CSV data');

  if (!pgPool) {
    throw new Error('Database not available - no PostgreSQL connection');
  }

  try {
    // Parse CSV content (detect separator)
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain at least a header row and one data row');
    }

    // Auto-detect separator (tab or comma)
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';
    logger.info(`📋 Detected CSV separator: ${separator === '\t' ? 'TAB' : 'COMMA'}`);

    const headers = firstLine.split(separator).map(h => h.trim());
    logger.info('📋 CSV headers detected:', headers);

    // Create column mapping - flexible field detection
    const columnMap = createColumnMapping(headers);
    logger.info('🗺️ Column mapping created:', columnMap);

    // Validate that we have minimum required fields
    if (!columnMap.name && !columnMap.organisation) {
      throw new Error('CSV must contain at least a name or organisation column');
    }
    if (!columnMap.trackerId) {
      throw new Error('CSV must contain a tracker ID column');
    }

    const client = await pgPool.connect();
    let prideBoatsCreated = 0;
    let kpnTrackersCreated = 0;
    let mappingsCreated = 0;

    try {
      await client.query('BEGIN');

      // Process each data row (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const values = line.split(separator).map(v => v?.trim());
        if (values.length < headers.length / 2) {
          logger.warn(`⚠️ Skipping row ${i + 1}: insufficient columns (${values.length}/${headers.length})`);
          continue;
        }

        // Extract data using flexible column mapping
        const rowData = extractRowData(values, columnMap, headers);

        if (!rowData.trackerId) {
          logger.warn(`⚠️ Skipping row ${i + 1}: missing tracker ID`);
          continue;
        }

        logger.debug(`Processing row ${i + 1}:`, rowData);

        // 1. Create/update Pride Boat
        const prideBoatQuery = `
          INSERT INTO pride_boats (parade_position, boat_name, organisation, theme, description, status)
          VALUES ($1, $2, $3, $4, $5, 'registered')
          ON CONFLICT (parade_position)
          DO UPDATE SET
            boat_name = EXCLUDED.boat_name,
            organisation = EXCLUDED.organisation,
            theme = EXCLUDED.theme,
            description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id;
        `;

        const prideBoatResult = await client.query(prideBoatQuery, [
          rowData.position || 0,
          rowData.name || rowData.organisation || 'Unknown',
          rowData.organisation || rowData.name || 'Unknown',
          rowData.theme || rowData.organisation || '',
          rowData.description || rowData.theme || ''
        ]);

        const prideBoatId = prideBoatResult.rows[0].id;
        prideBoatsCreated++;

        // 2. Create/update KPN Tracker
        const kpnTrackerQuery = `
          INSERT INTO kpn_trackers (tracker_name, asset_code, asset_type, description, enabled)
          VALUES ($1, $2, 'Boat', $3, true)
          ON CONFLICT (tracker_name)
          DO UPDATE SET
            asset_code = EXCLUDED.asset_code,
            description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id;
        `;

        const kpnTrackerResult = await client.query(kpnTrackerQuery, [
          rowData.trackerId,
          rowData.assetCode || `T${rowData.trackerId}`,
          `${rowData.organisation || rowData.name} - ${rowData.description || rowData.theme || ''}`
        ]);

        const kpnTrackerId = kpnTrackerResult.rows[0].id;
        kpnTrackersCreated++;

        // 3. Create/update Boat-Tracker Mapping
        const mappingQuery = `
          INSERT INTO boat_tracker_mappings (
            pride_boat_id, kpn_tracker_id, parade_position, tracker_name, asset_code, is_active, notes
          )
          VALUES ($1, $2, $3, $4, $5, true, $6)
          ON CONFLICT (pride_boat_id, is_active)
          DO UPDATE SET
            kpn_tracker_id = EXCLUDED.kpn_tracker_id,
            tracker_name = EXCLUDED.tracker_name,
            asset_code = EXCLUDED.asset_code,
            notes = EXCLUDED.notes,
            mapped_at = CURRENT_TIMESTAMP
          RETURNING id;
        `;

        await client.query(mappingQuery, [
          prideBoatId,
          kpnTrackerId,
          rowData.position || 0,
          rowData.trackerId,
          rowData.assetCode || `T${rowData.trackerId}`,
          `CSV import: ${rowData.name || rowData.organisation}`
        ]);

        mappingsCreated++;
      }

      await client.query('COMMIT');

      const result = {
        success: true,
        total_rows: lines.length - 1, // Exclude header
        pride_boats_created: prideBoatsCreated,
        kpn_trackers_created: kpnTrackersCreated,
        mappings_created: mappingsCreated
      };

      logger.info('✅ CSV processing completed:', result);
      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('❌ Error processing boats CSV:', error);
    throw error;
  }
}

// Helper function to create flexible column mapping
function createColumnMapping(headers) {
  const mapping = {};

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();

    // Name/Naam mapping
    if (normalizedHeader.includes('naam') || normalizedHeader.includes('name') || normalizedHeader === 'boat_name') {
      mapping.name = index;
    }

    // Position/Nr mapping
    if (normalizedHeader.includes('nr') || normalizedHeader.includes('position') || normalizedHeader.includes('pos')) {
      mapping.position = index;
    }

    // Tracker ID mapping
    if (normalizedHeader.includes('tracker') && normalizedHeader.includes('id')) {
      mapping.trackerId = index;
    }

    // Organisation mapping
    if (normalizedHeader.includes('organisatie') || normalizedHeader.includes('organisation') || normalizedHeader.includes('boot')) {
      mapping.organisation = index;
    }

    // Theme/Description mapping
    if (normalizedHeader.includes('thema') || normalizedHeader.includes('theme') || normalizedHeader.includes('beschrijving') || normalizedHeader.includes('description')) {
      mapping.theme = index;
      if (!mapping.description) mapping.description = index;
    }

    // Asset code mapping (P numbers)
    if (normalizedHeader.includes('p nummer') || normalizedHeader.includes('asset') || normalizedHeader.includes('code')) {
      mapping.assetCode = index;
    }

    // IMEI mapping
    if (normalizedHeader.includes('imei')) {
      mapping.imei = index;
    }

    // Captain mapping
    if (normalizedHeader.includes('captain') || normalizedHeader.includes('kapitein')) {
      mapping.captain = index;
    }
  });

  return mapping;
}

// Helper function to extract row data using column mapping
function extractRowData(values, columnMap, headers) {
  const data = {};

  // Extract mapped fields
  if (columnMap.name !== undefined) data.name = values[columnMap.name];
  if (columnMap.position !== undefined) data.position = parseInt(values[columnMap.position]) || 0;
  if (columnMap.trackerId !== undefined) data.trackerId = values[columnMap.trackerId];
  if (columnMap.organisation !== undefined) data.organisation = values[columnMap.organisation];
  if (columnMap.theme !== undefined) data.theme = values[columnMap.theme];
  if (columnMap.description !== undefined) data.description = values[columnMap.description];
  if (columnMap.assetCode !== undefined) data.assetCode = values[columnMap.assetCode];
  if (columnMap.imei !== undefined) data.imei = values[columnMap.imei];
  if (columnMap.captain !== undefined) data.captain = values[columnMap.captain];

  // Fallbacks and cleanup
  data.name = data.name || data.organisation || 'Unknown';
  data.organisation = data.organisation || data.name || 'Unknown';
  data.description = data.description || data.theme || '';
  data.theme = data.theme || data.organisation || '';

  return data;
}

async function extractHistoricalGPSData() {
  logger.info('🔍 Extracting GPS data from historical webhook logs');

  if (!pgPool) {
    throw new Error('Database not available - no PostgreSQL connection');
  }

  try {
    // Get all webhook logs that contain GPS data
    const webhookQuery = `
      SELECT id, endpoint, body, created_at
      FROM webhook_logs
      WHERE (endpoint LIKE '%gps%' OR endpoint LIKE '%tracker%')
      AND body IS NOT NULL
      AND body::text LIKE '%Records%'
      AND body::text LIKE '%Lat%'
      ORDER BY created_at DESC
    `;

    const webhookResult = await pgPool.query(webhookQuery);
    const webhooks = webhookResult.rows;

    logger.info(`📊 Found ${webhooks.length} webhook logs with potential GPS data`);

    let webhooksProcessed = 0;
    let gpsPositionsExtracted = 0;
    const devicesFound = new Set();

    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');

      for (const webhook of webhooks) {
        try {
          const payload = webhook.body;

          // Extract SerNo and IMEI from payload
          const serNo = payload.SerNo;
          const imei = payload.IMEI;

          if (!serNo) {
            continue; // Skip if no SerNo
          }

          devicesFound.add(serNo);

          // Extract GPS data from Records.Fields
          if (payload.Records && Array.isArray(payload.Records)) {
            for (const record of payload.Records) {
              if (record.Fields && Array.isArray(record.Fields)) {
                for (const field of record.Fields) {
                  // Look for GPS coordinates
                  if ((field.Long !== undefined || field.Lng !== undefined) && field.Lat !== undefined) {

                    const gpsData = {
                      latitude: parseFloat(field.Lat),
                      longitude: parseFloat(field.Long || field.Lng),
                      altitude: field.Alt ? parseFloat(field.Alt) : null,
                      speed: field.Spd ? parseFloat(field.Spd) : null,
                      heading: field.Head ? parseFloat(field.Head) : null,
                      accuracy: field.PosAcc ? parseFloat(field.PosAcc) : null,
                      pdop: field.PDOP ? parseFloat(field.PDOP) : null,
                      gpsStatus: field.GpsStat ? parseInt(field.GpsStat) : null
                    };

                    // Use GPS timestamp if available, otherwise record timestamp, otherwise webhook timestamp
                    const gpsTimestamp = field.GpsUTC || record.DateUTC || webhook.created_at;

                    // Check if this GPS position already exists (avoid duplicates)
                    const existsQuery = `
                      SELECT id FROM gps_positions
                      WHERE tracker_name = $1
                      AND latitude = $2
                      AND longitude = $3
                      AND timestamp = $4
                    `;

                    const existsResult = await client.query(existsQuery, [
                      serNo.toString(),
                      gpsData.latitude,
                      gpsData.longitude,
                      new Date(gpsTimestamp)
                    ]);

                    if (existsResult.rows.length > 0) {
                      continue; // Skip duplicate
                    }

                    // Insert GPS position
                    const insertQuery = `
                      INSERT INTO gps_positions (
                        tracker_name, kpn_tracker_id, pride_boat_id, parade_position,
                        latitude, longitude, altitude, accuracy, speed, heading,
                        timestamp, raw_data
                      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                      RETURNING id
                    `;

                    const insertValues = [
                      serNo.toString(),
                      serNo,
                      null, // Will be mapped later when boat mappings are available
                      null,
                      gpsData.latitude,
                      gpsData.longitude,
                      gpsData.altitude,
                      gpsData.accuracy,
                      gpsData.speed,
                      gpsData.heading,
                      new Date(gpsTimestamp),
                      JSON.stringify({
                        SerNo: serNo,
                        IMEI: imei,
                        gpsStatus: gpsData.gpsStatus,
                        pdop: gpsData.pdop,
                        extractedFrom: 'historical_webhook',
                        webhookId: webhook.id,
                        originalPayload: payload
                      })
                    ];

                    const insertResult = await client.query(insertQuery, insertValues);
                    gpsPositionsExtracted++;

                    logger.debug('📍 Historical GPS position extracted:', {
                      id: insertResult.rows[0].id,
                      SerNo: serNo,
                      lat: gpsData.latitude,
                      lng: gpsData.longitude,
                      timestamp: gpsTimestamp
                    });
                  }
                }
              }
            }
          }

          webhooksProcessed++;

        } catch (recordError) {
          logger.warn(`⚠️ Error processing webhook ${webhook.id}:`, recordError.message);
          // Continue with next webhook
        }
      }

      await client.query('COMMIT');

      const result = {
        webhooks_processed: webhooksProcessed,
        gps_positions_extracted: gpsPositionsExtracted,
        devices_found: devicesFound.size
      };

      logger.info('✅ Historical GPS extraction completed:', result);
      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('❌ Error extracting historical GPS data:', error);
    throw error;
  }
}

async function forceExtractGPSFromWebhooks() {
  logger.info('🚀 Force GPS extraction from webhook logs');

  if (!pgPool) {
    throw new Error('Database not available - no PostgreSQL connection');
  }

  try {
    // Get webhook logs directly
    const webhookQuery = `
      SELECT id, endpoint, body, created_at
      FROM webhook_logs
      WHERE endpoint LIKE '%gps%'
      AND body IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const webhookResult = await pgPool.query(webhookQuery);
    const webhooks = webhookResult.rows;

    logger.info(`📊 Found ${webhooks.length} webhook logs to process`);

    let extracted = 0;
    const devices = new Set();

    for (const webhook of webhooks) {
      try {
        const payload = webhook.body;
        const serNo = payload.SerNo;
        const imei = payload.IMEI;

        if (!serNo) continue;
        devices.add(serNo);

        logger.info(`🔍 Processing webhook ${webhook.id} for SerNo ${serNo}`);

        // Extract GPS from Records.Fields
        if (payload.Records && Array.isArray(payload.Records)) {
          for (const record of payload.Records) {
            if (record.Fields && Array.isArray(record.Fields)) {
              for (const field of record.Fields) {
                if (field.Lat !== undefined && (field.Long !== undefined || field.Lng !== undefined)) {

                  logger.info(`📍 Found GPS data: Lat ${field.Lat}, Long ${field.Long || field.Lng}, PosAcc ${field.PosAcc}`);

                  // Check if already exists
                  const existsQuery = `
                    SELECT id FROM gps_positions
                    WHERE tracker_name = $1
                    AND latitude = $2
                    AND longitude = $3
                    AND timestamp = $4
                  `;

                  const gpsTimestamp = field.GpsUTC || record.DateUTC || webhook.created_at;
                  const existsResult = await pgPool.query(existsQuery, [
                    serNo.toString(),
                    parseFloat(field.Lat),
                    parseFloat(field.Long || field.Lng),
                    new Date(gpsTimestamp)
                  ]);

                  if (existsResult.rows.length > 0) {
                    logger.info(`⚠️ GPS position already exists, skipping`);
                    continue; // Skip duplicate
                  }

                  // Insert GPS position (without foreign key constraint)
                  const insertQuery = `
                    INSERT INTO gps_positions (
                      tracker_name, latitude, longitude, altitude, accuracy, speed, heading,
                      timestamp, raw_data
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id
                  `;

                  const insertValues = [
                    serNo.toString(),
                    parseFloat(field.Lat),
                    parseFloat(field.Long || field.Lng),
                    field.Alt ? parseFloat(field.Alt) : null,
                    field.PosAcc ? parseFloat(field.PosAcc) : null,
                    field.Spd ? parseFloat(field.Spd) : null,
                    field.Head ? parseFloat(field.Head) : null,
                    new Date(gpsTimestamp),
                    JSON.stringify({
                      SerNo: serNo,
                      IMEI: imei,
                      extractedFrom: 'force_extraction',
                      webhookId: webhook.id,
                      originalField: field
                    })
                  ];

                  const insertResult = await pgPool.query(insertQuery, insertValues);
                  extracted++;

                  logger.info(`✅ GPS extracted and saved with ID ${insertResult.rows[0].id}: SerNo ${serNo}, Lat ${field.Lat}, Long ${field.Long || field.Lng}, PosAcc ${field.PosAcc}`);
                }
              }
            }
          }
        }
      } catch (recordError) {
        logger.error(`❌ Error processing webhook ${webhook.id}:`, recordError);
      }
    }

    const result = {
      webhooks_processed: webhooks.length,
      gps_positions_extracted: extracted,
      devices_found: devices.size
    };

    logger.info('✅ Force GPS extraction completed:', result);
    return result;

  } catch (error) {
    logger.error('❌ Error in force GPS extraction:', error);
    throw error;
  }
}

async function testGPSInsert() {
  logger.info('🧪 Testing direct GPS insert');

  if (!pgPool) {
    throw new Error('Database not available - no PostgreSQL connection');
  }

  try {
    // Test insert without foreign key constraint (set kpn_tracker_id to null)
    const insertQuery = `
      INSERT INTO gps_positions (
        tracker_name, latitude, longitude,
        accuracy, timestamp, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tracker_name, latitude, longitude
    `;

    const testValues = [
      'TEST_1424493',
      52.3676,
      4.9041,
      25,
      new Date(),
      JSON.stringify({ test: true, source: 'direct_test' })
    ];

    logger.info('🔍 Attempting GPS insert with values:', testValues);

    const result = await pgPool.query(insertQuery, testValues);

    logger.info('✅ GPS insert successful:', result.rows[0]);

    return {
      success: true,
      inserted_id: result.rows[0].id,
      data: result.rows[0]
    };

  } catch (error) {
    logger.error('❌ Error in test GPS insert:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  testConnection,
  resetDatabase,
  saveBoatPosition,
  saveGPSPosition,
  getLatestGPSPositions,
  saveBoatIncident,
  getBoatPositionHistory,
  cacheSet,
  cacheGet,
  cacheDel,
  closeConnections,
  // Legacy boat CRUD (for compatibility)
  createBoat,
  getAllBoats,
  getBoat,
  updateBoat,
  deleteBoat,
  bulkImportBoats,
  // New Pride Boats CRUD
  createPrideBoat,
  getAllPrideBoats,
  // New KPN Trackers CRUD
  createKPNTracker,
  getAllKPNTrackers,
  getKPNTrackerByName,
  // Device mapping operations (legacy)
  createDeviceMapping,
  getDeviceMappingByIMEI,
  getAllDeviceMappings,
  updateDeviceMapping,
  // Boat-tracker mappings
  getAllBoatTrackerMappings,
  getAllActiveBoatTrackerMappings,
  getActiveBoatTrackerMappings,
  createBoatTrackerMapping,
  deactivateBoatTrackerMappings,
  deactivateBoatTrackerMapping,
  // Voting operations
  recordVote,
  getVoteCounts,
  getUserVotes,
  // Webhook logging
  logWebhookRequest,
  getWebhookLogs,
  getWebhookStats,
  // Database connections
  pgPool: () => pgPool,
  redisClient: () => redisClient,
  // Database inspection functions
  getDatabaseStats,
  getTableData,
  getCleanGPSData,
  createGPSCleanTable,
  forceCreateTables,
  processBoatsCSV,
  extractHistoricalGPSData,
  forceExtractGPSFromWebhooks,
  testGPSInsert
};
