const { logRequest } = require('../utils/logger');

function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    logRequest(req, res, duration);
    originalEnd.apply(res, args);
  };
  
  next();
}

module.exports = { requestLoggerMiddleware };