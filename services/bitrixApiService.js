const axios = require('axios');
const tokenService = require('./tokenService');

/**
 * Make an API call to Bitrix24
 * @param {string} domain - Bitrix24 domain
 * @param {string} method - API method to call (e.g. 'crm.lead.get')
 * @param {Object} params - Parameters for the API call
 * @param {boolean} [isRetry=false] - Internal flag to prevent infinite retry loops
 * @returns {Promise<Object>} API response data
 */
exports.callMethod = async (domain, method, params = {}, isRetry = false) => {
  if (!domain) {
    throw new Error('Domain is required');
  }
  if (!method) {
    throw new Error('Method is required');
  }

  // Get tokens and check expiration
  let tokens = await tokenService.getTokens(domain);
  if (!tokens) {
    throw new Error('No tokens found for domain: ' + domain);
  }

  // Check if token is expired
  const isExpired = await tokenService.isTokenExpired(domain);
  if (isExpired && !isRetry) {
    tokens = await tokenService.refreshTokens(domain);
  }

  // Construct API endpoint
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
    // Handle specific API errors
    if (error.response) {
      const { data, status } = error.response;

      // Handle invalid token error
      if (
        (data.error === 'invalid_token' || status === 401) &&
        !isRetry
      ) {
        try {
          // Refresh token and retry the call
          tokens = await tokenService.refreshTokens(domain);
          return exports.callMethod(domain, method, params, true);
        } catch (refreshError) {
          throw new Error(`Token refresh failed: ${refreshError.message}`);
        }
      }

      // Handle rate limiting
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 1;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return exports.callMethod(domain, method, params, isRetry);
      }

      // Format API error message
      const errorMessage = data.error_description || data.error || 'Unknown API error';
      throw new Error(`Bitrix24 API error (${status}): ${errorMessage}`);
    }

    // Handle network or other errors
    throw new Error(`API call failed: ${error.message}`);
  }
};

/**
 * Batch multiple API calls into a single request
 * @param {string} domain - Bitrix24 domain
 * @param {Object[]} calls - Array of {method, params} objects
 * @returns {Promise<Object>} Batch operation results
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
