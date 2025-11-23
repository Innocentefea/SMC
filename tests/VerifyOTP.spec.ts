import { test, expect, APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { TEST_USER_EMAIL, FIXED_OTP_CODE } from '../test-data';

const API_BASE_URL = 'https://funmi-auth.smcdao.com';
const OTP_VERIFY_PATH = '/api/auth/verify';
const OTP_ENDPOINT = `${API_BASE_URL}${OTP_VERIFY_PATH}`;

const REQUIRED_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
} as const;

const RANDOM_6_DIGIT_CODE = (): string => faker.string.numeric({ length: 6 });

// Response Types

interface ErrorResponse {
  success?: boolean;
  error?: Record<string, string[]>;
  message?: string;
}

interface SuccessResponse {
  message: string;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

type OTPResponse = ErrorResponse | SuccessResponse;

// Error Response Constants

const REQUIRED_EMAIL_ONLY_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: {
    email: ['Required'],
  },
};

const INVALID_EMAIL_ONLY_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: {
    email: ['Invalid email'],
  },
};

const REQUIRED_CODE_ONLY_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: {
    code: ['Required'],
  },
};

const INVALID_CODE_MESSAGE_RESPONSE: ErrorResponse = {
  message: 'The provided code is invalid',
};

// Scenario Types

interface VerifyScenario {
  name: string;
  expectedStatus: number;
  data: Record<string, any>;
  scenarioType: 'success' | 'failure';
  expectedBodyMatch?: any;
}

// Test Scenarios

const verifyTestData: VerifyScenario[] = [
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
    name: 'Negative Test Case: Truly Invalid 6-Digit OTP code',
    expectedStatus: 403,
    data: {
      email: TEST_USER_EMAIL,
      code: '999999',
    },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_CODE_MESSAGE_RESPONSE,
  },
  {
    name: 'Negative Test Case: Missing email',
    expectedStatus: 422,
    data: {
      code: RANDOM_6_DIGIT_CODE(),
    },
    scenarioType: 'failure',
    expectedBodyMatch: REQUIRED_EMAIL_ONLY_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Missing OTP code',
    expectedStatus: 422,
    data: {
      email: TEST_USER_EMAIL,
    },
    scenarioType: 'failure',
    expectedBodyMatch: REQUIRED_CODE_ONLY_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Invalid email format',
    expectedStatus: 422,
    data: {
      email: 'useratdomaincom',
      code: RANDOM_6_DIGIT_CODE(),
    },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_EMAIL_ONLY_ERROR_RESPONSE,
  },
  {
    name: 'Negative Test Case: Code for wrong user',
    expectedStatus: 403,
    data: {
      email: faker.internet.email(),
      code: RANDOM_6_DIGIT_CODE(),
    },
    scenarioType: 'failure',
    expectedBodyMatch: INVALID_CODE_MESSAGE_RESPONSE,
  },
];

// Test Block

test.describe('OTP Verification Endpoint Validation', () => {
  for (const scenario of verifyTestData) {
    test(`Scenario: ${scenario.name} (Expect ${scenario.expectedStatus})`, async ({
      request,
    }) => {
      console.log(`Sending request to ${OTP_ENDPOINT}`);
      console.log(`Payload: ${JSON.stringify(scenario.data)}`);

      const response = await request.post(OTP_ENDPOINT, {
        headers: REQUIRED_HEADERS,
        data: scenario.data,
      });

      const statusCode = response.status();
      const responseBody: OTPResponse = await response.json();

      console.log(`Received Status Code: ${statusCode}`);
      console.log('Response Body:', JSON.stringify(responseBody, null, 2));

      expect(statusCode).toBe(scenario.expectedStatus);

      if (scenario.scenarioType === 'success') {
        const body = responseBody as SuccessResponse;

        expect(body).toHaveProperty('message', 'OTP verified successfully');
        expect(body).toHaveProperty('tokens');

        const { access_token, refresh_token } = body.tokens;

        expect(typeof access_token).toBe('string');
        expect(access_token.length).toBeGreaterThan(10);

        expect(typeof refresh_token).toBe('string');
        expect(refresh_token.length).toBeGreaterThan(10);

        console.log(`Success: ${body.message}`);
      } else {
        expect(responseBody).toEqual(scenario.expectedBodyMatch);
        console.log('Failure Verified.');
      }
    });
  }
});
