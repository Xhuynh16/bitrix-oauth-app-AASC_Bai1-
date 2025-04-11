const tokenService = require('../services/tokenService');

/**
 * Extract domain from request
 * @param {Object} req - Express request object
 * @returns {string|null} Domain or null if not found
 */
const extractDomain = (req) => {
  // Try to get domain from various places
  return (
    req.query.domain ||
    req.body.domain ||
    req.headers['x-bitrix-domain'] ||
    (req.get('referer') ? new URL(req.get('referer')).hostname : null)
  );
};

/**
 * Middleware to check and refresh Bitrix24 tokens
 * @param {Object} options - Middleware options
 * @param {boolean} options.requireToken - Whether to require token (default: true)
 * @param {boolean} options.autoRefresh - Whether to auto refresh expired tokens (default: true)
 */
exports.checkToken = (options = {}) => {
  const {
    requireToken = true,
    autoRefresh = true
  } = options;

  return async (req, res, next) => {
    try {
      const domain = extractDomain(req);

      // Check if domain is required and present
      if (!domain && requireToken) {
        return res.status(400).json({
          success: false,
          error: 'DOMAIN_REQUIRED',
          message: 'Bitrix24 domain is required'
        });
      }

      // If domain is not present and token is not required, continue
      if (!domain && !requireToken) {
        return next();
      }

      // Check if tokens exist for domain
      const tokens = await tokenService.getTokens(domain);
      if (!tokens && requireToken) {
        return res.status(401).json({
          success: false,
          error: 'NO_TOKEN',
          message: 'No authentication tokens found for domain',
          domain
        });
      }

      // Check token expiration
      const isExpired = await tokenService.isTokenExpired(domain);
      
      if (isExpired) {
        if (!autoRefresh) {
          return res.status(401).json({
            success: false,
            error: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
            domain
          });
        }

        try {
          // Attempt to refresh the token
          await tokenService.refreshTokens(domain);
        } catch (refreshError) {
          console.error(`Token refresh failed for domain ${domain}:`, refreshError);
          return res.status(401).json({
            success: false,
            error: 'REFRESH_FAILED',
            message: 'Failed to refresh authentication token',
            domain
          });
        }
      }

      // Add domain and tokens to request for use in route handlers
      req.bitrix = {
        domain,
        tokens: await tokenService.getTokens(domain)
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'AUTH_ERROR',
        message: 'Authentication check failed',
        details: error.message
      });
    }
  };
};
