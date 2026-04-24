// src/index.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Validate environment
const { validateRequiredEnvironment } = require('./config/environment');
validateRequiredEnvironment();

const express = require('express');
const http = require('http');
const { testConnection, gracefulShutdown } = require('./config/database');
const { requestLoggerMiddleware } = require('./middleware/requestLogger');
const { log } = require('./utils/logger');

// Routes
const authRoutes = require('./routes/auth');
const templateRoutes = require('./routes/template');
const categoryRoutes = require('./routes/categories');
const healthCheck = require('./routes/health');

// API docs
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger');

// Setup express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLoggerMiddleware);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Register routes
app.use('/auth', authRoutes);
app.use('/', templateRoutes);
app.use('/', categoryRoutes);
app.get('/health', healthCheck);

// Stats
let requestCount = 0;
app.use((req, res, next) => { requestCount++; next(); });
app.get('/stats', require('./middleware/auth').authenticateToken, (req, res) => {
  res.json({
    ok: true,
    data: { requests: requestCount },
    timestamp: new Date().toISOString()
  });
});

// Server
const port = process.env.PORT || '5003';
const server = http.createServer(app);

// Graceful shutdown
process.on('SIGTERM', () => gracefulShutdown(server));
process.on('SIGINT', () => gracefulShutdown(server));

// Start
(async () => {
  const connected = await testConnection();
  
  if (!connected) {
    log('ERROR', 'Cannot start without database connection');
    process.exit(1);
  }
  
  server.listen(port, () => {
    log('INFO', `Server listening on port ${port}`);
  });
  
  server.on('error', (error) => {
    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    
    if (error.code === 'EACCES') {
      log('ERROR', `${bind} requires elevated privileges`);
      process.exit(1);
    } else if (error.code === 'EADDRINUSE') {
      log('ERROR', `${bind} is already in use`);
      process.exit(1);
    } else {
      throw error;
    }
  });
})();