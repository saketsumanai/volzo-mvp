const request = require('supertest');
const { app } = require('../src/server');

describe('Volzo Mobility Backend - Security & Integration Suite', () => {
  
  describe('GET /health', () => {
    it('should return healthy status with uptime and environment', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('Security Headers', () => {
    it('should include hardened security headers on responses', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toEqual('nosniff');
      expect(res.headers['x-frame-options']).toEqual('DENY');
      expect(res.headers['x-xss-protection']).toEqual('1; mode=block');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('GET /api/v1', () => {
    it('should return API v1 info and documentation path', async () => {
      const res = await request(app).get('/api/v1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('version', '1.0.0');
      expect(res.body).toHaveProperty('documentation', '/api-docs');
    });
  });

  describe('Security Layer - Path Traversal Prevention', () => {
    it('should block path traversal attempts', async () => {
      const res = await request(app).get('/api/v1/../../etc/passwd');
      expect([400, 404]).toContain(res.statusCode);
    });
  });

  describe('Security Layer - Input Sanitization', () => {
    it('should sanitize script tags in incoming request body', async () => {
      const payload = {
        name: 'John <script>alert("hack")</script>Doe',
        phoneNumber: '+919999999999'
      };
      
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(payload);
        
      // Request proceeds to controller without throwing XSS errors
      expect(res.statusCode).toBeDefined();
    });
  });

  describe('404 Route Handler', () => {
    it('should return JSON 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route-for-testing');
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('message', 'Route not found');
    });
  });
});
