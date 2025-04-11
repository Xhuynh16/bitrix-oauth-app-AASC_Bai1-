const bitrixApiService = require('../services/bitrixApiService');


exports.testApi = async (req, res) => {
  try {
    const { domain } = req.bitrix;
    const result = await bitrixApiService.callMethod(domain, 'user.current', {});
    
    res.json({
      success: true,
      message: 'API test successful',
      data: result
    });
  } catch (error) {
    console.error('Test API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 