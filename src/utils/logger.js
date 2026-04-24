const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

function log(level, message, data = {}) {
  if (LOG_LEVELS[level] > currentLevel) return;
  
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] ${level}: ${message}`;
  
  if (level === 'ERROR') {
    console.error(output, data);
  } else if (level === 'WARN') {
    console.warn(output, data);
  } else {
    console.log(output, data);
  }
}

function logRequest(req, res, duration) {
  const statusCode = res.statusCode;
  const method = req.method;
  const path = req.path;
  const user = req.user ? req.user.username : 'anonymous';
  
  log('INFO', `${method} ${path}`, {
    statusCode,
    user,
    duration: `${duration}ms`,
    ip: req.ip
  });
}

function logError(context, error) {
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log('ERROR', `${context}`, {
    errorId,
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  
  return errorId;
}

module.exports = { log, logRequest, logError, LOG_LEVELS };