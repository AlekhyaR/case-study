process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const { generateToken } = require('../src/utils/jwt');
const { authenticateToken } = require('../src/middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticateToken', () => {
  test('returns 401 when Authorization header is absent', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is invalid', () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' } };
    const res = mockRes();
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when Bearer prefix is missing', () => {
    const token = generateToken({ username: 'alice' });
    const req = { headers: { authorization: token } };
    const res = mockRes();
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and sets req.user for a valid token', () => {
    const token = generateToken({ username: 'alice' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.username).toBe('alice');
  });

  test('response body contains ok:false and UNAUTHORIZED type on rejection', () => {
    const req = { headers: {} };
    const res = mockRes();
    authenticateToken(req, res, jest.fn());
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(false);
    expect(body.type).toBe('UNAUTHORIZED');
  });
});
