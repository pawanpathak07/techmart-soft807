// Numbers for the admin dashboard.
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (_req, res) => {
  const one = (sql) => db.prepare(sql).get();
  const all = (sql) => db.prepare(sql).all();

  res.json({
    totals: {
      products: one('SELECT COUNT(*) AS n FROM products').n,
      customers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").n,
      orders: one('SELECT COUNT(*) AS n FROM orders').n,
      revenue: one("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE status <> 'cancelled'").n,
    },
    ordersByStatus: all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status'),
    lowStock: all('SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC, name LIMIT 8'),
    recentOrders: all(
      `SELECT o.id, o.total, o.status, o.created_at, u.name AS customer_name
       FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 6`
    ),
  });
});

module.exports = router;
