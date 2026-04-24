// src/routes/templates.js
const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');
const { authenticateToken } = require('../middleware/auth');
const { handleError } = require('../utils/error');
const { isCacheValid, setCacheValid, invalidateCache } = require('../services/cacheService');

let cache = { templates: null };

// GET all templates
router.get('/get-templates', authenticateToken, async (req, res) => {
  try {
    if (isCacheValid()) {
      return res.json({
        ok: true,
        data: cache.templates,
        timestamp: new Date().toISOString()
      });
    }

    const result = await templateService.getAllTemplates();
    const mappedResult = result.rows.map(row => ({
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
    
    const template = result.rows[0];
    res.json({
      ok: true,
      data: {
        ...template,
        categories: template.categories || []
      },
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
    
    const result = await templateService.searchTemplates(searchTerm);
    const mappedResult = result.rows.map(row => ({
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
    handleError('/search-templates', e, res);
  }
});

module.exports = router;