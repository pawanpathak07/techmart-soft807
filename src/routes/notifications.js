const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const v = require('../util');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare("SELECT * FROM notifications WHERE audience = 'admin' OR user_id = ? ORDER BY id DESC LIMIT 100").all(req.user.id)
    : db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100").all(req.user.id);
  const unread = rows.filter((r) => !r.read_at).length;
  res.json({ notifications: rows, unread });
});
router.patch('/:id/read', requireAuth, (req, res) => {
  const id = v.id(req.params.id);
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!row || (row.user_id !== req.user.id && !(req.user.role === 'admin' && row.audience === 'admin'))) {
    throw new v.HttpError(404, 'Notification not found');
  }
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true });
});
router.post('/read-all', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE read_at IS NULL AND (audience = 'admin' OR user_id = ?)").run(req.user.id);
  } else {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE read_at IS NULL AND user_id = ?").run(req.user.id);
  }
  res.json({ ok: true });
});
module.exports = router;
