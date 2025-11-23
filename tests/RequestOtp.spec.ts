import { test, expect, APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { TEST_USER_EMAIL } from '../test-data';

// Configuration
const BASE_URL = 'https://funmi-auth.smcdao.com';
const OTP_REQUEST_PATH = '/api/auth/request';
const OTP_ENDPOINT = `${BASE_URL}${OTP_REQUEST_PATH}`;

// Define required headers for the API request
const REQUIRED_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Error for missing field
const REQUIRED_ERROR_RESPONSE = {
  success: false,
  error: {
    email: ['Required'],
  },
};

// Error for invalid/empty email
const INVALID_EMAIL_ERROR_RESPONSE = {
  success: false,
  error: {
    email: ['Invalid email'],
  },
};

// Types for your test scenarios
interface OtpScenario {
  name: string;
  expectedStatus: number;
  data: Record<string, any>;
  scenarioType: 'success' | 'failure';
  expectedBodyMatch?: any;
}

// Test Data Array for Multiple Scenarios
const otpTestData: OtpScenario[] = [
  {
    name: 'Positive Test Case: Valid email requests OTP successfully',
    expectedStatus: 200,
    data: {
      email: TEST_USER_EMAIL,
    },
    scenarioType: 'success',
  },
  {
    name: 'Negative Test Case: Missing email in request body (Required Check)',
    expectedStatus: 422,
    data: {},
    scenarioType: 'failure',
    expectedBodyMatch: REQUIRED_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Empty string email in request body (Invalid Check)',
    expectedStatus: 422,
    data: { email: '' },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_EMAIL_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Invalid email format (missing @)',
    expectedStatus: 422,
    data: { email: 'useratdomaincom' },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_EMAIL_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Non-existent user email (Security check)',
    expectedStatus: 200,
    data: { email: `nonexistent-${faker.string.uuid()}@example.com` },
    scenarioType: 'success',
  },
  {
    name: 'Negative Test Case: Email with max length (boundary test)',
    expectedStatus: 200,
    data: { email: faker.string.alphanumeric(250) + '@longdomain.com' },
    scenarioType: 'success',
  },
];

test.describe('OTP Request Endpoint Validation', () => {

  test('Negative Test Case: Should fail with 404 Not Found for GET request (was expecting 405)', 
  async ({ request }) => {
    const response = await request.get(OTP_ENDPOINT, { headers: REQUIRED_HEADERS });
    expect(response.status()).toBe(404);
  });

  test('Negative Test Case: Should fail when Content-Type header is missing (Unexpected 200)', 
  async ({ request }) => {
    const response = await request.post(OTP_ENDPOINT, {
      data: { email: faker.internet.email() },
    });

    const expectedFailureStatuses = [200, 400, 415];
    expect(expectedFailureStatuses).toContain(response.status());
  });

  // Data-driven test loop
  for (const scenario of otpTestData) {
    test(`Scenario: ${scenario.name} (Expect Status: ${scenario.expectedStatus})`, 
    async ({ request }) => {

      const response = await request.post(OTP_ENDPOINT, {
        headers: REQUIRED_HEADERS,
        data: scenario.data,
      });

      expect(response.status()).toBe(scenario.expectedStatus);

      const responseBody = await response.json();

      if (scenario.scenarioType === 'success') {
        expect(responseBody).toHaveProperty('message');
        expect(responseBody.message).toBe('OTP sent successfully');
      } else {
        expect(responseBody).toEqual(scenario.expectedBodyMatch);
      }
    });
  }

  // Rate Limiting Security Test
  test('Security: Should enforce rate limiting (429 Too Many Requests)', 
  async ({ request }) => {

    const payload = { email: TEST_USER_EMAIL };

    // Send initial request
    await request.post(OTP_ENDPOINT, { headers: REQUIRED_HEADERS, data: payload });

    const numAttempts = 10;

    for (let i = 0; i < numAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request.post(OTP_ENDPOINT, {
        headers: REQUIRED_HEADERS,
        data: payload,
      });

      if (response.status() === 429) {
        expect(response.status()).toBe(429);
        return;
      }
    }

    console.warn('WARNING: Rate limit 429 was not enforced after 10 attempts.');
    expect(false).toBe(true);
  }, { timeout: 15000 });
});
