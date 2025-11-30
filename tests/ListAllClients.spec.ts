import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';
import { TEST_USER_EMAIL, FIXED_OTP_CODE } from '../test-data.js';

const BASE_URL = 'https://funmi-auth.smcdao.com';
const VERIFY_OTP_ENDPOINT = `${BASE_URL}/api/auth/verify`;
const LIST_CLIENTS_ENDPOINT = `${BASE_URL}/api/clients`;

const COMMON_HEADERS = {
  Accept: 'application/json',
};

// Typings for API responses
interface TokensResponse {
  access_token: string;
  refresh_token: string;
}

interface OTPVerifyResponse {
  message: string;
  tokens: TokensResponse;
}

interface Client {
  id: string;
  name: string;
  description: string;
  redirect_uris: string[];
  permissions: string[];
  is_active: boolean;
  created_at: string;
}

interface ListClientsResponse {
  clients: Client[];
}

interface ErrorResponse {
  message: string;
  reason?: string;
}

let accessToken: string;

async function expectJsonResponse<T = any>(
  response: APIResponse,
  fieldsToLog: (keyof T)[] = []
): Promise<T> {
  const contentType = response.headers()['content-type'];
  expect(contentType).toContain('application/json');

  const body: T = await response.json();

  const safeBody = fieldsToLog.length
    ? fieldsToLog.reduce((obj: Partial<T>, key) => {
        if (key in body) obj[key] = body[key];
        return obj;
      }, {})
    : body;

  console.log(JSON.stringify(safeBody, null, 2));
  console.log('Status Code:', response.status());

  return body;
}

test.describe('List All Clients API', () => {
  // Verify OTP to get access token
  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    const response = await request.post(VERIFY_OTP_ENDPOINT, {
      headers: COMMON_HEADERS,
      data: {
        email: TEST_USER_EMAIL,
        code: FIXED_OTP_CODE,
      },
    });

    const body = await expectJsonResponse<OTPVerifyResponse>(response);

    expect(response.status()).toBe(200);
    expect(body.tokens).toHaveProperty('access_token');

    accessToken = body.tokens.access_token;
  });

  // List all clients successfully
  test('Should list all clients successfully', async ({ request }) => {
    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await expectJsonResponse<ListClientsResponse>(response);

    expect(response.status()).toBe(200);
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

  //  Missing Authorization Header
  test('Should return 401 when Authorization header is missing', async ({ request }) => {
    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: { Accept: 'application/json' },
    });

    const body = await expectJsonResponse<ErrorResponse>(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toMatchObject({
      message: 'You are not authenticated',
    });
  });

  //  Invalid Bearer Token
  test('Should return 401 for invalid bearer token', async ({ request }) => {
    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer invalid_token_12345',
      },
    });

    const body = await expectJsonResponse<ErrorResponse>(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toMatchObject({
      message: 'You are not authenticated',
      reason: 'bad_token',
    });
  });

  //  Expired Bearer Token
  test('Should return 401 for expired bearer token', async ({ request }) => {
    const expiredToken = accessToken.slice(0, -5) + 'abcde';
    const response = await request.get(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    const body = await expectJsonResponse<ErrorResponse>(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toMatchObject({
      message: 'You are not authenticated',
      reason: 'bad_token',
    });
  });

  /*
  // Wrong HTTP Method
  test('Should return 405 for wrong HTTP method (POST instead of GET)', async ({ request }) => {
    const response = await request.post(LIST_CLIENTS_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await expectJsonResponse<ErrorResponse>(response, ['message']);
    expect(response.status()).toBe(405);
    expect(body).toHaveProperty('message');

    const allowHeader = response.headers()['allow'];
    if (allowHeader) {
      console.log('Allow header:', allowHeader);
      expect(allowHeader).toContain('GET');
    }
  });
  */
});
