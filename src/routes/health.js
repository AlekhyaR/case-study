const { dbConnected, testConnection } = require('../config/database');
const { handleError } = require('../utils/error');
const { success } = require('../utils/response');

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

    const connected = await testConnection();
    res.json(success({ status: 'healthy', database: { connected } }));
  } catch (e) {
    handleError('/health', e, res);
  }
}

module.exports = healthCheck;
