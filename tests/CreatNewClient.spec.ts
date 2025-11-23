import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import {
  TEST_USER_EMAIL,
  FIXED_OTP_CODE,
  saveClientCredentials,
} from '../test-data';

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
} as const;


// Types

interface ClientCreatePayload {
  name?: string;
  redirect_uris?: string[];
  authorized_js_origins?: string[];
  permissions?: string[];
  description?: string;
}

interface OTPVerifyResponse {
  message: string;
  tokens: { access_token: string; refresh_token: string };
}

interface ClientCreateSuccessResponse {
  message: string;
  client: {
    id: string;
    name: string;
    redirect_uris: string[];
    authorized_js_origins: string[];
    permissions: string[];
    description?: string;
  };
  client_secret: string;
}

interface ErrorResponse {
  success?: boolean;
  error?: Record<string, string[]>;
  message?: string;
  reason?: string;
}


// Runtime Variables

let accessToken: string = '';


// Expected Error Responses

const REQUIRED_NAME_ERROR: ErrorResponse = {
  success: false,
  error: { name: ['Required'] },
};

const REQUIRED_REDIRECT_URIS_ERROR: ErrorResponse = {
  success: false,
  error: { redirect_uris: ['Required'] },
};

const INVALID_REDIRECT_URL_ERROR: ErrorResponse = {
  success: false,
  error: { redirect_uris: ['Invalid url'] },
};

const UNAUTHORIZED_ERROR: ErrorResponse = {
  message: 'You are not authenticated',
  reason: 'bad_token',
};


// Test Scenarios

interface Scenario {
  name: string;
  expectedStatus: number;
  data: ClientCreatePayload;
  scenarioType: 'success' | 'failure';
  expectedBodyMatch?: ErrorResponse;
}

const clientCreationTestData: Scenario[] = [
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
      permissions: ['profile:read'],
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


// Test Suite

test.describe('Client Creation Endpoint Validation', () => {
  test.beforeAll(async ({ request }) => {
    console.log('\nVerifying OTP to get access token...');
    const response = await request.post(OTP_VERIFY_ENDPOINT, {
      headers: REQUIRED_HEADERS,
      data: { email: TEST_USER_EMAIL, code: FIXED_OTP_CODE },
    });

    const body = (await response.json()) as OTPVerifyResponse | ErrorResponse;

    if ('tokens' in body && body.tokens?.access_token) {
      accessToken = body.tokens.access_token;
      console.log('Access token acquired successfully.\n');
    } else {
      throw new Error(
        `Failed to acquire access token. Status: ${response.status()}, Response: ${JSON.stringify(
          body
        )}`
      );
    }
  });

  // Run test scenarios
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
      const body = (await response.json()) as
        | ClientCreateSuccessResponse
        | ErrorResponse;

      console.log(`\nTest: ${scenario.name}`);
      console.log(`Status: ${status}`);
      console.log(JSON.stringify(body, null, 2));

      expect(status).toBe(scenario.expectedStatus);

      if (scenario.scenarioType === 'success') {
        const successBody = body as ClientCreateSuccessResponse;

        expect(successBody).toHaveProperty('message', 'Client created successfully');
        expect(successBody).toHaveProperty('client');
        expect(successBody).toHaveProperty('client_secret');

        const clientId = successBody.client?.id;
        const clientSecret = successBody.client_secret;

        if (clientId && clientSecret) {
          saveClientCredentials(clientId, clientSecret);
        }
      } else {
        expect(body).toEqual(scenario.expectedBodyMatch);
      }
    });
  }

  // Unauthorized request test
  test('Rejects request with no or invalid token', async ({ request }) => {
    const response = await request.post(CLIENT_CREATE_ENDPOINT, {
      headers: REQUIRED_HEADERS,
      data: clientCreationTestData[0].data,
    });

    const body = (await response.json()) as ErrorResponse;

    console.log(`\nTest: Rejects request with no or invalid token`);
    console.log(`Status: ${response.status()}`);
    console.log(JSON.stringify(body, null, 2));

    expect(response.status()).toBe(401);
    expect(body).toEqual(UNAUTHORIZED_ERROR);
  });
});
