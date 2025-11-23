import fs from 'fs';
import path from 'path';

// Use CommonJS-style __dirname
const TEST_DATA_FILE = path.resolve(__dirname, 'test-data.json');

// Default structure
const defaultData = {
  TEST_USER_EMAIL: 'innocentefeakpoyibo@gmail.com',
  FIXED_OTP_CODE: '675432',
  CLIENT_ID: '',
  CLIENT_SECRET: '',
  REDIRECT_URL: ''
};

// Ensure test-data.json exists
export function ensureTestDataFile(): void {
  if (!fs.existsSync(TEST_DATA_FILE)) {
    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

// Load entire data object
export function loadTestData(): typeof defaultData {
  ensureTestDataFile();
  return JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf-8'));
}

// Save entire data object
export function saveTestData(data: typeof defaultData): void {
  fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(data, null, 2));
}

// Save client credentials
export function saveClientCredentials(clientId: string, clientSecret: string): void {
  const data = loadTestData();
  data.CLIENT_ID = clientId;
  data.CLIENT_SECRET = clientSecret;
  saveTestData(data);
  console.log('Client credentials saved to test-data.json');
}

// Save redirect URL (from connect endpoint)
export function saveRedirectUrl(url: string): void {
  const data = loadTestData();
  data.REDIRECT_URL = url;
  saveTestData(data);
  console.log('Redirect URL saved to test-data.json');
}

// Load client credentials and redirect URL
export function loadClientCredentials() {
  const data = loadTestData();

  // Extract redirect token from redirect_url if present
  let redirectToken: string | null = null;
  if (data.REDIRECT_URL && data.REDIRECT_URL.includes('token=')) {
    const match = data.REDIRECT_URL.match(/token=([^&]+)/);
    if (match) redirectToken = match[1];
  }

  return {
    clientId: data.CLIENT_ID,
    clientSecret: data.CLIENT_SECRET,
    redirectUrl: data.REDIRECT_URL,
    redirectToken
  };
}

// Export constants for reuse
const { TEST_USER_EMAIL, FIXED_OTP_CODE } = loadTestData();
export { TEST_USER_EMAIL, FIXED_OTP_CODE };
