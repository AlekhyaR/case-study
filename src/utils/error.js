const { logError } = require('./logger');

function classifyDatabaseError(err) {
  const message = err.message?.toLowerCase() || '';
  const code = err.code;
  
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || 
      message.includes('could not connect')) {
    return { status: 503, type: 'CONNECTION' };
  }
  
  if (message.includes('timeout') || code === 'QUERY_TIMEOUT') {
    return { status: 504, type: 'TIMEOUT' };
  }
  
  if (message.includes('permission denied') || code === '42501') {
    return { status: 403, type: 'PERMISSION' };
  }
  
  if (message.includes('does not exist') || code === '42P01') {
    return { status: 400, type: 'NOT_FOUND' };
  }
  
  if (message.includes('duplicate') || code === '23505') {
    return { status: 409, type: 'CONFLICT' };
  }
  
  return { status: 500, type: 'UNKNOWN' };
}

function sanitizeErrorMessage(err, errorType) {
  const genericMessages = {
    'CONNECTION': 'Database is currently unavailable. Please try again later.',
    'TIMEOUT': 'Request took too long. Please try again.',
    'PERMISSION': 'You do not have permission to perform this action.',
    'NOT_FOUND': 'The requested resource was not found.',
    'CONFLICT': 'The resource already exists.',
    'UNKNOWN': 'An error occurred. Please try again.'
  };
  
  return genericMessages[errorType] || genericMessages['UNKNOWN'];
}

function handleError(context, err, res) {
  const { status, type } = classifyDatabaseError(err);
  const errorId = logError(context, err);
  const safeMessage = sanitizeErrorMessage(err, type);
  
  res.status(status).json({
    ok: false,
    error: safeMessage,
    type: type,
    errorId: errorId,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  classifyDatabaseError,
  sanitizeErrorMessage,
  handleError
};