// import { test, expect } from '@playwright/test';
// import {
//   TEST_USER_EMAIL,
//   FIXED_OTP_CODE,
//   saveRedirectUrl,
//   loadClientCredentials,
// } from '../test-data.js';

// const BASE_URL = 'https://funmi-auth.smcdao.com';

// // Endpoints
// const VERIFY_OTP_ENDPOINT = `${BASE_URL}/api/auth/verify`;
// const CONNECT_CLIENT_ENDPOINT = `${BASE_URL}/api/client/auth/connect`;
// const EXCHANGE_TOKEN_ENDPOINT = `${BASE_URL}/api/client/auth/exchange-token`;

// const COMMON_HEADERS = {
//   Accept: 'application/json',
//   'Content-Type': 'application/json',
// };

// let accessToken;
// let clientId;
// let clientSecret;
// let redirectUrl;
// let redirectToken;

// test.describe('Exchange Redirect Token for User Token API', () => {
//   // STEP 1: Verify OTP
//   test.beforeAll(async ({ request }) => {
//     console.log('\nSTEP 1: Verifying OTP...');
//     const response = await request.post(VERIFY_OTP_ENDPOINT, {
//       headers: COMMON_HEADERS,
//       data: {
//         email: TEST_USER_EMAIL,
//         code: FIXED_OTP_CODE,
//       },
//     });

//     const body = await response.json();
//     console.log('Verify OTP Response:', JSON.stringify(body, null, 2));
//     console.log('Status Code:', response.status());

//     expect(response.status()).toBe(200);
//     expect(body.tokens).toHaveProperty('access_token');

//     accessToken = body.tokens.access_token;

//     // Load client credentials and redirect URL
//     const creds = loadClientCredentials();
//     clientId = creds.clientId;
//     clientSecret = creds.clientSecret;
//     redirectUrl = creds.redirectUrl;
//   });

//   // STEP 2: Acquire valid redirect token
//   test.beforeAll(async ({ request }) => {
//     const getFreshRedirect = async () => {
//       console.log('\nSTEP 2: Requesting fresh redirect URL...');
//       const response = await request.post(CONNECT_CLIENT_ENDPOINT, {
//         headers: {
//           ...COMMON_HEADERS,
//           Authorization: `Bearer ${accessToken}`,
//         },
//         data: {
//           client_id: clientId,
//           redirect_uri: 'http://localhost:3000',
//         },
//       });

//       const body = await response.json();
//       console.log('Connect Client Response:', JSON.stringify(body, null, 2));
//       console.log('Status Code:', response.status());

//       expect(response.status()).toBe(200);
//       expect(body).toHaveProperty('redirect_uri');

//       redirectUrl = body.redirect_uri;
//       saveRedirectUrl(redirectUrl);
//       console.log(`Redirect URL saved: ${redirectUrl}`);

//       const match = redirectUrl.match(/token=([^&]+)/);
//       if (!match) throw new Error('No token found in redirect_uri');
//       redirectToken = match[1];
//       console.log(`Extracted redirect token: ${redirectToken}`);
//     };

//     if (redirectUrl && redirectUrl.includes('token=')) {
//       console.log('\nUsing saved redirect URL from test-data.json...');
//       const match = redirectUrl.match(/token=([^&]+)/);
//       if (match) {
//         redirectToken = match[1];
//         console.log(`Extracted redirect token: ${redirectToken}`);

//         // Verify if it's valid
//         const verifyResponse = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//           headers: {
//             ...COMMON_HEADERS,
//             Authorization: `Bearer ${accessToken}`,
//             'X-Auth-Token': `${clientId}:${clientSecret}`,
//           },
//           data: { token: redirectToken },
//         });

//         if (verifyResponse.status() === 401) {
//           console.log('Saved token is invalid/expired — requesting new one...');
//           await getFreshRedirect();
//         }
//         return;
//       }
//     }

//     // No saved redirect URL or invalid format
//     await getFreshRedirect();
//   });

//   // STEP 3: Exchange redirect token for user tokens
//   test('Should exchange redirect token for user tokens successfully', async ({ request }) => {
//     console.log('\nSTEP 3: Exchanging redirect token for user tokens...');

//     const response = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//       headers: {
//         ...COMMON_HEADERS,
//         Authorization: `Bearer ${accessToken}`,
//         'X-Auth-Token': `${clientId}:${clientSecret}`,
//       },
//       data: { token: redirectToken },
//     });

//     const body = await response.json();
//     console.log('Exchange Token Response:', JSON.stringify(body, null, 2));
//     console.log('Status Code:', response.status());

//     expect(response.status()).toBe(200);
//     expect(body).toHaveProperty('message', 'User token created successfully');
//     expect(body.tokens).toHaveProperty('access_token');
//     expect(body.tokens).toHaveProperty('refresh_token');
//     expect(body.user).toHaveProperty('id');
//   });

//   // STEP 4: Invalid redirect token
//   test('Should return 401 for invalid redirect token', async ({ request }) => {
//     console.log('\nSTEP 4: Testing invalid redirect token...');
//     const response = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//       headers: {
//         ...COMMON_HEADERS,
//         Authorization: `Bearer ${accessToken}`,
//         'X-Auth-Token': `${clientId}:${clientSecret}`,
//       },
//       data: { token: 'invalid_token_123' },
//     });

//     const body = await response.json();
//     console.log('Invalid Redirect Token Response:', JSON.stringify(body, null, 2));
//     console.log('Status Code:', response.status());

//     expect(response.status()).toBe(401);
//     expect(body).toHaveProperty('message', 'The token is invalid or expired');
//   });

//   // STEP 5: Expired redirect token
//   test('Should return 401 for expired redirect token', async ({ request }) => {
//     console.log('\nSTEP 5: Testing expired redirect token...');
//     const response = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//       headers: {
//         ...COMMON_HEADERS,
//         Authorization: `Bearer ${accessToken}`,
//         'X-Auth-Token': `${clientId}:${clientSecret}`,
//       },
//       data: { token: 'expired_token_123' },
//     });

//     const body = await response.json();
//     console.log('Expired Redirect Token Response:', JSON.stringify(body, null, 2));
//     console.log('Status Code:', response.status());

//     expect(response.status()).toBe(401);
//     expect(body).toHaveProperty('message', 'The token is invalid or expired');
//   });

//   // STEP 6: Missing token in request body
//   test('Should return 422 when token is missing in request body', async ({ request }) => {
//     console.log('\nSTEP 6: Testing missing token in request body...');
//     const response = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//       headers: {
//         ...COMMON_HEADERS,
//         Authorization: `Bearer ${accessToken}`,
//         'X-Auth-Token': `${clientId}:${clientSecret}`,
//       },
//       data: {},
//     });

//     const body = await response.json();
//     console.log('Missing Token Response:', JSON.stringify(body, null, 2));
//     console.log('Status Code:', response.status());

//     expect(response.status()).toBe(422);
//     expect(body.error).toHaveProperty('token');
//   });
// });