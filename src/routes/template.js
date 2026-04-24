// src/routes/templates.js
const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');
const { authenticateToken } = require('../middleware/auth');
const { handleError } = require('../utils/error');
const { success, paginated } = require('../utils/response');
const { isCacheValid, getCache, setCache, invalidateCache } = require('../services/cacheService');
const { validateBody, validateQuery } = require('../validation/validate');
const {
  IdQuerySchema,
  PaginationSchema,
  CreateTemplateBodySchema,
  UpdateTemplateBodySchema,
  SearchQuerySchema,
  TemplateRowSchema
} = require('../validation/schemas');

const DEFAULT_LIMIT = 50;

function mapTemplate(row) {
  const { total_count, categories, ...rest } = TemplateRowSchema.parse(row);
  return { ...rest, categories: categories ?? [] };
}

function buildPagination(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

// GET all templates
router.get('/get-templates', authenticateToken, validateQuery(PaginationSchema), async (req, res) => {
  try {
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;
    const useCache = page === 1 && limit === DEFAULT_LIMIT;

    if (useCache && isCacheValid()) {
      const cached = getCache();
      return res.json(paginated(cached.data, buildPagination(page, limit, cached.total)));
    }

    const result = await templateService.getAllTemplates(limit, offset);
    const total = parseInt(result.rows[0]?.total_count || 0, 10);
    const data = result.rows.map(mapTemplate);

    if (useCache) setCache({ data, total });

    res.json(paginated(data, buildPagination(page, limit, total)));
  } catch (e) {
    handleError('/get-templates', e, res);
  }
});

// GET single template
router.get('/get-template', authenticateToken, validateQuery(IdQuerySchema), async (req, res) => {
  try {
    const result = await templateService.getTemplateById(req.query.id);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Template not found',
        type: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    res.json(success(mapTemplate(result.rows[0])));
  } catch (e) {
    handleError('/get-template', e, res);
  }
});

// CREATE template
router.post('/create-template', authenticateToken, validateBody(CreateTemplateBodySchema), async (req, res) => {
  try {
    const { id, title, source, order_index, categories } = req.body;
    await templateService.createTemplate(id, title, source, order_index, categories);
    invalidateCache();
    res.status(201).json(success({ id }));
  } catch (e) {
    handleError('/create-template', e, res);
  }
});

// UPDATE template
router.post('/update-template', authenticateToken, validateBody(UpdateTemplateBodySchema), async (req, res) => {
  try {
    const { id, ...updates } = req.body;
    const result = await templateService.updateTemplate(id, updates);
    invalidateCache();
    res.json(success({ updated: result.rowCount > 0 }));
  } catch (e) {
    handleError('/update-template', e, res);
  }
});

// DELETE template
router.delete('/delete-template', authenticateToken, validateQuery(IdQuerySchema), async (req, res) => {
  try {
    const result = await templateService.deleteTemplate(req.query.id);
    invalidateCache();
    res.json(success({ deleted: result.rowCount, id: req.query.id }));
  } catch (e) {
    handleError('/delete-template', e, res);
  }
});

// SEARCH templates
router.get('/search-templates', authenticateToken, validateQuery(SearchQuerySchema), async (req, res) => {
  try {
    const { q, page, limit } = req.query;
    const offset = (page - 1) * limit;
    const result = await templateService.searchTemplates(q, limit, offset);
    const total = parseInt(result.rows[0]?.total_count || 0, 10);
    const data = result.rows.map(mapTemplate);
    res.json(paginated(data, buildPagination(page, limit, total)));
  } catch (e) {
    handleError('/search-templates', e, res);
  }
});

module.exports = router;
