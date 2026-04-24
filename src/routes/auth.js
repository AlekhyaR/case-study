const express = require('express');
const router = express.Router();
const { generateToken } = require('../utils/jwt');
const { log } = require('../utils/logger');
const { success } = require('../utils/response');
const { validateBody } = require('../validation/validate');
const { LoginBodySchema } = require('../validation/schemas');

router.post('/login', validateBody(LoginBodySchema), (req, res) => {
  try {
    const token = generateToken({ username: req.body.username, iat: Date.now() });
    log('INFO', 'User login successful', { username: req.body.username });
    res.json(success({ token, expiresIn: '24h' }));
  } catch (e) {
    log('ERROR', 'Login failed', { error: e.message });
    res.status(500).json({
      ok: false,
      error: 'Authentication failed',
      type: 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
