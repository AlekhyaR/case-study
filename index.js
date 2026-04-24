// ✅ Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// ✅ Validate required environment variables
function validateRequiredEnvironment() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ All required environment variables found');
}

validateRequiredEnvironment();

var express = require('express');
var http = require('http');
var debug = require('debug')('appostrophe-backend-case-study:server');
var { Pool } = require('pg');

// ✅ Track database connection status
let dbConnected = false;

// ✅ Retry logic for transient failures
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
      console.log(`Retry attempt ${attempt}/${maxAttempts}, waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

// ✅ Error classification
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

// ✅ SECURITY: Sanitize error messages for clients
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

// ✅ SECURITY: Log full error details server-side only
function logErrorDetails(err, context) {
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.error(`[${errorId}] ${context}`, {
    message: err.message,
    code: err.code,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  
  return errorId;
}

// ✅ FIXED: Database pool with proper configuration
var client = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ✅ Handle connection pool errors
client.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// ✅ Test database connection on startup
async function testDatabaseConnection() {
  try {
    const result = await client.query('SELECT NOW()');
    dbConnected = true;
    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    dbConnected = false;
    return false;
  }
}

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var port = process.env.PORT || '5003';
var server = http.createServer(app);

var requestCount = 0;

// ✅ FIXED: Proper cache management with TTL and invalidation
var cache = {
  templates: null,
  expiresAt: null,
  TTL: 5 * 60 * 1000
};

function isCacheValid() {
  return cache.templates !== null && Date.now() < cache.expiresAt;
}

function setCacheValid() {
  cache.expiresAt = Date.now() + cache.TTL;
}

function invalidateCache() {
  cache.templates = null;
  cache.expiresAt = null;
}

// ✅ FIXED: Standardized response format + Sanitized errors
app.get('/get-templates', async function(req, res) {
  requestCount++;
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    if (isCacheValid()) {
      return res.json({
        ok: true,
        data: cache.templates,
        timestamp: new Date().toISOString()
      });
    }

    var result = await queryWithRetry(() =>
      client.query(`
        SELECT 
          t.id,
          t.title,
          t.source,
          t.order_index,
          t.created_at,
          t.updated_at,
          json_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL) as categories
        FROM templates t
        LEFT JOIN template_categories tc ON t.id = tc.template_id
        LEFT JOIN categories c ON c.id = tc.category_id
        GROUP BY t.id, t.title, t.source, t.order_index, t.created_at, t.updated_at
        ORDER BY t.order_index ASC
      `)
    );

    var mappedResult = result.rows.map(row => ({
      ...row,
      categories: row.categories || []
    }));

    cache.templates = mappedResult;
    setCacheValid();
    
    res.json({
      ok: true,
      data: mappedResult,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/get-templates');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.get('/get-template', async function(req, res) {
  requestCount++;
  var templateId = parseInt(req.query.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ 
      ok: false, 
      error: 'id must be a positive integer',
      timestamp: new Date().toISOString()
    });
  }
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    var result = await queryWithRetry(() =>
      client.query(`
        SELECT 
          t.id,
          t.title,
          t.source,
          t.order_index,
          t.created_at,
          t.updated_at,
          json_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL) as categories
        FROM templates t
        LEFT JOIN template_categories tc ON t.id = tc.template_id
        LEFT JOIN categories c ON c.id = tc.category_id
        WHERE t.id = $1
        GROUP BY t.id, t.title, t.source, t.order_index, t.created_at, t.updated_at
      `, [templateId])
    );

    if (result.rows.length > 0) {
      var template = result.rows[0];
      res.json({
        ok: true,
        data: {
          id: template.id,
          title: template.title,
          source: template.source,
          order_index: template.order_index,
          created_at: template.created_at,
          updated_at: template.updated_at,
          categories: template.categories || []
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ 
        ok: false, 
        error: 'Template not found',
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/get-template');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.post('/create-template', async function(req, res) {
  requestCount++;
  var data = req.body;
  var id = parseInt(data.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ 
      ok: false, 
      error: 'id must be a positive integer',
      timestamp: new Date().toISOString()
    });
  }
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return res.status(400).json({ 
      ok: false, 
      error: 'title must be a non-empty string',
      timestamp: new Date().toISOString()
    });
  }
  if (data.source === undefined || data.source === null) {
    return res.status(400).json({ 
      ok: false, 
      error: 'source is required',
      timestamp: new Date().toISOString()
    });
  }
  if (data.order_index !== undefined && (!Number.isInteger(Number(data.order_index)) || isNaN(Number(data.order_index)))) {
    return res.status(400).json({ 
      ok: false, 
      error: 'order_index must be an integer',
      timestamp: new Date().toISOString()
    });
  }
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    var insertResult = await queryWithRetry(() =>
      client.query(
        'INSERT INTO templates (id, title, source, order_index) VALUES ($1, $2, $3, $4)',
        [id, data.title.trim(), JSON.stringify(data.source), data.order_index !== undefined ? Number(data.order_index) : 0]
      )
    );
    
    if (data.categories && Array.isArray(data.categories)) {
      for (var i = 0; i < data.categories.length; i++) {
        var catSlug = data.categories[i];
        var catResult = await queryWithRetry(() =>
          client.query('SELECT id FROM categories WHERE slug = $1', [catSlug])
        );
        if (catResult.rows.length > 0) {
          await queryWithRetry(() =>
            client.query(
              'INSERT INTO template_categories (template_id, category_id) VALUES ($1, $2)',
              [id, catResult.rows[0].id]
            )
          );
        }
      }
    }
    
    invalidateCache();
    
    res.status(201).json({ 
      ok: true, 
      data: { id: id },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/create-template');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.post('/update-template', async function(req, res) {
  requestCount++;
  var updates = req.body;
  var templateId = parseInt(updates.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ 
      ok: false, 
      error: 'id must be a positive integer',
      timestamp: new Date().toISOString()
    });
  }
  if (updates.title !== undefined && (typeof updates.title !== 'string' || !updates.title.trim())) {
    return res.status(400).json({ 
      ok: false, 
      error: 'title must be a non-empty string',
      timestamp: new Date().toISOString()
    });
  }
  if (updates.order_index !== undefined && (!Number.isInteger(Number(updates.order_index)) || isNaN(Number(updates.order_index)))) {
    return res.status(400).json({ 
      ok: false, 
      error: 'order_index must be an integer',
      timestamp: new Date().toISOString()
    });
  }
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    var query = 'UPDATE templates SET ';
    var values = [];
    var paramCount = 1;

    if (updates.title !== undefined) {
      query += `title = $${paramCount}, `;
      values.push(updates.title.trim());
      paramCount++;
    }
    if (updates.source !== undefined) {
      query += `source = $${paramCount}, `;
      values.push(JSON.stringify(updates.source));
      paramCount++;
    }
    if (updates.order_index !== undefined) {
      query += `order_index = $${paramCount}, `;
      values.push(Number(updates.order_index));
      paramCount++;
    }
    
    query += `updated_at = now() WHERE id = $${paramCount}`;
    values.push(templateId);
    
    var result = await queryWithRetry(() =>
      client.query(query, values)
    );

    invalidateCache();

    res.json({ 
      ok: true, 
      data: { updated: result.rowCount > 0 },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/update-template');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.delete('/delete-template', async function(req, res) {
  requestCount++;
  var templateId = parseInt(req.query.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ 
      ok: false, 
      error: 'Invalid id',
      timestamp: new Date().toISOString()
    });
  }
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    var result = await queryWithRetry(() =>
      client.query('DELETE FROM templates WHERE id = $1', [templateId])
    );
    
    invalidateCache();

    res.json({ 
      ok: true, 
      data: { deleted: result.rowCount, id: templateId },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/delete-template');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.get('/get-template-categories', async function(req, res) {
  requestCount++;
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    var categories = await queryWithRetry(() =>
      client.query('SELECT id, slug FROM categories ORDER BY id ASC')
    );
    
    res.json({
      ok: true,
      data: categories.rows,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/get-template-categories');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.post('/create-template-category', async function(req, res) {
  requestCount++;
  var slug = req.body.slug;
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ 
      ok: false, 
      error: 'slug must be a non-empty lowercase alphanumeric string (hyphens allowed)',
      timestamp: new Date().toISOString()
    });
  }
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    var result = await queryWithRetry(() =>
      client.query('INSERT INTO categories (slug) VALUES ($1) RETURNING id', [slug])
    );
    
    invalidateCache();
    
    res.status(201).json({ 
      ok: true, 
      data: { id: result.rows[0].id, slug: slug },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/create-template-category');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.get('/search-templates', async function(req, res) {
  requestCount++;
  var searchTerm = req.query.q || '';
  try {
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    if (isCacheValid() && !searchTerm) {
      return res.json({
        ok: true,
        data: cache.templates,
        timestamp: new Date().toISOString()
      });
    }

    var result = await queryWithRetry(() =>
      client.query(`
        SELECT 
          t.id,
          t.title,
          t.source,
          t.order_index,
          t.created_at,
          t.updated_at,
          json_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL) as categories
        FROM templates t
        LEFT JOIN template_categories tc ON t.id = tc.template_id
        LEFT JOIN categories c ON c.id = tc.category_id
        WHERE t.title ILIKE '%' || $1 || '%' OR t.id::TEXT ILIKE '%' || $1 || '%'
        GROUP BY t.id, t.title, t.source, t.order_index, t.created_at, t.updated_at
        ORDER BY t.order_index ASC
      `, [searchTerm])
    );

    var mappedResult = result.rows.map(row => ({
      ...row,
      categories: row.categories || []
    }));
 
    if (!searchTerm) {
      cache.templates = mappedResult;
      setCacheValid();
    }

    res.json({
      ok: true,
      data: mappedResult,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/search-templates');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({ 
      ok: false, 
      error: safeMessage,
      type: type,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/stats', function(req, res) {
  res.json({ 
    ok: true,
    data: { requests: requestCount },
    timestamp: new Date().toISOString()
  });
});

// ✅ FIXED: Standardized response format + Sanitized errors
app.get('/health', async function(req, res) {
  try {
    const result = await queryWithRetry(() =>
      client.query('SELECT NOW()')
    );
    
    res.status(200).json({
      ok: true,
      data: {
        status: 'healthy',
        database: {
          connected: true,
          checked: result.rows[0].now
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const { status, type } = classifyDatabaseError(e);
    const errorId = logErrorDetails(e, '/health');
    const safeMessage = sanitizeErrorMessage(e, type);
    
    res.status(status).json({
      ok: false,
      error: safeMessage,
      data: {
        status: 'unhealthy',
        database: {
          connected: false
        }
      },
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FIXED: Graceful shutdown
function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...');
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    try {
      await client.end();
      console.log('✅ Database connection closed');
    } catch (err) {
      console.error('❌ Error closing database:', err);
    }
    
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

testDatabaseConnection().then(connected => {
  if (!connected) {
    console.error('❌ Cannot start without database connection');
    process.exit(1);
  }
});

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  debug('Listening on ' + bind);
}