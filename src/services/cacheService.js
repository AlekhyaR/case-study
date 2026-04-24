const cache = {
  templates: null,
  expiresAt: null,
  TTL: 5 * 60 * 1000
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

module.exports = {
  isCacheValid,
  setCacheValid,
  invalidateCache
};