const express = require('express');
const router = express.Router();
const { checkToken } = require('../middleware/authMiddleware');
const bitrixApiService = require('../services/bitrixApiService');
const tokenService = require('../services/tokenService');
const fs = require('fs').promises;
const path = require('path');

router.use(checkToken());

/**
 * @route GET /api/health
 * @desc Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route POST /api/test/user
 * @desc Test endpoint to get current user info
 */
router.get('/test/user', async (req, res) => {
  try {
    const { domain } = req.bitrix;
    const result = await bitrixApiService.callMethod(domain, 'user.current');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('API call error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/test/contacts
 * @desc Test endpoint to get contacts list
 */
router.get('/test/contacts', async (req, res) => {
  try {
    const { domain } = req.bitrix;
    const result = await bitrixApiService.callMethod(domain, 'crm.contact.list', {
      select: ['ID', 'NAME', 'LAST_NAME', 'EMAIL', 'PHONE']
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('API call error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/test/leads
 * @desc Test endpoint to get leads list
 */
router.get('/test/leads', async (req, res) => {
  try {
    const { domain } = req.bitrix;
    const result = await bitrixApiService.callMethod(domain, 'crm.lead.list', {
      select: ['ID', 'TITLE', 'NAME', 'PHONE', 'EMAIL']
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('API call error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/test/token-refresh
 * @desc Test endpoint to simulate token expiration and refresh
 */
router.post('/test/token-refresh', async (req, res) => {
  try {
    const { domain } = req.bitrix;
    
    const tokens = await tokenService.getTokens(domain);
    if (!tokens) {
      throw new Error('No tokens found');
    }
    const tokensPath = path.join(__dirname, '../storage/tokens.json');
    const allTokens = JSON.parse(await fs.readFile(tokensPath, 'utf8'));
    allTokens[domain].savedAt = Date.now() - (tokens.expires_in * 1000) - 1000;
    await fs.writeFile(tokensPath, JSON.stringify(allTokens, null, 2));
    console.log('Token expiration forced, testing API call...');
    const result = await bitrixApiService.callMethod(domain, 'user.current');
    const newTokens = await tokenService.getTokens(domain);

    res.json({
      success: true,
      message: 'Token refresh test completed',
      oldToken: tokens.access_token,
      newToken: newTokens.access_token,
      apiCallResult: result
    });
  } catch (error) {
    console.error('Token refresh test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/:method
 * @desc Generic endpoint to call any Bitrix24 API method
 */
router.post('/:method', async (req, res) => {
  try {
    const { method } = req.params;
    const { domain } = req.bitrix;
    const params = req.body;

    console.log('Calling Bitrix24 API:', {
      method,
      domain,
      params
    });

    const result = await bitrixApiService.callMethod(domain, method, params);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('API call error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
