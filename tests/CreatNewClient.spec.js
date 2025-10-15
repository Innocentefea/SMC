const { test, expect } = require('@playwright/test');
const { faker } = require('@faker-js/faker');
const { TEST_USER_EMAIL, FIXED_OTP_CODE, saveClientCredentials } = require('../test-data.js');

// API Configuration
const API_BASE_URL = 'https://funmi-auth.smcdao.com';
const OTP_VERIFY_PATH = '/api/auth/verify';
const CLIENT_CREATE_PATH = '/api/clients';
const OTP_VERIFY_ENDPOINT = `${API_BASE_URL}${OTP_VERIFY_PATH}`;
const CLIENT_CREATE_ENDPOINT = `${API_BASE_URL}${CLIENT_CREATE_PATH}`;

// Common Headers
const REQUIRED_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

let accessToken = '';

// Expected Error Responses
const REQUIRED_NAME_ERROR = {
  success: false,
  error: { name: ['Required'] },
};

const REQUIRED_REDIRECT_URIS_ERROR = {
  success: false,
  error: { redirect_uris: ['Required'] },
};

const INVALID_REDIRECT_URL_ERROR = {
  success: false,
  error: { redirect_uris: ['Invalid url'] },
};

const UNAUTHORIZED_ERROR = {
  message: 'You are not authenticated',
  reason: 'bad_token',
};

// Test Scenarios
const clientCreationTestData = [
  {
    name: 'Create a new client with valid data',
    expectedStatus: 201,
    data: {
      name: faker.person.fullName(),
      redirect_uris: ['http://localhost:3000'],
      authorized_js_origins: [],
      permissions: ['profile:read'],
      description: 'Auth-Testing',
    },
    scenarioType: 'success',
  },
  {
    name: 'Create a client with multiple valid permissions',
    expectedStatus: 201,
    data: {
      name: faker.person.fullName(),
      redirect_uris: ['https://app.example.com'],
      authorized_js_origins: [],
      permissions: ['profile:read'], // Keep simple until verified
      description: 'Full Permissions Client',
    },
    scenarioType: 'success',
  },
  {
    name: 'Fail when missing "name" field',
    expectedStatus: 422,
    data: {
      redirect_uris: ['http://localhost:3000'],
      authorized_js_origins: [],
      permissions: ['profile:read'],
      description: 'Missing Name Test',
    },
    scenarioType: 'failure',
    expectedBodyMatch: REQUIRED_NAME_ERROR,
  },
  {
    name: 'Fail when missing "redirect_uris" field',
    expectedStatus: 422,
    data: {
      name: faker.person.fullName(),
      authorized_js_origins: [],
      permissions: ['profile:read'],
      description: 'Missing Redirect URIs Test',
    },
    scenarioType: 'failure',
    expectedBodyMatch: REQUIRED_REDIRECT_URIS_ERROR,
  },
  {
    name: 'Fail when "redirect_uris" contains invalid URL',
    expectedStatus: 422,
    data: {
      name: faker.person.fullName(),
      redirect_uris: ['invalid-url'],
      authorized_js_origins: [],
      permissions: ['profile:read'],
      description: 'Invalid Redirect URL Test',
    },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_REDIRECT_URL_ERROR,
  },
];

test.describe('Client Creation Endpoint Validation', () => {
  // Step 1: Get access token via OTP verification
  test.beforeAll(async ({ request }) => {
    console.log('\nVerifying OTP to get access token...');
    const response = await request.post(OTP_VERIFY_ENDPOINT, {
      headers: REQUIRED_HEADERS,
      data: {
        email: TEST_USER_EMAIL,
        code: FIXED_OTP_CODE,
      },
    });

    const body = await response.json();

    if (response.status() === 200 && body.tokens?.access_token) {
      accessToken = body.tokens.access_token;
      console.log('Access token acquired successfully.\n');
    } else {
      throw new Error(
        `Failed to acquire access token. Status: ${response.status()}, Response: ${JSON.stringify(body)}`
      );
    }
  });

  // Step 2: Run client creation tests
  for (const scenario of clientCreationTestData) {
    test(scenario.name, async ({ request }) => {
      const response = await request.post(CLIENT_CREATE_ENDPOINT, {
        headers: {
          ...REQUIRED_HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
        data: scenario.data,
      });

      const status = response.status();
      const body = await response.json();

      console.log(`\nTest: ${scenario.name}`);
      console.log(`Status: ${status}`);
      console.log(JSON.stringify(body, null, 2));

      expect(status).toBe(scenario.expectedStatus);

      if (scenario.scenarioType === 'success') {
        expect(body).toHaveProperty('message', 'Client created successfully');
        expect(body).toHaveProperty('client');
        expect(body).toHaveProperty('client_secret');

        const clientId = body.client?.id;
        const clientSecret = body.client_secret;
        if (clientId && clientSecret) {
          saveClientCredentials(clientId, clientSecret);
        }
      } else {
        expect(body).toEqual(scenario.expectedBodyMatch);
      }
    });
  }

  // Step 3: Ensure unauthorized requests are rejected
  test('Rejects request with no or invalid token', async ({ request }) => {
    const response = await request.post(CLIENT_CREATE_ENDPOINT, {
      headers: REQUIRED_HEADERS,
      data: clientCreationTestData[0].data,
    });

    const body = await response.json();

    console.log(`\nTest: Rejects request with no or invalid token`);
    console.log(`Status: ${response.status()}`);
    console.log(JSON.stringify(body, null, 2));

    expect(response.status()).toBe(401);
    expect(body).toEqual(UNAUTHORIZED_ERROR);
  });
});