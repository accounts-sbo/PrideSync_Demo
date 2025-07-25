const axios = require('axios');
const logger = require('../src/services/logger');

// Amsterdam Pride Canal Route (simplified)
const PRIDE_ROUTE = [
  { lat: 52.3676, lng: 4.9041, name: "Start - Westerdok" },
  { lat: 52.3691, lng: 4.9012, name: "Noorderkerk" },
  { lat: 52.3703, lng: 4.8989, name: "Brouwersgracht" },
  { lat: 52.3715, lng: 4.8967, name: "Herengracht" },
  { lat: 52.3728, lng: 4.8945, name: "Keizersgracht" },
  { lat: 52.3741, lng: 4.8923, name: "Prinsengracht" },
  { lat: 52.3754, lng: 4.8901, name: "Reguliersgracht" },
  { lat: 52.3767, lng: 4.8879, name: "Utrechtsestraat" },
  { lat: 52.3680, lng: 4.8957, name: "Amstel" },
  { lat: 52.3665, lng: 4.8978, name: "Finish - Magere Brug" }
];

// Demo boats with their assigned IMEI numbers
const DEMO_BOATS = [
  { boat_number: 1, imei: "353760970649317", name: "Spread the Word Intersex Collective" },
  { boat_number: 2, imei: "353760970649318", name: "Trans Pride powered by Rabobank" },
  { boat_number: 3, imei: "353760970649319", name: "Amnesty International" },
  { boat_number: 4, imei: "353760970649320", name: "Roze Stadsdorp Amsterdam" },
  { boat_number: 5, imei: "353760970649321", name: "Pink Ladies" },
  { boat_number: 10, imei: "353760970649322", name: "COC Nederland" },
  { boat_number: 15, imei: "353760970649323", name: "Equal Rights Coalition" },
  { boat_number: 20, imei: "353760970649324", name: "MADAME CLAIRE BERLIN" },
  { boat_number: 25, imei: "353760970649325", name: "3 Layers" },
  { boat_number: 30, imei: "353760970649326", name: "Gemeente Amsterdam" }
];

class GPSSimulator {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl || 'http://localhost:3001/api/webhooks/tracker-gps';
    this.interval = options.interval || 1000; // 1 second
    this.isRunning = false;
    this.boats = new Map();
    this.startTime = Date.now();
    
