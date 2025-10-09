const { test, expect } = require('@playwright/test');
const { faker } = require('@faker-js/faker');
const { TEST_USER_EMAIL, FIXED_OTP_CODE } = require('../test-data.js');

const API_BASE_URL = 'https://funmi-auth.smcdao.com';
const VERIFY_OTP_PATH = '/api/auth/verify';
const UPDATE_USER_PATH = '/api/users/me';

const REQUIRED_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

let accessToken;
let tokenLogged = false;

// Disable parallel execution
test.describe.configure({ mode: 'serial' });

// Generate realistic random user data
function generateUserData() {
  const first = faker.person.firstName();
  const last = faker.person.lastName();
  return {
    first_name: first,
    last_name: last,
    username: faker.internet.username().toLowerCase(),
  };
}

test.describe('Update User Info API', () => {
  test.beforeAll(async ({ request }) => {
    const verifyResponse = await request.post(`${API_BASE_URL}${VERIFY_OTP_PATH}`, {
      headers: REQUIRED_HEADERS,
      data: {
        email: TEST_USER_EMAIL,
        code: FIXED_OTP_CODE,
      },
    });

    const verifyStatus = verifyResponse.status();
    const verifyBody = await verifyResponse.json();

    if (verifyStatus !== 200) {
      console.error('OTP verification failed:', JSON.stringify(verifyBody, null, 2));
      throw new Error('Failed to acquire access token');
    }

    accessToken = verifyBody.tokens.access_token;

    if (!tokenLogged) {
      console.log('Access token acquired:', accessToken.substring(0, 15) + '...');
      tokenLogged = true;
    }
  });

  test('should successfully update user info and return complete user object', async ({ request }) => {
    const newUserData = generateUserData();

    const response = await request.put(`${API_BASE_URL}${UPDATE_USER_PATH}`, {
      headers: {
        ...REQUIRED_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: newUserData,
    });

    const body = await response.json();
    const status = response.status();

    console.log('[Success] Status Code:', status);
    console.log('[Success] Response:', JSON.stringify(body, null, 2));

    expect(status).toBe(200);
    expect(body).toHaveProperty('user');

    const user = body.user;
    expect(user).toMatchObject({
      email: TEST_USER_EMAIL,
      first_name: newUserData.first_name,
      last_name: newUserData.last_name,
      username: newUserData.username,
      role: 'user',
      kyc_verified: false,
    });
  });

  test('should return 401 when no bearer token is provided', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}${UPDATE_USER_PATH}`, {
      headers: REQUIRED_HEADERS,
      data: generateUserData(),
    });

    const body = await response.json();
    const status = response.status();

    console.log('[No Token] Status Code:', status);
    console.log('[No Token] Response:', JSON.stringify(body, null, 2));

    expect(status).toBe(401);
  });

  test('should return 401 when using an invalid bearer token', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}${UPDATE_USER_PATH}`, {
      headers: {
        ...REQUIRED_HEADERS,
        Authorization: 'Bearer invalid_token_123',
      },
      data: generateUserData(),
    });

    const body = await response.json();
    const status = response.status();

    console.log('[Invalid Token] Status Code:', status);
    console.log('[Invalid Token] Response:', JSON.stringify(body, null, 2));

    expect(status).toBe(401);
  });

  test('should return 400/422/404 when sending invalid payload types', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}${UPDATE_USER_PATH}`, {
      headers: {
        ...REQUIRED_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        first_name: 123,
        last_name: true,
        username: null,
      },
    });

    const body = await response.json();
    const status = response.status();

    console.log('[Invalid Payload Types] Status Code:', status);
    console.log('[Invalid Payload Types] Response:', JSON.stringify(body, null, 2));

    expect([400, 422, 404]).toContain(status);

    if (status !== 404) {
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
    }
  });

  test('should return error when required fields are missing', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}${UPDATE_USER_PATH}`, {
      headers: {
        ...REQUIRED_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: {}, // empty payload
    });

    const body = await response.json();
    const status = response.status();

    console.log('[Missing Fields] Status Code:', status);
    console.log('[Missing Fields] Response:', JSON.stringify(body, null, 2));

    expect([400, 422, 404]).toContain(status);

    if (status !== 404) {
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('first_name');
      expect(body.error).toHaveProperty('last_name');
      expect(body.error).toHaveProperty('username');
    }
  });

  test('should return 422 when username is already in use', async ({ request }) => {
    const duplicateUsername = 'dup_user_' + Date.now();

    // First: Set the username
    const firstUpdate = await request.put(`${API_BASE_URL}${UPDATE_USER_PATH}`, {
      headers: {
        ...REQUIRED_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        username: duplicateUsername,
      },
    });

    const firstStatus = firstUpdate.status();
    expect(firstStatus).toBe(200);

    // Then: Try reusing the same username
    const secondUpdate = await request.put(`${API_BASE_URL}${UPDATE_USER_PATH}`, {
      headers: {
        ...REQUIRED_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        username: duplicateUsername,
      },
    });

    const secondStatus = secondUpdate.status();
    const secondBody = await secondUpdate.json();

    console.log('[Duplicate Username] Status Code:', secondStatus);
    console.log('[Duplicate Username] Response:', JSON.stringify(secondBody, null, 2));

    expect(secondStatus).toBe(422);
    expect(secondBody).toHaveProperty('success', false);
    expect(secondBody.error).toHaveProperty('username');
  });
});
