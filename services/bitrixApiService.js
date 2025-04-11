const axios = require('axios');
const tokenService = require('./tokenService');

/**
 * Make an API call to Bitrix24
 * @param {string} domain 
 * @param {string} method 
 * @param {Object} params 
 * @param {boolean} [isRetry=false] 
 * @returns {Promise<Object>} 
 */
exports.callMethod = async (domain, method, params = {}, isRetry = false) => {
  if (!domain) {
    throw new Error('Domain is required');
  }
  if (!method) {
    throw new Error('Method is required');
  }

  let tokens = await tokenService.getTokens(domain);
  if (!tokens) {
    throw new Error('No tokens found for domain: ' + domain);
  }

  const isExpired = await tokenService.isTokenExpired(domain);
  if (isExpired && !isRetry) {
    tokens = await tokenService.refreshTokens(domain);
  }

  const endpoint = tokens.client_endpoint || `https://${domain}/rest/`;

  try {
    const response = await axios({
      method: 'POST',
      url: `${endpoint}${method}`,
      data: params,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      const { data, status } = error.response;
      if (
        (data.error === 'invalid_token' || status === 401) &&
        !isRetry
      ) {
        try {
          tokens = await tokenService.refreshTokens(domain);
          return exports.callMethod(domain, method, params, true);
        } catch (refreshError) {
          throw new Error(`Token refresh failed: ${refreshError.message}`);
        }
      }
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 1;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return exports.callMethod(domain, method, params, isRetry);
      }
      const errorMessage = data.error_description || data.error || 'Unknown API error';
      throw new Error(`Bitrix24 API error (${status}): ${errorMessage}`);
    }

    throw new Error(`API call failed: ${error.message}`);
  }
};

/**
 * Batch multiple API calls into a single request
 * @param {string} domain 
 * @param {Object[]} calls 
 * @returns {Promise<Object>} 
 */
exports.batchMethods = async (domain, calls) => {
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error('Calls must be a non-empty array');
  }

  const batchParams = calls.reduce((acc, call, index) => {
    acc[`cmd[${index}]`] = `${call.method}?${new URLSearchParams(call.params)}`;
    return acc;
  }, {});

  return exports.callMethod(domain, 'batch', batchParams);
};
