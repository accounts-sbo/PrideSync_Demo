const { Pool } = require('pg');
const redis = require('redis');
const logger = require('../services/logger');

// PostgreSQL connection
let pgPool = null;
let redisClient = null;

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
  // Boats table with extended fields for Pride data
  const createBoatsTable = `
    CREATE TABLE IF NOT EXISTS boats (
      id SERIAL PRIMARY KEY,
      boat_number INTEGER UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      imei VARCHAR(20),
      description TEXT,
      captain_name VARCHAR(255),
      captain_phone VARCHAR(20),
      status VARCHAR(50) DEFAULT 'waiting',
      organisation VARCHAR(255),
      theme TEXT,
      mac_address VARCHAR(17),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Device mappings table for linking tracker devices to boats
  const createDeviceMappingsTable = `
    CREATE TABLE IF NOT EXISTS device_mappings (
      id SERIAL PRIMARY KEY,
      boat_id INTEGER,
      boat_number INTEGER,
      device_imei VARCHAR(20) UNIQUE,
      device_serial VARCHAR(50),
      mac_address VARCHAR(17),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
      FOREIGN KEY (boat_number) REFERENCES boats(boat_number) ON DELETE CASCADE
    );
  `;

  // Votes table for the 2025 voting app
  const createVotesTable = `
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      boat_id INTEGER,
      boat_number INTEGER,
      vote_type VARCHAR(10) CHECK(vote_type IN ('heart', 'star')),
      user_session VARCHAR(255),
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
      FOREIGN KEY (boat_number) REFERENCES boats(boat_number) ON DELETE CASCADE
    );
  `;

  // Enhanced positions table with IMEI and additional tracking
  const createPositionsTable = `
    CREATE TABLE IF NOT EXISTS boat_positions (
      id SERIAL PRIMARY KEY,
      boat_number INTEGER NOT NULL,
      imei VARCHAR(20),
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boat_number) REFERENCES boats(boat_number) ON DELETE CASCADE
    );
  `;

  const createIncidentsTable = `
    CREATE TABLE IF NOT EXISTS boat_incidents (
      id SERIAL PRIMARY KEY,
      boat_number INTEGER NOT NULL,
      incident_type VARCHAR(100) NOT NULL,
      severity VARCHAR(20) DEFAULT 'info',
      message TEXT,
      metadata JSONB,
      timestamp TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boat_number) REFERENCES boats(boat_number) ON DELETE CASCADE
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_boat_positions_boat_number ON boat_positions(boat_number);
    CREATE INDEX IF NOT EXISTS idx_boat_positions_timestamp ON boat_positions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_boat_incidents_boat_number ON boat_incidents(boat_number);
    CREATE INDEX IF NOT EXISTS idx_boat_incidents_timestamp ON boat_incidents(timestamp);
  `;

  try {
    await pgPool.query(createBoatsTable);
    await pgPool.query(createDeviceMappingsTable);
    await pgPool.query(createVotesTable);
    await pgPool.query(createPositionsTable);
    await pgPool.query(createIncidentsTable);
    await pgPool.query(createIndexes);

    logger.info('✅ Database tables created/verified successfully');
  } catch (error) {
    logger.error('❌ Error creating database tables:', error);
    throw error;
  }
}

/**
 * Save boat position to database
 */
async function saveBoatPosition(boatNumber, positionData) {
  if (!pgPool) {
    logger.debug('No database connection, skipping position save');
    return;
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
    throw new Error('Database not available');
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
    return [];
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
    return null;
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

module.exports = {
  initializeDatabase,
  saveBoatPosition,
  saveBoatIncident,
  getBoatPositionHistory,
  cacheSet,
  cacheGet,
  cacheDel,
  closeConnections,
  // Boat CRUD operations
  createBoat,
  getAllBoats,
  getBoat,
  updateBoat,
  deleteBoat,
  bulkImportBoats,
  // Device mapping operations
  createDeviceMapping,
  getDeviceMappingByIMEI,
  getAllDeviceMappings,
  updateDeviceMapping,
  // Voting operations
  recordVote,
  getVoteCounts,
  getUserVotes,
  // Database connections
  pgPool: () => pgPool,
  redisClient: () => redisClient
};
