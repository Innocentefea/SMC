import { test, expect } from '@playwright/test';
import { TEST_USER_EMAIL, FIXED_OTP_CODE } from '../test-data.js';

const BASE_URL = 'https://funmi-auth.smcdao.com';
const VERIFY_OTP_ENDPOINT = `${BASE_URL}/api/auth/verify`;
const LIST_CLIENTS_ENDPOINT = `${BASE_URL}/api/clients`;

const COMMON_HEADERS = {
  Accept: 'application/json',
};

let accessToken;

// Helper to parse response, assert content-type, and log safe JSON
async function expectJsonResponse(response, fieldsToLog = []) {
  const contentType = response.headers()['content-type'];
  expect(contentType).toContain('application/json');
  const body = await response.json();

  const safeBody = fieldsToLog.length
    ? fieldsToLog.reduce((obj, key) => {
        if (key in body) obj[key] = body[key];
        return obj;
      }, {})
    : body;

  console.log(JSON.stringify(safeBody, null, 2));
  console.log('Status Code:', response.status());

  return body;
}

test.describe('List All Clients API', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post(VERIFY_OTP_ENDPOINT, {
      headers: COMMON_HEADERS,
      data: {
        email: TEST_USER_EMAIL,
        code: FIXED_OTP_CODE,
      },
    });

    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(body).toHaveProperty('tokens.access_token');

    accessToken = body.tokens.access_token;
  });

  test('Should list all clients successfully', async ({ request }) => {
    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await expectJsonResponse(response);
    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('clients');
    expect(Array.isArray(body.clients)).toBeTruthy();

    if (body.clients.length > 0) {
      const client = body.clients[0];
      expect(client).toHaveProperty('id');
      expect(client).toHaveProperty('name');
      expect(client).toHaveProperty('description');
      expect(client).toHaveProperty('redirect_uris');
      expect(client).toHaveProperty('permissions');
      expect(client).toHaveProperty('is_active');
      expect(client).toHaveProperty('created_at');
    }
  });

  test('Should return 401 when Authorization header is missing', async ({ request }) => {
    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
      },
    });

    const body = await expectJsonResponse(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toHaveProperty('message', 'You are not authenticated');
  });

  test('Should return 401 for invalid bearer token', async ({ request }) => {
    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer invalid_token_12345',
      },
    });

    const body = await expectJsonResponse(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toHaveProperty('message', 'You are not authenticated');
    expect(body).toHaveProperty('reason', 'bad_token');
  });

  test('Should return 401 for expired bearer token', async ({ request }) => {
    const expiredToken = accessToken.slice(0, -5) + 'abcde';

    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    const body = await expectJsonResponse(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toHaveProperty('message', 'You are not authenticated');
    expect(body).toHaveProperty('reason', 'bad_token');
  });

  test('Should return 405 for wrong HTTP method (POST instead of GET)', async ({ request }) => {
    const response = await request.post(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await expectJsonResponse(response, ['message']);
    expect(response.status()).toBe(405);
    expect(body).toHaveProperty('message');

    const allowHeader = response.headers()['allow'];
    if (allowHeader) {
      console.log('Allow header:', allowHeader);
      expect(allowHeader).toContain('GET');
    }
  });
});
