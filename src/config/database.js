const { Pool } = require('pg');
const { log } = require('../utils/logger');

let dbConnected = false;

const client = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

client.on('error', (err) => {
  log('ERROR', 'Unexpected database error', { message: err.message });
  process.exit(-1);
});

async function testConnection() {
  try {
    const result = await client.query('SELECT NOW()');
    dbConnected = true;
    log('INFO', 'Database connection successful');
    return true;
  } catch (err) {
    dbConnected = false;
    log('ERROR', 'Database connection failed', { message: err.message });
    return false;
  }
}

async function gracefulShutdown(server) {
  return new Promise((resolve) => {
    log('INFO', 'Starting graceful shutdown');
    
    server.close(async () => {
      log('INFO', 'HTTP server closed');
      
      try {
        await client.end();
        log('INFO', 'Database connection closed');
      } catch (err) {
        log('ERROR', 'Error closing database', { message: err.message });
      }
      
      resolve();
    });
    
    setTimeout(() => {
      log('WARN', 'Forced shutdown after 10 second timeout');
      process.exit(1);
    }, 10000);
  });
}

module.exports = {
  client,
  dbConnected: () => dbConnected,
  testConnection,
  gracefulShutdown
};