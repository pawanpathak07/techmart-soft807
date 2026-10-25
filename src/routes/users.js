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
router.get('/', async (_req, res) => {
  res.json({ users: await db.all(`SELECT ${COLUMNS} FROM users u ORDER BY u.id DESC`) });
});

// READ (one)
router.get('/:id', async (req, res) => {
  const user = await db.get(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`, [v.id(req.params.id)]);
  if (!user) throw new v.HttpError(404, 'User not found');
  res.json({ user });
});

// CREATE
router.post('/', async (req, res) => {
  const name = v.str(req.body.name, { field: 'Name', required: true, min: 2, max: 80 });
  const email = v.email(req.body.email);
  const password = v.password(req.body.password);
  const role = roleOf(req.body.role || 'customer');
  if (await db.get('SELECT id FROM users WHERE email = ?', [email]))
    throw new v.HttpError(409, 'An account with this email already exists');
  const info = await db.run(
    'INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [name, email, bcrypt.hashSync(password, 10), role, req.body.active === false ? 0 : 1]
  );
  res.status(201).json({ user: await db.get(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`, [info.lastInsertRowid]) });
});

// UPDATE (password is optional: leave it blank to keep the current one)
router.put('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  if (!existing) throw new v.HttpError(404, 'User not found');

  const name = v.str(req.body.name, { field: 'Name', required: true, min: 2, max: 80 });
  const email = v.email(req.body.email);
  const role = roleOf(req.body.role);
  const active = req.body.active ? 1 : 0;

  const clash = await db.get('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id]);
  if (clash) throw new v.HttpError(409, 'Another account already uses this email');
  if (id === req.user.id && (role !== 'admin' || !active))
    throw new v.HttpError(400, 'You cannot remove your own admin access or deactivate yourself');

  await db.run('UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?', [name, email, role, active, id]);
  if (req.body.password) {
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(v.password(req.body.password), 10), id]);
  }
  res.json({ user: await db.get(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`, [id]) });
});

// DELETE (their past orders stay in the system with no linked customer)
router.delete('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  if (id === req.user.id) throw new v.HttpError(400, 'You cannot delete your own account');
  const info = await db.run('DELETE FROM users WHERE id = ?', [id]);
  if (info.changes === 0) throw new v.HttpError(404, 'User not found');
  res.json({ ok: true });
});

module.exports = router;