    // Initialize boat positions
    this.initializeBoats();
  }

  initializeBoats() {
    DEMO_BOATS.forEach((boat, index) => {
      // Spread boats along the route with some spacing
      const routeIndex = Math.floor((index / DEMO_BOATS.length) * PRIDE_ROUTE.length);
      const position = PRIDE_ROUTE[Math.min(routeIndex, PRIDE_ROUTE.length - 1)];
      
      this.boats.set(boat.imei, {
        ...boat,
        currentPosition: { ...position },
        routeIndex: routeIndex,
        speed: 2 + Math.random() * 3, // 2-5 km/h
        lastUpdate: Date.now(),
        sequenceNumber: 1000 + index * 100
      });
    });

    logger.info(`GPS Simulator initialized with ${this.boats.size} boats`);
  }

  // Calculate next position along the route
  calculateNextPosition(boat) {
    const route = PRIDE_ROUTE;
    const currentIndex = boat.routeIndex;
    
    if (currentIndex >= route.length - 1) {
      // Boat finished the route, reset to start
      boat.routeIndex = 0;
      return { ...route[0] };
    }

    const current = route[currentIndex];
    const next = route[currentIndex + 1];
    
    // Calculate distance and bearing to next waypoint
    const distance = this.calculateDistance(current.lat, current.lng, next.lat, next.lng);
    const bearing = this.calculateBearing(current.lat, current.lng, next.lat, next.lng);
    
    // Move boat based on speed (convert km/h to degrees per second approximately)
    const speedInDegreesPerSecond = (boat.speed / 3600) * 0.009; // Very rough approximation
    const moveDistance = speedInDegreesPerSecond * (this.interval / 1000);
    
    if (moveDistance >= distance) {
      // Reached next waypoint
      boat.routeIndex++;
      return { ...next };
    } else {
      // Move towards next waypoint
      const newLat = current.lat + (moveDistance * Math.cos(bearing * Math.PI / 180));
      const newLng = current.lng + (moveDistance * Math.sin(bearing * Math.PI / 180));
      
      return { lat: newLat, lng: newLng };
    }
  }

  // Calculate distance between two points in degrees (rough approximation)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  // Calculate bearing between two points
  calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    return Math.atan2(dLng, dLat) * 180 / Math.PI;
  }

  // Generate tracker device payload
  generateTrackerPayload(boat) {
    const now = new Date();
    const gpsTime = new Date(now.getTime() - Math.random() * 10000); // GPS time slightly behind
    
    boat.sequenceNumber += Math.floor(Math.random() * 3) + 1;
    
    return {
      SerNo: 1326997 + parseInt(boat.imei.slice(-3)),
      IMEI: boat.imei,
      ICCID: "8931081421078397252",
      ProdId: 127,
      FW: "127.1.1.0",
      Records: [
        {
          SeqNo: boat.sequenceNumber,
          Reason: Math.random() > 0.8 ? 49 : 11, // Mostly periodic (11), sometimes event-based (49)
          DateUTC: now.toISOString().replace('T', ' ').slice(0, 19),
          Fields: [
            {
              GpsUTC: gpsTime.toISOString().replace('T', ' ').slice(0, 19),
              Lat: boat.currentPosition.lat + (Math.random() - 0.5) * 0.0001, // Add small GPS noise
              Long: boat.currentPosition.lng + (Math.random() - 0.5) * 0.0001,
              Alt: 5 + Math.random() * 10, // 5-15m altitude
              Spd: Math.max(0, boat.speed + (Math.random() - 0.5) * 1), // Speed with variation
              SpdAcc: 2,
              Head: Math.floor(Math.random() * 360),
              PDOP: 15 + Math.random() * 15, // Position dilution
              PosAcc: 20 + Math.random() * 10, // Position accuracy
              GpsStat: Math.random() > 0.1 ? 7 : 3, // Usually good GPS (7), sometimes poor (3)
              FType: 0 // GPS data
            },
            {
              DIn: 2,
              DOut: 0,
              DevStat: 2,
              FType: 2 // Digital I/O data
            },
            {
              AnalogueData: {
                "1": 5200 + Math.floor(Math.random() * 100), // Battery voltage
                "3": 2300 + Math.floor(Math.random() * 200), // Some sensor
                "4": Math.floor(Math.random() * 100), // Temperature or similar
                "5": 5200 + Math.floor(Math.random() * 100)  // Another voltage
              },
              FType: 6 // Analogue data
            }
          ]
        }
      ]
    };
  }

  // Send GPS update for a boat
  async sendGPSUpdate(boat) {
    try {
      // Calculate next position
      boat.currentPosition = this.calculateNextPosition(boat);
      boat.lastUpdate = Date.now();

      // Generate payload
      const payload = this.generateTrackerPayload(boat);

      // Send to webhook
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GPS-Tracker-Simulator/1.0'
        },
        timeout: 5000
      });

      if (response.status === 200) {
        logger.debug(`GPS update sent for boat ${boat.boat_number} (${boat.name})`, {
          imei: boat.imei,
          position: [boat.currentPosition.lat.toFixed(6), boat.currentPosition.lng.toFixed(6)],
          routeIndex: boat.routeIndex
        });
      } else {
        logger.warn(`Unexpected response for boat ${boat.boat_number}:`, response.status);
      }

    } catch (error) {
      logger.error(`Error sending GPS update for boat ${boat.boat_number}:`, {
        error: error.message,
        imei: boat.imei
      });
    }
  }

  // Start the simulation
  start() {
    if (this.isRunning) {
      logger.warn('GPS Simulator is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`🚀 Starting GPS Simulator - sending updates every ${this.interval}ms to ${this.webhookUrl}`);
    
    this.intervalId = setInterval(async () => {
      const promises = Array.from(this.boats.values()).map(boat => 
        this.sendGPSUpdate(boat)
      );
      
      await Promise.allSettled(promises);
      
      // Log progress every 30 seconds
      if ((Date.now() - this.startTime) % 30000 < this.interval) {
        const runtime = Math.floor((Date.now() - this.startTime) / 1000);
        logger.info(`GPS Simulator running for ${runtime}s - ${this.boats.size} boats active`);
      }
    }, this.interval);
  }

  // Stop the simulation
  stop() {
    if (!this.isRunning) {
      logger.warn('GPS Simulator is not running');
      return;
    }

    this.isRunning = false;
    clearInterval(this.intervalId);
    
    const runtime = Math.floor((Date.now() - this.startTime) / 1000);
    logger.info(`🛑 GPS Simulator stopped after ${runtime}s`);
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      boatCount: this.boats.size,
      runtime: Math.floor((Date.now() - this.startTime) / 1000),
      webhookUrl: this.webhookUrl,
      interval: this.interval,
      boats: Array.from(this.boats.values()).map(boat => ({
        boat_number: boat.boat_number,
        name: boat.name,
        imei: boat.imei,
        position: boat.currentPosition,
        routeIndex: boat.routeIndex,
        speed: boat.speed
      }))
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const webhookUrl = args[0] || 'http://localhost:3001/api/webhooks/tracker-gps';
  const interval = parseInt(args[1]) || 1000;

  const simulator = new GPSSimulator({ webhookUrl, interval });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, stopping GPS simulator...');
    simulator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, stopping GPS simulator...');
    simulator.stop();
    process.exit(0);
  });

  // Start simulation
  simulator.start();

  // Log status every minute
  setInterval(() => {
    const status = simulator.getStatus();
    logger.info('GPS Simulator Status:', {
      runtime: `${status.runtime}s`,
      boats: status.boatCount,
      isRunning: status.isRunning
    });
  }, 60000);
}

module.exports = GPSSimulator;
