const axios = require('axios');
const tokenService = require('../services/tokenService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Handle Bitrix24 app installation event
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.installEvent = async (req, res) => {
  console.log('Install event received:', {
    body: req.body,
    headers: req.headers,
    query: req.query
  });

  try {
    const eventData = req.body.event ? req.body : JSON.parse(req.body);
    const storageDir = path.join(__dirname, '../storage');
    try {
      await fs.mkdir(storageDir, { recursive: true });
    } catch (err) {
      console.log('Storage dir exists or creation failed:', err.message);
    }

    if (!eventData || !eventData.event) {
      console.log('Missing event data');
      return res.status(400).json({
        success: false,
        error: 'MISSING_EVENT',
        message: 'Missing event data'
      });
    }

    if (eventData.event !== 'ONAPPINSTALL') {
      console.log('Invalid event type:', eventData.event);
      return res.status(400).json({
        success: false,
        error: 'INVALID_EVENT',
        message: 'Invalid event type'
      });
    }

    const { auth } = eventData;
    if (!auth || !auth.domain) {
      console.log('Missing auth data:', auth);
      return res.status(400).json({
        success: false,
        error: 'MISSING_AUTH',
        message: 'Missing authentication data'
      });
    }
    await tokenService.saveTokens(auth.domain, {
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      domain: auth.domain,
      expires_in: auth.expires_in || (auth.expires ? Math.floor((auth.expires - Date.now()/1000)) : 3600),
      member_id: auth.member_id,
      client_endpoint: auth.client_endpoint || `https://${auth.domain}/rest/`,
      application_token: auth.application_token,
      status: auth.status,
      scope: auth.scope
    });

    console.log('Installation successful for domain:', auth.domain);
    return res.status(200).json({
      success: true,
      message: 'Installation event processed successfully'
    });
  } catch (error) {
    console.error('Install event error:', error);
    return res.status(500).json({
      success: false,
      error: 'INSTALL_ERROR',
      message: 'Internal server error during installation',
      details: error.message
    });
  }
};

/**
 * Handle OAuth callback from Bitrix24
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
exports.authCallback = async (req, res) => {
  console.log('Auth callback received:', {
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers
  });

  try {
    const code = req.query.code || req.body.code;
    const domain = req.query.domain || req.body.domain;

    if (!code || !domain) {
      if (req.body.event === 'ONAPPINSTALL' && req.body.auth) {
        return exports.installEvent(req, res);
      }

      console.log('Missing parameters:', { code, domain });
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: 'Missing required parameters: code and domain'
      });
    }

    console.log('Requesting token from Bitrix24:', {
      code,
      domain,
      client_id: process.env.BITRIX_CLIENT_ID
    });

    const tokenResponse = await axios.post('https://oauth.bitrix.info/oauth/token/', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.BITRIX_CLIENT_ID,
        client_secret: process.env.BITRIX_CLIENT_SECRET,
        code
      }
    });

    console.log('Token response received:', tokenResponse.data);

    const tokens = tokenResponse.data;
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Invalid token response from Bitrix24');
    }

    await tokenService.saveTokens(domain, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      domain,
      expires_in: tokens.expires_in,
      member_id: tokens.member_id,
      client_endpoint: tokens.client_endpoint || `https://${domain}/rest/`
    });

    return res.status(200).json({
      success: true,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Auth callback error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Authentication failed',
      details: error.response?.data?.error_description || error.message
    });
  }
};