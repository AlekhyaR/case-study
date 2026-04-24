const { log } = require('./logger');

async function queryWithRetry(queryFn, maxAttempts = 3, delayMs = 100) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await queryFn();
    } catch (err) {
      const isTransient = err.message?.includes('timeout') || 
                         err.code === 'ECONNREFUSED' ||
                         err.code === 'ENOTFOUND';
      
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      log('WARN', `Query retry attempt ${attempt}/${maxAttempts}`, {
        waitTime,
        error: err.message
      });
      
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

module.exports = { queryWithRetry };