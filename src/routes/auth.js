const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { issueToken, clearToken, requireAuth } = require('../middleware/auth');
const v = require('../util');
const { emailUser } = require('../notifications');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// Create a customer account (role is always "customer" here)
router.post('/register', loginLimiter, async (req, res) => {
  const name = v.str(req.body.name, { field: 'Name', required: true, min: 2, max: 80 });
  const email = v.email(req.body.email);
  const password = v.password(req.body.password);

  if (await db.get('SELECT id FROM users WHERE email = ?', [email]))
    throw new v.HttpError(409, 'This Gmail ID is already signed up. Please try another Gmail ID or log in.');

  const hash = bcrypt.hashSync(password, 10);
  const info = await db.run(
    'INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)',
    [name, email, hash, 'customer']
  );
  const user = await db.get('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);
  issueToken(res, user);
  emailUser(user.email, 'Welcome to TechMart', `Hi ${user.name},\n\nYour TechMart account has been created successfully.\nSign-up email: ${user.email}\n\nWhen you place an order, we will email you the order items, total, and each order status update (pending, paid, shipped, delivered, or cancelled).\n\nThank you for joining TechMart.`);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = v.str(req.body.email, { field: 'Email', required: true }).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

  // Same message for unknown email and wrong password so accounts cannot be guessed
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    throw new v.HttpError(401, 'Incorrect email or password');
  if (!user.active) throw new v.HttpError(403, 'This account has been deactivated');

  issueToken(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

// Returns { user: null } when logged out so the pages can check quietly
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

// Customer edits own profile. Changing the password needs the current one.
router.put('/me', requireAuth, async (req, res) => {
  const name = v.str(req.body.name, { field: 'Name', required: true, min: 2, max: 80 });
  await db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);

  if (req.body.newPassword) {
    const row = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(String(req.body.currentPassword || ''), row.password_hash))
      throw new v.HttpError(400, 'Current password is incorrect');
    const hash = bcrypt.hashSync(v.password(req.body.newPassword), 10);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  }
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
});

module.exports = router;
