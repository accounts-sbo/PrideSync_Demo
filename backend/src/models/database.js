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
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        // Test PostgreSQL connection
        const client = await pgPool.connect();
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
    throw new Error('Database not available');
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
    return [];
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
    return [];
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
  if (!pgPool) {
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

    logger.debug(`Webhook logged (in-memory): ${webhookData.endpoint}`, { status: webhookData.response_status });
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
  if (!pgPool) {
    return inMemoryWebhookLogs.slice(offset, offset + limit);
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

module.exports = {
  initializeDatabase,
  resetDatabase,
  saveBoatPosition,
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
  redisClient: () => redisClient
};
