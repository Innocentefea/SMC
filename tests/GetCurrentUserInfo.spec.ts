import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';
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

// Typings
interface TokensResponse {
  access_token: string;
  refresh_token: string;
}

interface OTPVerifyResponse {
  message: string;
  tokens: TokensResponse;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  kyc_verified: boolean;
  created_at: string;
}

interface UserInfoResponse {
  user: User;
}

interface ErrorResponse {
  message: string;
  reason: string;
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

test.describe('Get Current User Info API', () => {
  //  Verify OTP and get access token
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

  // Successfully fetch current user info
  test('Should fetch current user info successfully', async ({ request }) => {
    const response = await request.get(GET_USER_INFO_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await expectJsonResponse<UserInfoResponse>(response);

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('user');

    const user = body.user;
    expect(user).toMatchObject({
      email: TEST_USER_EMAIL,
    });

    expect(typeof user.id).toBe('string');
    expect(typeof user.first_name).toBe('string');
    expect(typeof user.last_name).toBe('string');
    expect(typeof user.role).toBe('string');
    expect(typeof user.username).toBe('string');
    expect(typeof user.kyc_verified).toBe('boolean');
    expect(typeof user.created_at).toBe('string');
  });

  // Missing Authorization Header
  test('Should return 401 when Authorization header is missing', async ({ request }) => {
    const response = await request.get(GET_USER_INFO_ENDPOINT, {
      headers: {
        Accept: 'application/json',
      },
    });

    const body = await expectJsonResponse<ErrorResponse>(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toMatchObject({
      message: 'You are not authenticated',
      reason: 'bad_token',
    });
  });

  //  Invalid Token
  test('Should return 401 when using invalid token', async ({ request }) => {
    const response = await request.get(GET_USER_INFO_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer invalid_token_123',
      },
    });

    const body = await expectJsonResponse<ErrorResponse>(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toMatchObject({
      message: 'You are not authenticated',
      reason: 'bad_token',
    });
  });

  // Expired Token
  test('Should return 401 when using expired token', async ({ request }) => {
    const response = await request.get(GET_USER_INFO_ENDPOINT, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer expired_token_example_123',
      },
    });

    const body = await expectJsonResponse<ErrorResponse>(response, ['message', 'reason']);
    expect(response.status()).toBe(401);
    expect(body).toMatchObject({
      message: 'You are not authenticated',
      reason: 'bad_token',
    });
  });
});
