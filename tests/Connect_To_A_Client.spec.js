const { test, expect } = require('@playwright/test');
const { faker } = require('@faker-js/faker');
const { TEST_USER_EMAIL, FIXED_OTP_CODE, saveRedirectUrl } = require('../test-data.js');

const API_BASE_URL = 'https://funmi-auth.smcdao.com';
const OTP_VERIFY_ENDPOINT = `${API_BASE_URL}/api/auth/verify`;
const CLIENT_CREATE_ENDPOINT = `${API_BASE_URL}/api/clients`;
const CLIENT_CONNECT_ENDPOINT = `${API_BASE_URL}/api/auth/connect`;

const HEADERS = {
  Accept: 'application/json',
};

let accessToken = '';
let createdClient = null;

// Helper to assert JSON response and log minimal output
async function expectJsonResponse(response) {
  const contentType = response.headers()['content-type'];
  expect(contentType).toContain('application/json');

  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
  console.log('Status Code:', response.status());
  return body;
}

async function acquireAccessToken(request) {
  const response = await request.post(OTP_VERIFY_ENDPOINT, {
    headers: HEADERS,
    data: {
      email: TEST_USER_EMAIL,
      code: FIXED_OTP_CODE,
    },
  });

  const body = await expectJsonResponse(response);

  expect(response.status()).toBe(200);
  expect(body.tokens).toHaveProperty('access_token');
  return body.tokens.access_token;
}

test.describe('Connect to a Client Endpoint Validation', () => {
  test.beforeAll(async ({ request }) => {
    accessToken = await acquireAccessToken(request);

    const clientResponse = await request.post(CLIENT_CREATE_ENDPOINT, {
      headers: {
        ...HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        name: faker.person.fullName(),
        redirect_uris: ['http://localhost:3000'],
        authorized_js_origins: [],
        permissions: ['profile:read'],
        description: 'Auth-Testing',
      },
    });

    const clientBody = await expectJsonResponse(clientResponse);

    expect(clientResponse.status()).toBe(201);
    createdClient = {
      id: clientBody.client.id,
      redirect_uri: clientBody.client.redirect_uris[0],
    };
  });

  test('Successfully connect to a valid client', async ({ request }) => {
    const payload = {
      client_id: createdClient.id,
      redirect_uri: createdClient.redirect_uri,
    };

    const response = await request.post(CLIENT_CONNECT_ENDPOINT, {
      headers: {
        ...HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: payload,
    });

    const body = await expectJsonResponse(response);

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('message', 'Client connected successfully');
    expect(body).toHaveProperty('redirect_uri');
    expect(body.redirect_uri).toContain(createdClient.id);

    if (body.redirect_uri) {
      saveRedirectUrl(body.redirect_uri);
    }
  });

  test('Fail when client_id is missing', async ({ request }) => {
    const payload = {
      redirect_uri: createdClient.redirect_uri,
    };

    const response = await request.post(CLIENT_CONNECT_ENDPOINT, {
      headers: {
        ...HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: payload,
    });

    const body = await expectJsonResponse(response);

    expect(response.status()).toBe(422);
    expect(body).toHaveProperty('error.client_id');
  });

  test('Fail when redirect_uri is missing', async ({ request }) => {
    const payload = {
      client_id: createdClient.id,
    };

    const response = await request.post(CLIENT_CONNECT_ENDPOINT, {
      headers: {
        ...HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: payload,
    });

    const body = await expectJsonResponse(response);

    expect(response.status()).toBe(422);
    expect(body).toHaveProperty('error.redirect_uri');
  });

  test('Fail when invalid client_id is provided', async ({ request }) => {
    const payload = {
      client_id: 'invalid-client-id',
      redirect_uri: createdClient.redirect_uri,
    };

    const response = await request.post(CLIENT_CONNECT_ENDPOINT, {
      headers: {
        ...HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: payload,
    });

    const body = await expectJsonResponse(response);

    expect(response.status()).toBe(404);
    expect(body).toHaveProperty('message');
  });

  test('Fail when redirect_uri is not allowed', async ({ request }) => {
    const payload = {
      client_id: createdClient.id,
      redirect_uri: 'http://invalid-redirect-url.com',
    };

    const response = await request.post(CLIENT_CONNECT_ENDPOINT, {
      headers: {
        ...HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      data: payload,
    });

    const body = await expectJsonResponse(response);

    expect(response.status()).toBe(403);
    expect(body).toEqual({
      message: 'Redirect URL not allowed',
    });
  });

  test('Fail when no authorization token is provided', async ({ request }) => {
    const payload = {
      client_id: createdClient.id,
      redirect_uri: createdClient.redirect_uri,
    };

    const response = await request.post(CLIENT_CONNECT_ENDPOINT, {
      headers: HEADERS,
      data: payload,
    });

    const body = await expectJsonResponse(response);

    expect(response.status()).toBe(401);
    expect(body).toEqual({
      message: 'You are not authenticated',
      reason: 'bad_token',
    });
  });

  test('Fail when invalid authorization token is provided', async ({ request }) => {
    const payload = {
      client_id: createdClient.id,
      redirect_uri: createdClient.redirect_uri,
    };

    const response = await request.post(CLIENT_CONNECT_ENDPOINT, {
      headers: {
        ...HEADERS,
        Authorization: 'Bearer invalid_token_123',
      },
      data: payload,
    });

    const body = await expectJsonResponse(response);

    expect(response.status()).toBe(401);
    expect(body).toEqual({
      message: 'You are not authenticated',
      reason: 'bad_token',
    });
  });
});
