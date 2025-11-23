// import { test, expect, APIRequestContext } from '@playwright/test';
// import {
//   TEST_USER_EMAIL,
//   FIXED_OTP_CODE,
//   saveRedirectUrl,
//   loadClientCredentials,
// } from '../test-data';

// const BASE_URL = 'https://funmi-auth.smcdao.com';

// // Endpoints
// const VERIFY_OTP_ENDPOINT = `${BASE_URL}/api/auth/verify`;
// const CONNECT_CLIENT_ENDPOINT = `${BASE_URL}/api/client/auth/connect`;
// const EXCHANGE_TOKEN_ENDPOINT = `${BASE_URL}/api/client/auth/exchange-token`;

// const COMMON_HEADERS = {
//   Accept: 'application/json',
//   'Content-Type': 'application/json',
// };

// // ---------- TYPES ---------- //
// interface VerifyOtpResponse {
//   tokens: {
//     access_token: string;
//     refresh_token?: string;
//   };
// }

// interface ConnectClientResponse {
//   message: string;
//   redirect_uri: string;
// }

// interface ExchangeTokenResponse {
//   message: string;
//   tokens: {
//     access_token: string;
//     refresh_token: string;
//   };
//   user: {
//     id: string;
//     [key: string]: any;
//   };
// }

// interface ErrorResponse {
//   message?: string;
//   error?: Record<string, any>;
// }

// // --------------------------- //

// let accessToken: string;
// let clientId: string;
// let clientSecret: string;
// let redirectUrl: string;
// let redirectToken: string;

// test.describe('Exchange Redirect Token for User Token API', () => {
//   // STEP 1: Verify OTP & load client credentials
//   test.beforeAll(async ({ request }) => {
//     console.log('\nSTEP 1: Verifying OTP...');

//     const response = await request.post(VERIFY_OTP_ENDPOINT, {
//       headers: COMMON_HEADERS,
//       data: {
//         email: TEST_USER_EMAIL,
//         code: FIXED_OTP_CODE,
//       },
//     });

//     const body: VerifyOtpResponse = await response.json();
//     console.log('Verify OTP Response:', JSON.stringify(body, null, 2));
//     console.log('Status Code:', response.status());

//     expect(response.status()).toBe(200);
//     expect(body.tokens.access_token).toBeDefined();

//     accessToken = body.tokens.access_token;

//     // Load saved credentials
//     const creds = loadClientCredentials();
//     clientId = creds.clientId;
//     clientSecret = creds.clientSecret;
//     redirectUrl = creds.redirectUrl;
//   });

//   // STEP 2: Acquire fresh redirect token
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

//       const body: ConnectClientResponse = await response.json();
//       console.log('Connect Client Response:', JSON.stringify(body, null, 2));
//       console.log('Status Code:', response.status());

//       expect(response.status()).toBe(200);
//       expect(body.redirect_uri).toBeDefined();

//       redirectUrl = body.redirect_uri;
//       saveRedirectUrl(redirectUrl);

//       const match = redirectUrl.match(/token=([^&]+)/);
//       if (!match) throw new Error('No token found in redirect_uri');

//       redirectToken = match[1];
//       console.log(`Extracted redirect token: ${redirectToken}`);
//     };

//     // Try to reuse saved token
//     if (redirectUrl?.includes('token=')) {
//       console.log('\nUsing saved redirect URL from test-data.json...');

//       const match = redirectUrl.match(/token=([^&]+)/);
//       if (match) {
//         redirectToken = match[1];
//         console.log(`Extracted redirect token: ${redirectToken}`);

//         // Verify if valid
//         const verifyResponse = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//           headers: {
//             ...COMMON_HEADERS,
//             Authorization: `Bearer ${accessToken}`,
//             'X-Auth-Token': `${clientId}:${clientSecret}`,
//           },
//           data: { token: redirectToken },
//         });

//         if (verifyResponse.status() === 401) {
//           console.log('Saved token expired — requesting new one...');
//           await getFreshRedirect();
//         }
//         return;
//       }
//     }

//     await getFreshRedirect();
//   });

//   // STEP 3: Successful exchange
//   test('Should exchange redirect token for user tokens successfully', async ({ request }) => {
//     console.log('\nSTEP 3: Exchanging redirect token...');

//     const response = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//       headers: {
//         ...COMMON_HEADERS,
//         Authorization: `Bearer ${accessToken}`,
//         'X-Auth-Token': `${clientId}:${clientSecret}`,
//       },
//       data: { token: redirectToken },
//     });

//     const body: ExchangeTokenResponse = await response.json();
//     console.log('Exchange Token Response:', JSON.stringify(body, null, 2));

//     expect(response.status()).toBe(200);
//     expect(body.message).toBe('User token created successfully');
//     expect(body.tokens.access_token).toBeDefined();
//     expect(body.tokens.refresh_token).toBeDefined();
//     expect(body.user.id).toBeDefined();
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

//     const body: ErrorResponse = await response.json();
//     console.log(JSON.stringify(body, null, 2));

//     expect(response.status()).toBe(401);
//     expect(body.message).toBe('The token is invalid or expired');
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

//     const body: ErrorResponse = await response.json();
//     console.log(JSON.stringify(body, null, 2));

//     expect(response.status()).toBe(401);
//     expect(body.message).toBe('The token is invalid or expired');
//   });

//   // STEP 6: Missing token
//   test('Should return 422 when token is missing in request body', async ({ request }) => {
//     console.log('\nSTEP 6: Missing token body...');

//     const response = await request.post(EXCHANGE_TOKEN_ENDPOINT, {
//       headers: {
//         ...COMMON_HEADERS,
//         Authorization: `Bearer ${accessToken}`,
//         'X-Auth-Token': `${clientId}:${clientSecret}`,
//       },
//       data: {},
//     });

//     const body: ErrorResponse = await response.json();
//     console.log(JSON.stringify(body, null, 2));

//     expect(response.status()).toBe(422);
//     expect(body.error?.token).toBeDefined();
//   });
// });
