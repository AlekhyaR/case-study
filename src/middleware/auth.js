const { verifyToken } = require('../utils/jwt');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'No authentication token provided',
      type: 'UNAUTHORIZED',
      timestamp: new Date().toISOString()
    });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid or expired authentication token',
      type: 'UNAUTHORIZED',
      timestamp: new Date().toISOString()
    });
  }
  
  req.user = decoded;
  next();
}

module.exports = { authenticateToken };