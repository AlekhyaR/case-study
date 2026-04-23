var express = require('express');
var http = require('http');
var debug = require('debug')('appostrophe-backend-case-study:server');
var { Pool } = require('pg');

var client = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 6543),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'appostrophe',
});

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var port = process.env.PORT || '5003';
var server = http.createServer(app);

var requestCount = 0;

var templatesCache = null;
var templatesCacheLoadedAt = null;
var lastTemplatesResult = null;

app.get('/get-templates', async function(req, res) {
  requestCount++;
  try {
    if (templatesCache) {
      lastTemplatesResult = templatesCache;
      return res.json(templatesCache);
    }

    var templates = await client.query('SELECT id, title, source, order_index, created_at, updated_at FROM templates ORDER BY order_index ASC');
    var result = [];
    for (var i = 0; i < templates.rows.length; i++) {
      var template = templates.rows[i];
      var categories = await client.query(
        'SELECT c.slug FROM template_categories tc JOIN categories c ON c.id = tc.category_id WHERE tc.template_id = $1',
        [template.id]
      );
      result.push({
        ...template,
        categories: categories.rows.map(cat => cat.slug)
      });
    }
    templatesCache = result;
    templatesCacheLoadedAt = Date.now();
    lastTemplatesResult = result;
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e), stack: e.stack, detail: e });
  }
});

app.get('/get-template', async function(req, res) {
  requestCount++;
  var templateId = parseInt(req.query.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  try {
    var template = await client.query('SELECT * FROM templates WHERE id = $1', [templateId ]);
    if (template.rows.length > 0) {
      var categories = await client.query(
        'SELECT c.slug FROM template_categories tc JOIN categories c ON c.id = tc.category_id WHERE tc.template_id = $1',
        [templateId ]
      );
      res.json({
        template: template.rows[0],
        categorySlugs: categories.rows.map(c => c.slug)
      });
    } else {
      res.json({ found: false });
    }
  } catch (e) {
    res.status(500).json({ msg: 'error happened', error: e.message, stack: e.stack });
  }
});

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
    var insertResult = await client.query(
      'INSERT INTO templates (id, title, source, order_index) VALUES ($1, $2, $3, $4)',
      [id, data.title.trim(), JSON.stringify(data.source), data.order_index !== undefined ? Number(data.order_index) : 0]
    );
    
    if (data.categories && Array.isArray(data.categories)) {
      for (var i = 0; i < data.categories.length; i++) {
        var catSlug = data.categories[i];
        var catResult = await client.query('SELECT id FROM categories WHERE slug = $1', [catSlug]);
        if (catResult.rows.length > 0) {
          await client.query(
            'INSERT INTO template_categories (template_id, category_id) VALUES ($1, $2)',
            [id, catResult.rows[0].id]
          );
        }
      }
    }
    
    res.json({ success: true, id: id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message, code: e.code });
  }
});

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
    
    var result = await client.query(query, values);
    res.json({ updated: result.rowCount > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/delete-template', async function(req, res) {
  requestCount++;
  var templateId = parseInt(req.query.id, 10);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id' });
  }
  try {
    var result = await client.query('DELETE FROM templates WHERE id = $1', [templateId]);
    res.json({ ok: true, deleted: result.rowCount, id: templateId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, code: e.code, where: e.where });
  }
});

app.get('/get-template-categories', async function(req, res) {
  requestCount++;
  try {
    var categories = await client.query('SELECT id, slug FROM categories ORDER BY id ASC');
    res.json(categories.rows);
  } catch (e) {
    res.status(500).json({ msg: 'bad things', error: e.message, stack: e.stack });
  }
});

app.post('/create-template-category', async function(req, res) {
  requestCount++;
  var slug = req.body.slug;
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ ok: false, error: 'slug must be a non-empty lowercase alphanumeric string (hyphens allowed)' });
  }
  try {
    var result = await client.query('INSERT INTO categories (slug) VALUES ($1) RETURNING id', [slug]);
    res.json({ id: result.rows[0].id, slug: slug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/search-templates', async function(req, res) {
  requestCount++;
  var searchTerm = req.query.q || '';
  try {
    if (lastTemplatesResult && !searchTerm) {
      return res.json(lastTemplatesResult);
    }

    var templates = await client.query(
      "SELECT * FROM templates WHERE title LIKE '%' || $1 || '%' OR id LIKE '%' || $1 || '%'",
      [searchTerm]
    );
    
    var result = [];
    for (var i = 0; i < templates.rows.length; i++) {
      var template = templates.rows[i];
      var categories = await client.query(
        'SELECT c.slug FROM template_categories tc JOIN categories c ON c.id = tc.category_id WHERE tc.template_id = $1',
        [template.id]
      );
      result.push({
        ...template,
        categories: categories.rows.map(cat => cat.slug)
      });
    }
    
    lastTemplatesResult = result;
    templatesCache = result;
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/stats', function(req, res) {
  res.json({ requests: requestCount });
});

app.get('/health', function(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

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
