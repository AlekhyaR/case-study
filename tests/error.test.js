const { classifyDatabaseError, sanitizeErrorMessage } = require('../src/utils/error');

describe('classifyDatabaseError', () => {
  test('ECONNREFUSED → 503 CONNECTION', () => {
    expect(classifyDatabaseError({ code: 'ECONNREFUSED', message: '' }))
      .toEqual({ status: 503, type: 'CONNECTION' });
  });

  test('ENOTFOUND → 503 CONNECTION', () => {
    expect(classifyDatabaseError({ code: 'ENOTFOUND', message: '' }))
      .toEqual({ status: 503, type: 'CONNECTION' });
  });

  test('timeout message → 504 TIMEOUT', () => {
    expect(classifyDatabaseError({ message: 'query timeout exceeded' }))
      .toEqual({ status: 504, type: 'TIMEOUT' });
  });

  test('permission denied code → 403 PERMISSION', () => {
    expect(classifyDatabaseError({ code: '42501', message: 'permission denied' }))
      .toEqual({ status: 403, type: 'PERMISSION' });
  });

  test('table does not exist → 400 NOT_FOUND', () => {
    expect(classifyDatabaseError({ code: '42P01', message: 'does not exist' }))
      .toEqual({ status: 400, type: 'NOT_FOUND' });
  });

  test('duplicate key → 409 CONFLICT', () => {
    expect(classifyDatabaseError({ code: '23505', message: 'duplicate key' }))
      .toEqual({ status: 409, type: 'CONFLICT' });
  });

  test('unknown error → 500 UNKNOWN', () => {
    expect(classifyDatabaseError({ code: 'SOMETHING', message: 'unexpected' }))
      .toEqual({ status: 500, type: 'UNKNOWN' });
  });
});

describe('sanitizeErrorMessage', () => {
  const cases = [
    ['CONNECTION', 'Database is currently unavailable. Please try again later.'],
    ['TIMEOUT', 'Request took too long. Please try again.'],
    ['PERMISSION', 'You do not have permission to perform this action.'],
    ['NOT_FOUND', 'The requested resource was not found.'],
    ['CONFLICT', 'The resource already exists.'],
    ['UNKNOWN', 'An error occurred. Please try again.'],
  ];

  test.each(cases)('type %s returns correct message', (type, expected) => {
    expect(sanitizeErrorMessage({}, type)).toBe(expected);
  });

  test('unrecognised type falls back to UNKNOWN message', () => {
    expect(sanitizeErrorMessage({}, 'MADE_UP'))
      .toBe('An error occurred. Please try again.');
  });
});
