// Reads the JWT from the httpOnly cookie, loads the user fresh from the database
// (so a deactivated or demoted account loses access immediately) and guards routes.
const jwt = require('jsonwebtoken');
const db = require('../db');

const COOKIE = 'token';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function secret() {
  return process.env.JWT_SECRET;
}

function issueToken(res, user) {
  const token = jwt.sign({ id: user.id }, secret(), { expiresIn: '2h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
  });
}

function clearToken(res) {
  res.clearCookie(COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[COOKIE];
  if (token) {
    try {
      const { id } = jwt.verify(token, secret());
      const user = db
        .prepare('SELECT id, name, email, role, active FROM users WHERE id = ?')
        .get(id);
      if (user && user.active) req.user = user;
    } catch (_) {
      /* invalid or expired token: treat as logged out */
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
}

module.exports = { issueToken, clearToken, loadUser, requireAuth, requireAdmin };
