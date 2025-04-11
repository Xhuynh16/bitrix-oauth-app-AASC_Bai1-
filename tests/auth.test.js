const request = require('supertest');
const app = require('../server');

describe('Auth Endpoints', () => {
  test('POST /auth/install-event should handle Bitrix24 installation', async () => {
    const response = await request(app)
      .post('/auth/install-event')
      .send({
        event: 'ONAPPINSTALL',
        auth: {
          domain: 'test.bitrix24.com',
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          expires_in: 3600
        }
      });
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('GET /auth/auth should handle OAuth callback', async () => {
    const response = await request(app)
      .get('/auth/auth')
      .query({
        code: 'test_code',
        domain: 'test.bitrix24.com'
      });
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
}); 