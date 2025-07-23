const request = require('supertest');
const app = require('../app');

describe('PrideSync Backend API', () => {
  
  describe('Health Check', () => {
    test('GET /health should return 200 and status OK', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('API Routes', () => {
    test('GET /api/boats should return boats data', async () => {
      const response = await request(app)
        .get('/api/boats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('boats');
      expect(Array.isArray(response.body.boats)).toBe(true);
    });

    test('GET /api/parade/status should return parade status', async () => {
      const response = await request(app)
        .get('/api/parade/status')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('parade');
    });
  });

  describe('Webhook Endpoints', () => {
    test('POST /api/webhooks/kpn-gps should accept GPS data', async () => {
      const gpsData = {
        bootnummer: 1,
        latitude: 52.3851, // Start of parade route (Westerdok)
        longitude: 4.8947,
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/webhooks/kpn-gps')
        .send(gpsData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('bootnummer', 1);
    });

    test('POST /api/webhooks/kpn-gps should reject invalid data', async () => {
      const invalidData = {
        bootnummer: 1
        // Missing required fields: timestamp, latitude, longitude
      };

      const response = await request(app)
        .post('/api/webhooks/kpn-gps')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid payload');
      expect(response.body).toHaveProperty('details');
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Endpoint not found');
      expect(response.body).toHaveProperty('path', '/nonexistent');
      expect(response.body).toHaveProperty('method', 'GET');
    });
  });

  describe('Security Headers', () => {
    test('Should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('CORS', () => {
    test('Should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/boats')
        .set('Origin', 'http://localhost:3001')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
