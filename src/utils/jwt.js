const jwt = require('jsonwebtoken');

function generateToken(data) {
  return jwt.sign(data, process.env.JWT_SECRET, {
    expiresIn: '24h'
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { generateToken, verifyToken };