const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const v = require('../util');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const rows = req.user.role === 'admin'
    ? await db.all("SELECT * FROM notifications WHERE audience = 'admin' OR user_id = ? ORDER BY id DESC LIMIT 100", [req.user.id])
    : await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100', [req.user.id]);
  const unread = rows.filter((r) => !r.read_at).length;
  res.json({ notifications: rows, unread });
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  const id = v.id(req.params.id);
  const row = await db.get('SELECT * FROM notifications WHERE id = ?', [id]);
  if (!row || (row.user_id !== req.user.id && !(req.user.role === 'admin' && row.audience === 'admin'))) {
    throw new v.HttpError(404, 'Notification not found');
  }
  await db.run('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    await db.run("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL AND (audience = 'admin' OR user_id = ?)", [req.user.id]);
  } else {
    await db.run('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL AND user_id = ?', [req.user.id]);
  }
  res.json({ ok: true });
});

module.exports = router;
