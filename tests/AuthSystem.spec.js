import { test, request } from '@playwright/test';
import testdata from '../test-data.js';

import { requestOtp } from './RequestOtp.spec.js';
import { verifyOtp } from './VerifyOTP.spec.js';
import { updateUserInfo } from './SMC-QA-Testscripts/UpdateUserInfo.spec.js';
import { createClient } from './CreatNewClient.spec.js';
import { connectToClient } from './Connect_To_A_Client.spec.js';
import { getCurrentUser } from './GetCurrentUserInfo.spec.js';
import { listClients } from './ListAllClients.spec.js';

test('Complete API flow using modular steps', async () => {
  const apiContext = await request.newContext({ baseURL: 'https://funmi-auth.smcdao.com' });

  // Step 1: Request OTP
  await requestOtp(apiContext, testdata.email);

  // Step 2: Verify OTP → get token
  const token = await verifyOtp(apiContext, testdata.email, testdata.otpCode);

  // Auth headers for next steps
  const headers = { Authorization: `Bearer ${token}` };

  // Step 3: Update user info
  await updateUserInfo(apiContext, headers);

  // Step 4: Create new client → get clientId
  const clientId = await createClient(apiContext, headers);

  // Step 5: Connect to client
  await connectToClient(apiContext, headers, clientId);

  // Step 6: Get current user
  await getCurrentUser(apiContext, headers);

  // Step 7: List all clients
  await listClients(apiContext, headers);
});
