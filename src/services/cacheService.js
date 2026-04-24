const cache = {
  data: null,
  expiresAt: null,
  TTL: 5 * 60 * 1000
};

function isCacheValid() {
  return cache.data !== null && Date.now() < cache.expiresAt;
}

function getCache() {
  return cache.data;
}

function setCache(data) {
  cache.data = data;
  cache.expiresAt = Date.now() + cache.TTL;
}

function invalidateCache() {
  cache.data = null;
  cache.expiresAt = null;
}

module.exports = {
  isCacheValid,
  getCache,
  setCache,
  invalidateCache
};
