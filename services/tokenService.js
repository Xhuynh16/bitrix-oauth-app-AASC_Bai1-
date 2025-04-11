const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');

const STORAGE_DIR = path.join(__dirname, '../storage');
const TOKENS_FILE = path.join(STORAGE_DIR, 'tokens.json');


const ensureStorageDir = () => {
  if (!fsSync.existsSync(STORAGE_DIR)) {
    fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
  }
};

/**
 * Read tokens from file
 * @returns {Promise<Object>} Tokens object
 */
const readTokens = async () => {
  try {
    ensureStorageDir();
    if (!fsSync.existsSync(TOKENS_FILE)) {
      await fs.writeFile(TOKENS_FILE, '{}');
      return {};
    }
    const data = await fs.readFile(TOKENS_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error reading tokens file:', error);
    return {};
  }
};

/**
 * Write tokens to file
 * @param {Object} data - Tokens data to write
 */
const writeTokens = async (data) => {
  try {
    ensureStorageDir();
    await fs.writeFile(TOKENS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing tokens file:', error);
    throw new Error('Failed to save tokens');
  }
};

/**
 * Save tokens for a domain
 * @param {string} domain - Bitrix24 domain
 * @param {Object} tokenData - Token data to save
 */
exports.saveTokens = async (domain, tokenData) => {
  if (!domain || !tokenData) {
    throw new Error('Domain and token data are required');
  }

  const tokens = await readTokens();
  tokens[domain] = {
    ...tokenData,
    savedAt: Date.now()
  };
  await writeTokens(tokens);
};

/**
 * Get tokens for a domain
 * @param {string} domain - Bitrix24 domain
 * @returns {Promise<Object|null>} Token data or null if not found
 */
exports.getTokens = async (domain) => {
  if (!domain) {
    throw new Error('Domain is required');
  }

  const tokens = await readTokens();
  return tokens[domain] || null;
};

/**
 * Check if token is expired for a domain
 * @param {string} domain - Bitrix24 domain
 * @returns {Promise<boolean>} True if token is expired or not found
 */
exports.isTokenExpired = async (domain) => {
  try {
    const tokens = await exports.getTokens(domain);
    if (!tokens || !tokens.savedAt || !tokens.expires_in) {
      return true;
    }

    const expiryTime = tokens.savedAt + (tokens.expires_in * 1000);
    // Consider token expired 5 minutes before actual expiry
    return Date.now() > (expiryTime - 5 * 60 * 1000);
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

/**
 * Refresh tokens for a domain
 * @param {string} domain - Bitrix24 domain
 * @returns {Promise<Object>} New token data
 */
exports.refreshTokens = async (domain) => {
  const tokens = await exports.getTokens(domain);
  if (!tokens || !tokens.refresh_token) {
    throw new Error('No refresh token available for domain: ' + domain);
  }

  try {
    const response = await axios.post('https://oauth.bitrix.info/oauth/token/', null, {
      params: {
        grant_type: 'refresh_token',
        client_id: process.env.BITRIX_CLIENT_ID,
        client_secret: process.env.BITRIX_CLIENT_SECRET,
        refresh_token: tokens.refresh_token
      }
    });

    const newTokens = {
      ...response.data,
      domain,
      savedAt: Date.now()
    };

    await exports.saveTokens(domain, newTokens);
    return newTokens;
  } catch (error) {
    console.error('Error refreshing tokens:', error.response?.data || error.message);
    throw new Error('Failed to refresh tokens for domain: ' + domain);
  }
};
