// Numbers for the admin dashboard.
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (_req, res) => {
  const n = async (sql) => Number((await db.get(sql)).n);
  res.json({
    totals: {
      products: await n('SELECT COUNT(*) AS n FROM products'),
      customers: await n("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
      orders: await n('SELECT COUNT(*) AS n FROM orders'),
      revenue: await n("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE status <> 'cancelled'"),
    },
    ordersByStatus: await db.all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status'),
    lowStock: await db.all('SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC, name LIMIT 8'),
    recentOrders: await db.all(
      `SELECT o.id, o.total, o.status, o.created_at, u.name AS customer_name
       FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 6`
    ),
  });
});

module.exports = router;
