const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');
const { authenticateToken } = require('../middleware/auth');
const { handleError } = require('../utils/error');
const { success } = require('../utils/response');
const { invalidateCache } = require('../services/cacheService');
const { validateBody } = require('../validation/validate');
const { CreateCategoryBodySchema } = require('../validation/schemas');

router.get('/get-template-categories', authenticateToken, async (req, res) => {
  try {
    const result = await categoryService.getAllCategories();
    res.json(success(result.rows));
  } catch (e) {
    handleError('/get-template-categories', e, res);
  }
});

router.post('/create-template-category', authenticateToken, validateBody(CreateCategoryBodySchema), async (req, res) => {
  try {
    const result = await categoryService.createCategory(req.body.slug);
    invalidateCache();
    res.status(201).json(success({ id: result.rows[0].id, slug: req.body.slug }));
  } catch (e) {
    handleError('/create-template-category', e, res);
  }
});

module.exports = router;
