const { test, expect } = require('@playwright/test');
const { faker } = require('@faker-js/faker');
const { TEST_USER_EMAIL, FIXED_OTP_CODE } = require('../test-data.js');

const API_BASE_URL = 'https://funmi-auth.smcdao.com';
const OTP_VERIFY_PATH = '/api/auth/verify';
const OTP_ENDPOINT = `${API_BASE_URL}${OTP_VERIFY_PATH}`;

const REQUIRED_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const RANDOM_6_DIGIT_CODE = () => faker.string.numeric({ length: 6 });

// Error Response Constants
const REQUIRED_EMAIL_ONLY_ERROR_RESPONSE = {
  success: false,
  error: {
    email: ['Required'],
  },
};

const INVALID_EMAIL_ONLY_ERROR_RESPONSE = {
  success: false,
  error: {
    email: ['Invalid email'],
  },
};

const REQUIRED_CODE_ONLY_ERROR_RESPONSE = {
  success: false,
  error: {
    code: ['Required'],
  },
};

// Simplified error message for invalid code
const INVALID_CODE_MESSAGE_RESPONSE = {
  message: 'The provided code is invalid',
};

// Test Scenarios
const verifyTestData = [
  {
    name: 'Positive Test Case: Valid Email and OTP Code',
    expectedStatus: 200,
    data: {
      email: TEST_USER_EMAIL,
      code: FIXED_OTP_CODE,
    },
    scenarioType: 'success',
  },
  {
    name: 'Negative Test Case: Truly Invalid 6-Digit OTP code (e.g., non-existent code)',
    expectedStatus: 403,
    data: {
      email: TEST_USER_EMAIL,
      code: '999999',
    },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_CODE_MESSAGE_RESPONSE,
  },
  {
    name: 'Negative Test Case: Missing email in request body (Required Check)',
    expectedStatus: 422,
    data: {
      code: RANDOM_6_DIGIT_CODE(),
    },
    scenarioType: 'failure',
    expectedBodyMatch: REQUIRED_EMAIL_ONLY_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Missing OTP code in request body (Required Check)',
    expectedStatus: 422,
    data: {
      email: TEST_USER_EMAIL,
    },
    scenarioType: 'failure',
    expectedBodyMatch: REQUIRED_CODE_ONLY_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Invalid email format (e.g., missing @)',
    expectedStatus: 422,
    data: {
      email: 'useratdomaincom',
      code: RANDOM_6_DIGIT_CODE(),
    },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_EMAIL_ONLY_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Code from a different, non-requested user',
    expectedStatus: 403,
    data: {
      email: faker.internet.email(),
      code: RANDOM_6_DIGIT_CODE(),
    },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_CODE_MESSAGE_RESPONSE,
  },
];

test.describe('OTP Verification Endpoint Validation', () => {
  for (const scenario of verifyTestData) {
    test(`Scenario: ${scenario.name} (Expect Status: ${scenario.expectedStatus})`, async ({
      request,
    }) => {
      console.log(`Sending request to ${OTP_ENDPOINT}`);
      console.log(`Payload: ${JSON.stringify(scenario.data)}`);

      const response = await request.post(OTP_ENDPOINT, {
        headers: REQUIRED_HEADERS,
        data: scenario.data,
      });

      const statusCode = response.status();
      const responseBody = await response.json();

      console.log(`Received Status Code: ${statusCode} (Expected: ${scenario.expectedStatus})`);
      console.log('Response Body:');
      console.log(JSON.stringify(responseBody, null, 2));

      expect(statusCode).toBe(scenario.expectedStatus);

      if (scenario.scenarioType === 'success') {
        expect(responseBody).toHaveProperty('message', 'OTP verified successfully');
        expect(responseBody).toHaveProperty('tokens');

        const tokens = responseBody.tokens;
        expect(tokens).toHaveProperty('access_token');
        expect(typeof tokens.access_token).toBe('string');
        expect(tokens.access_token.length).toBeGreaterThan(10);

        expect(tokens).toHaveProperty('refresh_token');
        expect(typeof tokens.refresh_token).toBe('string');
        expect(tokens.refresh_token.length).toBeGreaterThan(10);

        console.log(
          `Success Message: ${responseBody.message} | Access Token starts with: ${tokens.access_token.substring(0, 5)}...`
        );
      } else if (scenario.scenarioType === 'failure') {
        expect(responseBody).toEqual(scenario.expectedBodyMatch);
        console.log(`Failure Body Verified: ${JSON.stringify(responseBody)}`);
      }
    });
  }
});
