// src/routes/templates.js
const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');
const { authenticateToken } = require('../middleware/auth');
const { handleError } = require('../utils/error');
const { isCacheValid, getCache, setCache, invalidateCache } = require('../services/cacheService');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePagination(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}

function mapTemplate(row) {
  const { total_count, ...template } = row;
  return { ...template, categories: template.categories || [] };
}

// GET all templates
router.get('/get-templates', authenticateToken, async (req, res) => {
  try {
    const { limit, page, offset } = parsePagination(req.query);
    const useCache = !req.query.page && !req.query.limit;

    if (useCache && isCacheValid()) {
      const cached = getCache();
      return res.json({
        ok: true,
        data: cached.data,
        pagination: { page, limit, total: cached.total, totalPages: Math.ceil(cached.total / limit) },
        timestamp: new Date().toISOString()
      });
    }

    const result = await templateService.getAllTemplates(limit, offset);
    const total = parseInt(result.rows[0]?.total_count || 0, 10);
    const data = result.rows.map(mapTemplate);

    if (useCache) {
      setCache({ data, total });
    }

    res.json({
      ok: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/get-templates', e, res);
  }
});

// GET single template
router.get('/get-template', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.query.id, 10);

    if (!Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'id must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }

    const result = await templateService.getTemplateById(templateId);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Template not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      ok: true,
      data: mapTemplate(result.rows[0]),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/get-template', e, res);
  }
});

// CREATE template
router.post('/create-template', authenticateToken, async (req, res) => {
  try {
    const { id, title, source, order_index, categories } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'id must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'title must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }

    if (source === undefined || source === null) {
      return res.status(400).json({
        ok: false,
        error: 'source is required',
        timestamp: new Date().toISOString()
      });
    }

    await templateService.createTemplate(id, title, source, order_index, categories);
    invalidateCache();

    res.status(201).json({
      ok: true,
      data: { id },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/create-template', e, res);
  }
});

// UPDATE template
router.post('/update-template', authenticateToken, async (req, res) => {
  try {
    const { id, ...updates } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'id must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }

    const result = await templateService.updateTemplate(id, updates);
    invalidateCache();

    res.json({
      ok: true,
      data: { updated: result.rowCount > 0 },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/update-template', e, res);
  }
});

// DELETE template
router.delete('/delete-template', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.query.id, 10);

    if (!Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid id',
        timestamp: new Date().toISOString()
      });
    }

    const result = await templateService.deleteTemplate(templateId);
    invalidateCache();

    res.json({
      ok: true,
      data: { deleted: result.rowCount, id: templateId },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/delete-template', e, res);
  }
});

// SEARCH templates
router.get('/search-templates', authenticateToken, async (req, res) => {
  try {
    const searchTerm = req.query.q || '';
    const { limit, page, offset } = parsePagination(req.query);

    const result = await templateService.searchTemplates(searchTerm, limit, offset);
    const total = parseInt(result.rows[0]?.total_count || 0, 10);
    const data = result.rows.map(mapTemplate);

    res.json({
      ok: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/search-templates', e, res);
  }
});

module.exports = router;
