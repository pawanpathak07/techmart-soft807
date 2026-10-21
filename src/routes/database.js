// Admin-only, read-only database diagnostics and JSON export. Never exposes password hashes.
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAdmin, (_req, res) => {
  const tables = ['users', 'products', 'orders', 'order_items', 'notifications', 'product_reviews'];
  const counts = {};
  for (const table of tables) counts[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  res.json({ engine: 'SQLite', mode: 'local file', counts, exportUrl: '/api/database/export' });
});
router.get('/export', requireAdmin, (_req, res) => {
  const data = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    tables: {
      users: db.prepare('SELECT id,name,email,role,active,created_at FROM users').all(),
      products: db.prepare('SELECT * FROM products').all(),
      orders: db.prepare('SELECT * FROM orders').all(),
      order_items: db.prepare('SELECT * FROM order_items').all(),
      notifications: db.prepare('SELECT * FROM notifications').all(),
      product_reviews: db.prepare('SELECT * FROM product_reviews').all(),
    },
  };
  res.setHeader('Content-Disposition', 'attachment; filename="techmart-database-export.json"');
  res.type('application/json').send(JSON.stringify(data, null, 2));
});
module.exports = router;
