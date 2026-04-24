process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const { generateToken, verifyToken } = require('../src/utils/jwt');

describe('generateToken', () => {
  test('returns a three-part JWT string', () => {
    const token = generateToken({ username: 'alice' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyToken', () => {
  test('returns the original payload for a valid token', () => {
    const token = generateToken({ username: 'alice' });
    const decoded = verifyToken(token);
    expect(decoded.username).toBe('alice');
  });

  test('returns null for a completely invalid string', () => {
    expect(verifyToken('not.a.token')).toBeNull();
  });

  test('returns null for a tampered signature', () => {
    const token = generateToken({ username: 'alice' });
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(verifyToken(tampered)).toBeNull();
  });

  test('returns null for a token signed with a different secret', () => {
    const jwt = require('jsonwebtoken');
    const foreign = jwt.sign({ username: 'alice' }, 'wrong-secret');
    expect(verifyToken(foreign)).toBeNull();
  });
});
