const boatState = require('../services/boatState');
const logger = require('../services/logger');

describe('Services', () => {
  
  describe('BoatState Service', () => {
    beforeEach(() => {
      // Clear any existing boat states
      boatState.clearAllBoatStates();
    });

    test('should initialize with empty boat states', () => {
      const boats = boatState.getAllBoatStates();
      expect(Array.isArray(boats)).toBe(true);
      expect(boats.length).toBe(0);
    });

    test('should update boat position', () => {
      const boatNumber = 1;
      const positionData = {
        latitude: 52.3676,
        longitude: 4.9041,
        timestamp: new Date().toISOString(),
        speed: 5.2,
        heading: 180,
        routeProgress: 25.5,
        routeDistance: 1000
      };

      boatState.updateBoatPosition(boatNumber, positionData);
      
      const boats = boatState.getAllBoatStates();
      expect(boats.length).toBe(1);
      expect(boats[0].id).toBe(boatNumber);
      expect(boats[0].position.latitude).toBe(positionData.latitude);
      expect(boats[0].position.longitude).toBe(positionData.longitude);
    });

    test('should get specific boat state', () => {
      const boatNumber = 2;
      const positionData = {
        latitude: 52.3676,
        longitude: 4.9041,
        timestamp: new Date().toISOString(),
        speed: 3.1,
        heading: 90
      };

      boatState.updateBoatPosition(boatNumber, positionData);
      
      const boat = boatState.getBoatState(boatNumber);
      expect(boat).toBeDefined();
      expect(boat.id).toBe(boatNumber);
      expect(boat.position.speed).toBe(positionData.speed);
    });

    test('should return null for non-existent boat', () => {
      const boat = boatState.getBoatState(999);
      expect(boat).toBeNull();
    });

    test('should update boat status', () => {
      const boatNumber = 3;
      
      // First add a boat
      boatState.updateBoatPosition(boatNumber, {
        latitude: 52.3676,
        longitude: 4.9041,
        timestamp: new Date().toISOString()
      });

      // Then update status
      boatState.updateBoatStatus(boatNumber, 'moving');
      
      const boat = boatState.getBoatState(boatNumber);
      expect(boat.status).toBe('moving');
    });

    test('should handle multiple boats', () => {
      const boats = [
        { id: 1, lat: 52.3676, lng: 4.9041 },
        { id: 2, lat: 52.3700, lng: 4.9100 },
        { id: 3, lat: 52.3650, lng: 4.9000 }
      ];

      boats.forEach(boat => {
        boatState.updateBoatPosition(boat.id, {
          latitude: boat.lat,
          longitude: boat.lng,
          timestamp: new Date().toISOString()
        });
      });

      const allBoats = boatState.getAllBoatStates();
      expect(allBoats.length).toBe(3);
      
      const boatIds = allBoats.map(b => b.id).sort();
      expect(boatIds).toEqual([1, 2, 3]);
    });
  });

  describe('Logger Service', () => {
    test('should be defined and have required methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    test('should log messages without throwing errors', () => {
      expect(() => {
        logger.info('Test info message');
        logger.warn('Test warning message');
        logger.error('Test error message');
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });
});
