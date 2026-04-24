const { isCacheValid, getCache, setCache, invalidateCache } = require('../src/services/cacheService');

beforeEach(() => {
  invalidateCache();
  jest.useRealTimers();
});

describe('isCacheValid', () => {
  test('returns false when cache is empty', () => {
    expect(isCacheValid()).toBe(false);
  });

  test('returns true after setCache', () => {
    setCache({ data: [], total: 0 });
    expect(isCacheValid()).toBe(true);
  });

  test('returns false after invalidateCache', () => {
    setCache({ data: [], total: 0 });
    invalidateCache();
    expect(isCacheValid()).toBe(false);
  });

  test('returns false after TTL expires', () => {
    jest.useFakeTimers();
    setCache({ data: [], total: 0 });
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(isCacheValid()).toBe(false);
  });
});

describe('getCache / setCache', () => {
  test('getCache returns null when empty', () => {
    expect(getCache()).toBeNull();
  });

  test('getCache returns the stored value', () => {
    const payload = { data: [{ id: 1 }], total: 1 };
    setCache(payload);
    expect(getCache()).toEqual(payload);
  });

  test('setCache overwrites previous value', () => {
    setCache({ data: [], total: 0 });
    setCache({ data: [{ id: 2 }], total: 1 });
    expect(getCache().total).toBe(1);
  });
});
