const tokenService = require('../services/tokenService');

/**
 * Extract domain from request
 * @param {Object} req - Express request object
 * @returns {string|null} Domain or null if not found
 */
const extractDomain = (req) => {
  return (
    req.query.domain ||
    req.body.domain ||
    req.headers['x-bitrix-domain'] ||
    (req.get('referer') ? new URL(req.get('referer')).hostname : null)
  );
};

/**
 * Middleware to check and refresh Bitrix24 tokens
 * @param {Object} options 
 * @param {boolean} options.requireToken 
 * @param {boolean} options.autoRefresh 
 */
exports.checkToken = (options = {}) => {
  const {
    requireToken = true,
    autoRefresh = true
  } = options;

  return async (req, res, next) => {
    try {
      const domain = extractDomain(req);

      if (!domain && requireToken) {
        return res.status(400).json({
          success: false,
          error: 'DOMAIN_REQUIRED',
          message: 'Bitrix24 domain is required'
        });
      }

      if (!domain && !requireToken) {
        return next();
      }

      const tokens = await tokenService.getTokens(domain);
      if (!tokens && requireToken) {
        return res.status(401).json({
          success: false,
          error: 'NO_TOKEN',
          message: 'No authentication tokens found for domain',
          domain
        });
      }
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
