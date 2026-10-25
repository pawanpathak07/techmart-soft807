const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const v = require('../util');
const { notify, emailUser, customerEmail } = require('../notifications');

const router = express.Router();
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

async function emailOrderDetails(order, status, intro) {
  const lines = await db.all('SELECT name, price, qty FROM order_items WHERE order_id = ?', [order.id]);
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

async function withItems(order) {
  order.items = await db.all('SELECT product_id, name, price, qty FROM order_items WHERE order_id = ?', [order.id]);
  return order;
}

async function restoreStock(tx, orderId) {
  const items = await tx.all('SELECT product_id, qty FROM order_items WHERE order_id = ?', [orderId]);
  for (const i of items) {
    if (i.product_id) await tx.run('UPDATE products SET stock = stock + ? WHERE id = ?', [i.qty, i.product_id]);
  }
}

// Prices and stock are always taken from the database, never from the browser.
// Everything happens in one transaction: if anything fails, nothing is saved.
async function placeOrder(userId, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new v.HttpError(400, 'Your cart is empty');
  if (rawItems.length > 50) throw new v.HttpError(400, 'Too many different items in one order');

  // Merge duplicate product ids
  const wanted = new Map();
  for (const it of rawItems) {
    const pid = v.id(it.productId);
    const qty = v.int(it.qty, { field: 'Quantity', min: 1, max: 99 });
    wanted.set(pid, (wanted.get(pid) || 0) + qty);
  }

  return db.transaction(async (tx) => {
    let total = 0;
    const lines = [];
    for (const [pid, qty] of [...wanted].sort((a, b) => a[0] - b[0])) {
      // FOR UPDATE locks the product row (MySQL) so two customers cannot buy the last item at once
      const p = await tx.get('SELECT * FROM products WHERE id = ?' + db.forUpdate, [pid]);
      if (!p) throw new v.HttpError(400, 'A product in your cart no longer exists');
      if (p.stock < qty) throw new v.HttpError(409, `Only ${p.stock} of "${p.name}" left in stock`);
      total += Number(p.price) * qty;
      lines.push({ p, qty });
    }
    total = Math.round(total * 100) / 100;

    const order = await tx.run(
      "INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)",
      [userId, total]
    );
    for (const { p, qty } of lines) {
      await tx.run('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)',
        [order.lastInsertRowid, p.id, p.name, p.price, qty]);
      await tx.run('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, p.id]);
    }
    return order.lastInsertRowid;
  });
}

async function changeStatus(orderId, status) {
  await db.transaction(async (tx) => {
    const order = await tx.get('SELECT * FROM orders WHERE id = ?' + db.forUpdate, [orderId]);
    if (!order) throw new v.HttpError(404, 'Order not found');
    if (order.status === 'cancelled' && status !== 'cancelled')
      throw new v.HttpError(409, 'A cancelled order cannot be re-opened. Ask the customer to order again.');
    if (status === 'cancelled' && order.status !== 'cancelled') await restoreStock(tx, orderId);
    await tx.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  });
}

// ---------- CUSTOMER ----------

// CREATE
router.post('/', requireAuth, async (req, res) => {
  const id = await placeOrder(req.user.id, req.body.items);
  const order = await withItems(await db.get('SELECT * FROM orders WHERE id = ?', [id]));
  await notify({ audience: 'admin', title: 'New order received', message: `Order #${id} was placed for $${Number(order.total).toFixed(2)}.`, link: '/admin/orders.html' });
  await notify({ userId: req.user.id, title: 'Order placed', message: `Your order #${id} has been placed and is pending.`, link: '/orders.html' });
  const customer = await customerEmail(req.user.id);
  if (customer) emailUser(customer.email, `TechMart: your order #${id} was successfully placed`, await emailOrderDetails(order, 'pending', `Hi ${customer.name},\n\nYour order was successfully placed with TechMart. Thank you for your purchase! Your order is now waiting for processing. We will email you when its status changes.`));
  res.status(201).json({ order });
});

// READ own orders
router.get('/mine', requireAuth, async (req, res) => {
  const rows = await db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  const orders = [];
  for (const o of rows) orders.push(await withItems(o));
  res.json({ orders });
});

// UPDATE: customer can cancel their own order while it is still pending
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const id = v.id(req.params.id);
  const order = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!order) throw new v.HttpError(404, 'Order not found');
  if (order.status !== 'pending') throw new v.HttpError(409, 'Only pending orders can be cancelled');
  await changeStatus(id, 'cancelled');
  await notify({ userId: req.user.id, title: 'Order cancelled', message: `Your order #${id} was cancelled.`, link: '/orders.html' });
  await notify({ audience: 'admin', title: 'Order cancelled', message: `Customer cancelled order #${id}.`, link: '/admin/orders.html' });
  const customer = await customerEmail(req.user.id);
  if (customer) emailUser(customer.email, `TechMart order #${id} cancelled`, await emailOrderDetails({ ...order }, 'cancelled', `Hi ${customer.name},\n\nYour order has been cancelled.`));
  res.json({ ok: true });
});

// ---------- ADMIN ----------

// READ all (optional ?status=)
router.get('/', requireAdmin, async (req, res) => {
  const status = req.query.status;
  const base = `SELECT o.*, u.name AS customer_name, u.email AS customer_email
                FROM orders o LEFT JOIN users u ON u.id = o.user_id`;
  const rows = STATUSES.includes(status)
    ? await db.all(base + ' WHERE o.status = ? ORDER BY o.id DESC', [status])
    : await db.all(base + ' ORDER BY o.id DESC');
  const orders = [];
  for (const o of rows) orders.push(await withItems(o));
  res.json({ orders });
});

// UPDATE status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const status = String(req.body.status || '');
  if (!STATUSES.includes(status)) throw new v.HttpError(400, 'Invalid status');
  const id = v.id(req.params.id);
  const before = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!before) throw new v.HttpError(404, 'Order not found');
  await changeStatus(id, status);
  if (before.status !== status && before.user_id) {
    await notify({ userId: before.user_id, title: `Order ${status}`, message: `Your order #${id} status changed from ${before.status} to ${status}.`, link: '/orders.html' });
    const customer = await customerEmail(before.user_id);
    if (customer) emailUser(customer.email, `TechMart order #${id}: ${status}`, await emailOrderDetails({ ...before, ...(await db.get('SELECT * FROM orders WHERE id = ?', [id])) }, status, `Hi ${customer.name},\n\nYour order status has been updated to ${status}. Please see the details below.`));
  }
  if (before.status !== status) await notify({ audience: 'admin', title: 'Order updated', message: `Order #${id} status changed from ${before.status} to ${status}.`, link: '/admin/orders.html' });
  res.json({ ok: true });
});

// DELETE (puts stock back if the order was still active)
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = v.id(req.params.id);
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) throw new v.HttpError(404, 'Order not found');
  await db.transaction(async (tx) => {
    if (['pending', 'paid', 'shipped'].includes(order.status)) await restoreStock(tx, id);
    await tx.run('DELETE FROM orders WHERE id = ?', [id]);
  });
  res.json({ ok: true });
});

module.exports = router;
