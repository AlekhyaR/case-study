function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.error.errors[0].message,
        type: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.error.errors[0].message,
        type: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
    req.query = result.data;
    next();
  };
}

module.exports = { validateBody, validateQuery };
