const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @route POST /auth/install-event
 * @desc Handle Bitrix24 app installation event
 */
router.post('/install-event', authController.installEvent);

/**
 * @route GET /auth/auth
 * @desc Handle OAuth callback from Bitrix24
 */
router.get('/auth', authController.authCallback);

/**
 * @route POST /auth/auth
 * @desc Alternative endpoint for auth that accepts POST
 */
router.post('/auth', authController.authCallback);

module.exports = router; 