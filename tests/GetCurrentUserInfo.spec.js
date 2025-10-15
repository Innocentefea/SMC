import { test, expect } from '@playwright/test';
import { TEST_USER_EMAIL, FIXED_OTP_CODE } from '../test-data.js';

const BASE_URL = 'https://funmi-auth.smcdao.com';

// Endpoints
const VERIFY_OTP_ENDPOINT = `${BASE_URL}/api/auth/verify`;
const GET_USER_INFO_ENDPOINT = `${BASE_URL}/api/users/me`;

// Common Headers
const COMMON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

let accessToken;

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

test.describe('Get Current User Info API', () => {
  // STEP 1: Verify OTP and get access token
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
    expect(body.tokens).toHaveProperty('access_token');

    accessToken = body.tokens.access_token;
  });

  // STEP 2: Successfully fetch current user info
  test('Should fetch current user info successfully', async ({ request }) => {
    const response = await request.get(GET_USER_INFO_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await expectJsonResponse(response);
    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('user');

    const user = body.user;
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email', TEST_USER_EMAIL);
    expect(user).toHaveProperty('first_name');
    expect(user).toHaveProperty('last_name');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('kyc_verified');
    expect(user).toHaveProperty('created_at');

    expect(typeof user.id).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(typeof user.first_name).toBe('string');
    expect(typeof user.last_name).toBe('string');
    expect(typeof user.role).toBe('string');
    expect(typeof user.username).toBe('string');
    expect(typeof user.kyc_verified).toBe('boolean');
    expect(typeof user.created_at).toBe('string');
  });

  // STEP 3: Missing Authorization Header
  test('Should return 401 when Authorization header is missing', async ({ request }) => {
    const response = await request.get(GET_USER_INFO_ENDPOINT, {
      headers: {
        Accept: 'application/json',
      },
    });

    const body = await expectJsonResponse(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toHaveProperty('message', 'You are not authenticated');
    expect(body).toHaveProperty('reason', 'bad_token');
  });

  // STEP 4: Invalid Token
  test('Should return 401 when using invalid token', async ({ request }) => {
    const invalidToken = 'invalid_token_123';

    const response = await request.get(GET_USER_INFO_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${invalidToken}`,
      },
    });

    const body = await expectJsonResponse(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toHaveProperty('message', 'You are not authenticated');
    expect(body).toHaveProperty('reason', 'bad_token');
  });

  // STEP 5: Expired Token
  test('Should return 401 when using expired token', async ({ request }) => {
    const expiredToken = 'expired_token_example_123';

    const response = await request.get(GET_USER_INFO_ENDPOINT, {
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
});
