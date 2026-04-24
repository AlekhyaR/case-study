// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { generateToken } = require('../utils/jwt');
const { log } = require('../utils/logger');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'username is required',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      ok: false,
      error: 'password must be at least 6 characters',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const token = generateToken({
      username: username.trim(),
      iat: Date.now()
    });
    
    log('INFO', 'User login successful', { username: username.trim() });
    
    res.json({
      ok: true,
      data: {
        token,
        expiresIn: '24h'
      },
      timestamp: new Date().toISOString()
    });
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