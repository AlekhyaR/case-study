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
      // ✅ Only retry on transient errors
      const isTransient = err.message?.includes('timeout') || 
                         err.code === 'ECONNREFUSED' ||
                         err.code === 'ENOTFOUND';
      
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      
      // ✅ Exponential backoff
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
  
  // Connection errors → 503 Service Unavailable
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || 
      message.includes('could not connect')) {
    return { status: 503, type: 'CONNECTION' };
  }
  
  // Timeout errors → 504 Gateway Timeout
  if (message.includes('timeout') || code === 'QUERY_TIMEOUT') {
    return { status: 504, type: 'TIMEOUT' };
  }
  
  // Permission errors → 403 Forbidden
  if (message.includes('permission denied') || code === '42501') {
    return { status: 403, type: 'PERMISSION' };
  }
  
  // Not found errors → 400 Bad Request
  if (message.includes('does not exist') || code === '42P01') {
    return { status: 400, type: 'NOT_FOUND' };
  }
  
  // Duplicate key errors → 409 Conflict
  if (message.includes('duplicate') || code === '23505') {
    return { status: 409, type: 'CONFLICT' };
  }
  
  // Default → 500 Internal Server Error
  return { status: 500, type: 'UNKNOWN' };
}

// ✅ FIXED: Database pool with proper configuration
var client = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 20,                          // ✅ Connection pool size
  idleTimeoutMillis: 30000,         // ✅ Idle timeout
  connectionTimeoutMillis: 5000,    // ✅ Connection timeout
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
  TTL: 5 * 60 * 1000  // 5 minutes in milliseconds
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

// ✅ FIXED: N+1 Query Problem - Single query + Error handling + Retry
app.get('/get-templates', async function(req, res) {
  requestCount++;
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
      });
    }

    // Check if cache is valid (not expired)
    if (isCacheValid()) {
      return res.json(cache.templates);
    }

    // ✅ Single query with retry: Get templates with categories in one go
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

    // Map to ensure categories is always an array
    var mappedResult = result.rows.map(row => ({
      ...row,
      categories: row.categories || []
    }));

    cache.templates = mappedResult;
    setCacheValid();
    res.json(mappedResult);
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /get-templates:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

// ✅ FIXED: N+1 Query Problem - Single query + Error handling + Retry
app.get('/get-template', async function(req, res) {
  requestCount++;
  var templateId = parseInt(req.query.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
      });
    }

    // ✅ Single query with retry: Get template with categories in one go
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
        template: {
          id: template.id,
          title: template.title,
          source: template.source,
          order_index: template.order_index,
          created_at: template.created_at,
          updated_at: template.updated_at,
          categories: template.categories || []
        }
      });
    } else {
      res.status(404).json({ ok: false, error: 'Template not found' });
    }
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /get-template:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

// ✅ FIXED: Input validation + Error handling + Retry + Cache invalidation
app.post('/create-template', async function(req, res) {
  requestCount++;
  var data = req.body;
  var id = parseInt(data.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'id must be a positive integer' });
  }
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return res.status(400).json({ ok: false, error: 'title must be a non-empty string' });
  }
  if (data.source === undefined || data.source === null) {
    return res.status(400).json({ ok: false, error: 'source is required' });
  }
  if (data.order_index !== undefined && (!Number.isInteger(Number(data.order_index)) || isNaN(Number(data.order_index)))) {
    return res.status(400).json({ ok: false, error: 'order_index must be an integer' });
  }
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
      });
    }

    // ✅ Use retry logic
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
    
    // ✅ IMMEDIATELY invalidate cache - new data created
    invalidateCache();
    
    res.status(201).json({ ok: true, id: id });
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /create-template:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

// ✅ FIXED: Input validation + Error handling + Retry + Cache invalidation
app.post('/update-template', async function(req, res) {
  requestCount++;
  var updates = req.body;
  var templateId = parseInt(updates.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ ok: false, error: 'id must be a positive integer' });
  }
  if (updates.title !== undefined && (typeof updates.title !== 'string' || !updates.title.trim())) {
    return res.status(400).json({ ok: false, error: 'title must be a non-empty string' });
  }
  if (updates.order_index !== undefined && (!Number.isInteger(Number(updates.order_index)) || isNaN(Number(updates.order_index)))) {
    return res.status(400).json({ ok: false, error: 'order_index must be an integer' });
  }
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
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
    
    // ✅ Use retry logic
    var result = await queryWithRetry(() =>
      client.query(query, values)
    );

    // ✅ IMMEDIATELY invalidate cache - data was modified
    invalidateCache();

    res.json({ ok: true, updated: result.rowCount > 0 });
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /update-template:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

