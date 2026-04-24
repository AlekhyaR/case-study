// src/routes/health.js
const { dbConnected, testConnection } = require('../config/database');
const { handleError } = require('../utils/error');

async function healthCheck(req, res) {
  try {
    if (!dbConnected()) {
      return res.status(503).json({
        ok: false,
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await testConnection();
    
    res.status(200).json({
      ok: true,
      data: {
        status: 'healthy',
        database: { connected: result }
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/health', e, res);
  }
}

module.exports = healthCheck;