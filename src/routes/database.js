// Admin-only, read-only database diagnostics and JSON export. Never exposes password hashes.
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAdmin, async (_req, res) => {
  const counts = {};
  for (const table of db.TABLES) counts[table] = Number((await db.get(`SELECT COUNT(*) AS count FROM ${table}`)).count);
  res.json({ ...db.describe(), counts, exportUrl: '/api/database/export' });
});

router.get('/export', requireAdmin, async (_req, res) => {
  const data = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    tables: {
      users: await db.all('SELECT id,name,email,role,active,created_at FROM users'),
      products: await db.all('SELECT * FROM products'),
      orders: await db.all('SELECT * FROM orders'),
      order_items: await db.all('SELECT * FROM order_items'),
      notifications: await db.all('SELECT * FROM notifications'),
      product_reviews: await db.all('SELECT * FROM product_reviews'),
    },
  };
  res.setHeader('Content-Disposition', 'attachment; filename="techmart-database-export.json"');
  res.type('application/json').send(JSON.stringify(data, null, 2));
});

module.exports = router;