// ✅ FIXED: Input validation + Error handling + Retry + Cache invalidation
app.delete('/delete-template', async function(req, res) {
  requestCount++;
  var templateId = parseInt(req.query.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
      });
    }

    // ✅ Use retry logic
    var result = await queryWithRetry(() =>
      client.query('DELETE FROM templates WHERE id = $1', [templateId])
    );
    
    // ✅ IMMEDIATELY invalidate cache - data was deleted
    invalidateCache();

    res.json({ ok: true, deleted: result.rowCount, id: templateId });
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /delete-template:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

// ✅ FIXED: Error handling + Retry
app.get('/get-template-categories', async function(req, res) {
  requestCount++;
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
      });
    }

    var categories = await queryWithRetry(() =>
      client.query('SELECT id, slug FROM categories ORDER BY id ASC')
    );
    res.json(categories.rows);
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /get-template-categories:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

// ✅ FIXED: Input validation + Error handling + Retry + Cache invalidation
app.post('/create-template-category', async function(req, res) {
  requestCount++;
  var slug = req.body.slug;
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ ok: false, error: 'slug must be a non-empty lowercase alphanumeric string (hyphens allowed)' });
  }
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
      });
    }

    // ✅ Use retry logic
    var result = await queryWithRetry(() =>
      client.query('INSERT INTO categories (slug) VALUES ($1) RETURNING id', [slug])
    );
    
    // ✅ IMMEDIATELY invalidate cache - categories changed, templates affected
    invalidateCache();
    
    res.status(201).json({ ok: true, id: result.rows[0].id, slug: slug });
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /create-template-category:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

// ✅ FIXED: N+1 Query Problem - Single query + Error handling + Retry + Cache
app.get('/search-templates', async function(req, res) {
  requestCount++;
  var searchTerm = req.query.q || '';
  try {
    // Check if database is connected
    if (!dbConnected) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Database unavailable',
        type: 'SERVICE_UNAVAILABLE'
      });
    }

    // Only return cached result if cache is valid AND no search term
    if (isCacheValid() && !searchTerm) {
      return res.json(cache.templates);
    }

    // ✅ Single query with retry: Search templates with categories in one go
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

    // Map to ensure categories is always an array
    var mappedResult = result.rows.map(row => ({
      ...row,
      categories: row.categories || []
    }));
 
    // If no search term, cache the result
    if (!searchTerm) {
      cache.templates = mappedResult;
      setCacheValid();
    }

    res.json(mappedResult);
  } catch (e) {
    // ✅ Classify error and return appropriate status
    const { status, type } = classifyDatabaseError(e);
    console.error(`[${type}] Error in /search-templates:`, e.message);
    
    res.status(status).json({ 
      ok: false, 
      error: e.message,
      type: type
    });
  }
});

app.get('/stats', function(req, res) {
  res.json({ requests: requestCount });
});

// ✅ FIXED: Health check that actually tests database with retry
app.get('/health', async function(req, res) {
  try {
    // ✅ Actually test database connection with retry
    const result = await queryWithRetry(() =>
      client.query('SELECT NOW()')
    );
    
    res.status(200).json({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        checked: result.rows[0].now
      }
    });
  } catch (e) {
    // ✅ Return correct status code if database down
    const { status } = classifyDatabaseError(e);
    console.error('❌ Health check failed:', e.message);
    
    res.status(status).json({
      ok: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: e.message
      }
    });
  }
});

// ✅ FIXED: Graceful shutdown
function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...');
  
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    try {
      // ✅ Close database connection properly
      await client.end();
      console.log('✅ Database connection closed');
    } catch (err) {
      console.error('❌ Error closing database:', err);
    }
    
    process.exit(0);
  });
  
  // ✅ Force shutdown after 10 seconds
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

// ✅ Test database connection on startup
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