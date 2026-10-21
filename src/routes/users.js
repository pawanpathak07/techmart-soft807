// Admin-only customer/user management (full CRUD).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const v = require('../util');

const router = express.Router();
router.use(requireAdmin);

const COLUMNS = `u.id, u.name, u.email, u.role, u.active, u.created_at,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count`;

function roleOf(value) {
  if (!['customer', 'admin'].includes(value)) throw new v.HttpError(400, 'Role must be customer or admin');
  return value;
}

// READ (list)
router.get('/', (_req, res) => {
  res.json({ users: db.prepare(`SELECT ${COLUMNS} FROM users u ORDER BY u.id DESC`).all() });
});

// READ (one)
router.get('/:id', (req, res) => {
  const user = db.prepare(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`).get(v.id(req.params.id));
  if (!user) throw new v.HttpError(404, 'User not found');
  res.json({ user });
});

// CREATE
router.post('/', (req, res) => {
  const name = v.str(req.body.name, { field: 'Name', required: true, min: 2, max: 80 });
  const email = v.email(req.body.email);
  const password = v.password(req.body.password);
  const role = roleOf(req.body.role || 'customer');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    throw new v.HttpError(409, 'An account with this email already exists');
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, bcrypt.hashSync(password, 10), role, req.body.active === false ? 0 : 1);
  res.status(201).json({ user: db.prepare(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`).get(info.lastInsertRowid) });
});

// UPDATE (password is optional: leave it blank to keep the current one)
router.put('/:id', (req, res) => {
  const id = v.id(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) throw new v.HttpError(404, 'User not found');

  const name = v.str(req.body.name, { field: 'Name', required: true, min: 2, max: 80 });
  const email = v.email(req.body.email);
  const role = roleOf(req.body.role);
  const active = req.body.active ? 1 : 0;

  const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(email, id);
  if (clash) throw new v.HttpError(409, 'Another account already uses this email');
  if (id === req.user.id && (role !== 'admin' || !active))
    throw new v.HttpError(400, 'You cannot remove your own admin access or deactivate yourself');

  db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?').run(
    name, email, role, active, id
  );
  if (req.body.password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      bcrypt.hashSync(v.password(req.body.password), 10), id
    );
  }
  res.json({ user: db.prepare(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`).get(id) });
});

// DELETE (their past orders stay in the system with no linked customer)
router.delete('/:id', (req, res) => {
  const id = v.id(req.params.id);
  if (id === req.user.id) throw new v.HttpError(400, 'You cannot delete your own account');
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (info.changes === 0) throw new v.HttpError(404, 'User not found');
  res.json({ ok: true });
});

module.exports = router;
