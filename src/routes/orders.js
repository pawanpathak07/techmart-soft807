const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const v = require('../util');
const { notify, emailUser, customerEmail } = require('../notifications');

const router = express.Router();
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

function emailOrderDetails(order, status, intro) {
  const lines = db.prepare('SELECT name, price, qty FROM order_items WHERE order_id = ?').all(order.id);
  const itemLines = lines.length
    ? lines.map((item) => `- ${item.name} | Qty: ${item.qty} | Unit price: $${Number(item.price).toFixed(2)} | Line total: $${(Number(item.price) * item.qty).toFixed(2)}`).join('\n')
    : '- No item details available';
  const statusText = {
    pending: 'Pending — your order was successfully placed and is waiting for processing. Payment may still be pending.',
    paid: 'Paid — payment has been marked as received.',
    shipped: 'Shipped — your order has been dispatched.',
    delivered: 'Delivered — your order is marked as delivered.',
    cancelled: 'Cancelled — this order has been cancelled.'
  }[status] || status;
  return `${intro}\n\nOrder number: #${order.id}\nOrder date: ${order.created_at || 'See your TechMart order history'}\n\nItems:\n${itemLines}\n\nOrder total: $${Number(order.total).toFixed(2)}\nOrder/payment status: ${statusText}\n\nYou can view your order history by signing in to TechMart and opening My Orders.\n\nThank you for shopping with TechMart.`;
}

function withItems(order) {
  order.items = db
    .prepare('SELECT product_id, name, price, qty FROM order_items WHERE order_id = ?')
    .all(order.id);
  return order;
}

function restoreStock(orderId) {
  const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId);
  const put = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  items.forEach((i) => i.product_id && put.run(i.qty, i.product_id));
}

// Prices and stock are always taken from the database, never from the browser.
const placeOrder = db.transaction((userId, rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new v.HttpError(400, 'Your cart is empty');
  if (rawItems.length > 50) throw new v.HttpError(400, 'Too many different items in one order');

  // Merge duplicate product ids
  const wanted = new Map();
  for (const it of rawItems) {
    const pid = v.id(it.productId);
    const qty = v.int(it.qty, { field: 'Quantity', min: 1, max: 99 });
    wanted.set(pid, (wanted.get(pid) || 0) + qty);
  }

  let total = 0;
  const lines = [];
  for (const [pid, qty] of wanted) {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
    if (!p) throw new v.HttpError(400, 'A product in your cart no longer exists');
    if (p.stock < qty)
      throw new v.HttpError(409, `Only ${p.stock} of "${p.name}" left in stock`);
    total += p.price * qty;
    lines.push({ p, qty });
  }
  total = Math.round(total * 100) / 100;

  const order = db.prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)').run(userId, total);
  const addItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)'
  );
  const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  for (const { p, qty } of lines) {
    addItem.run(order.lastInsertRowid, p.id, p.name, p.price, qty);
    dec.run(qty, p.id);
  }
  return order.lastInsertRowid;
});

const changeStatus = db.transaction((orderId, status) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new v.HttpError(404, 'Order not found');
  if (order.status === 'cancelled' && status !== 'cancelled')
    throw new v.HttpError(409, 'A cancelled order cannot be re-opened. Ask the customer to order again.');
  if (status === 'cancelled' && order.status !== 'cancelled') restoreStock(orderId);
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
});

// ---------- CUSTOMER ----------

// CREATE
router.post('/', requireAuth, (req, res) => {
  const id = placeOrder(req.user.id, req.body.items);
  const order = withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
  notify({ audience: 'admin', title: 'New order received', message: `Order #${id} was placed for $${Number(order.total).toFixed(2)}.`, link: '/admin/orders.html' });
  notify({ userId: req.user.id, title: 'Order placed', message: `Your order #${id} has been placed and is pending.`, link: '/orders.html' });
  const customer = customerEmail(req.user.id);
  if (customer) emailUser(customer.email, `TechMart: your order #${id} was successfully placed`, emailOrderDetails(order, 'pending', `Hi ${customer.name},\n\nYour order was successfully placed with TechMart. Thank you for your purchase! Your order is now waiting for processing. We will email you when its status changes.`));
  res.status(201).json({ order });
});

// READ own orders
router.get('/mine', requireAuth, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.id)
    .map(withItems);
  res.json({ orders });
});

// UPDATE: customer can cancel their own order while it is still pending
router.post('/:id/cancel', requireAuth, (req, res) => {
  const id = v.id(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!order) throw new v.HttpError(404, 'Order not found');
  if (order.status !== 'pending') throw new v.HttpError(409, 'Only pending orders can be cancelled');
  changeStatus(id, 'cancelled');
  notify({ userId: req.user.id, title: 'Order cancelled', message: `Your order #${id} was cancelled.`, link: '/orders.html' });
  notify({ audience: 'admin', title: 'Order cancelled', message: `Customer cancelled order #${id}.`, link: '/admin/orders.html' });
  const customer = customerEmail(req.user.id);
  if (customer) emailUser(customer.email, `TechMart order #${id} cancelled`, emailOrderDetails({ ...order, created_at: order.created_at }, 'cancelled', `Hi ${customer.name},\n\nYour order has been cancelled.`));
  res.json({ ok: true });
});

// ---------- ADMIN ----------

// READ all (optional ?status=)
router.get('/', requireAdmin, (req, res) => {
  const status = req.query.status;
  const base = `SELECT o.*, u.name AS customer_name, u.email AS customer_email
                FROM orders o LEFT JOIN users u ON u.id = o.user_id`;
  const rows = STATUSES.includes(status)
    ? db.prepare(base + ' WHERE o.status = ? ORDER BY o.id DESC').all(status)
    : db.prepare(base + ' ORDER BY o.id DESC').all();
  res.json({ orders: rows.map(withItems) });
});

// UPDATE status
router.patch('/:id/status', requireAdmin, (req, res) => {
  const status = String(req.body.status || '');
  if (!STATUSES.includes(status)) throw new v.HttpError(400, 'Invalid status');
  const id = v.id(req.params.id);
  const before = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!before) throw new v.HttpError(404, 'Order not found');
  changeStatus(id, status);
  if (before.status !== status && before.user_id) {
    notify({ userId: before.user_id, title: `Order ${status}`, message: `Your order #${id} status changed from ${before.status} to ${status}.`, link: '/orders.html' });
    const customer = customerEmail(before.user_id);
    if (customer) emailUser(customer.email, `TechMart order #${id}: ${status}`,  emailOrderDetails({ ...before, ...db.prepare('SELECT * FROM orders WHERE id = ?').get(id) }, status, `Hi ${customer.name},\n\nYour order status has been updated to ${status}. Please see the details below.`));
  }
  if (before.status !== status) notify({ audience: 'admin', title: 'Order updated', message: `Order #${id} status changed from ${before.status} to ${status}.`, link: '/admin/orders.html' });
  res.json({ ok: true });
});

// DELETE (puts stock back if the order was still active)
router.delete('/:id', requireAdmin, (req, res) => {
  const id = v.id(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) throw new v.HttpError(404, 'Order not found');
  db.transaction(() => {
    if (['pending', 'paid', 'shipped'].includes(order.status)) restoreStock(id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  })();
  res.json({ ok: true });
});

module.exports = router;
