const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');
const { authenticateToken } = require('../middleware/auth');
const { handleError } = require('../utils/error');
const { invalidateCache } = require('../services/cacheService');

// GET all categories
router.get('/get-template-categories', authenticateToken, async (req, res) => {
  try {
    const result = await categoryService.getAllCategories();
    
    res.json({
      ok: true,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/get-template-categories', e, res);
  }
});

// CREATE category
router.post('/create-template-category', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.body;
    
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        ok: false,
        error: 'slug must be a non-empty lowercase alphanumeric string (hyphens allowed)',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await categoryService.createCategory(slug);
    invalidateCache();
    
    res.status(201).json({
      ok: true,
      data: {
        id: result.rows[0].id,
        slug
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    handleError('/create-template-category', e, res);
  }
});

module.exports = router;