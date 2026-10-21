const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const v = require('../util');

const router = express.Router();

function readBody(b) {
  const imageUrl = v.str(b.image_url, { field: 'Image URL', max: 500 });
  if (imageUrl && !/^https?:\/\//i.test(imageUrl))
    throw new v.HttpError(400, 'Image URL must start with http:// or https://');
  return {
    name: v.str(b.name, { field: 'Name', required: true, max: 120 }),
    description: v.str(b.description, { field: 'Description', max: 2000 }),
    category: v.str(b.category, { field: 'Category', max: 60 }) || 'General',
    price: v.money(b.price),
    stock: v.int(b.stock, { field: 'Stock' }),
    image_url: imageUrl,
  };
}

// READ (list) - public. Optional ?q= text search and ?category= filter.
router.get('/', (req, res) => {
  const where = [];
  const args = [];
  if (req.query.q) {
    where.push('(name LIKE ? OR description LIKE ?)');
    const like = `%${String(req.query.q).slice(0, 80)}%`;
    args.push(like, like);
  }
  if (req.query.category) {
    where.push('category = ?');
    args.push(String(req.query.category));
  }
  const sql =
    'SELECT products.*, (SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = products.id) AS rating_average, (SELECT COUNT(*) FROM product_reviews WHERE product_id = products.id) AS rating_count FROM products' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY id DESC';
  res.json({ products: db.prepare(sql).all(...args) });
});

router.get('/meta/categories', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json({ categories: rows.map((r) => r.category) });
});

// Product reviews are public to read; authenticated customers can create/update one review per product.
router.get('/:id/reviews', (req, res) => {
  const productId = v.id(req.params.id);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) throw new v.HttpError(404, 'Product not found');
  const reviews = db.prepare(`SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.created_at, u.name AS customer_name
    FROM product_reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.id DESC`).all(productId);
  const summary = db.prepare('SELECT ROUND(AVG(rating), 1) AS average, COUNT(*) AS count FROM product_reviews WHERE product_id = ?').get(productId);
  res.json({ reviews, summary });
});
router.post('/:id/reviews', require('../middleware/auth').requireAuth, (req, res) => {
  if (req.user.role !== 'customer') throw new v.HttpError(403, 'Only customer accounts can leave reviews');
  const productId = v.id(req.params.id);
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(productId)) throw new v.HttpError(404, 'Product not found');
  const rating = v.int(req.body.rating, { field: 'Rating', min: 1, max: 5 });
  const comment = v.str(req.body.comment, { field: 'Comment', max: 1000 });
  // One review per customer/product; submitting again edits the existing review.
  db.prepare(`INSERT INTO product_reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
    ON CONFLICT(product_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = datetime('now')`)
    .run(productId, req.user.id, rating, comment);
  const review = db.prepare('SELECT * FROM product_reviews WHERE product_id = ? AND user_id = ?').get(productId, req.user.id);
  res.status(201).json({ review });
});

// READ (one) - public
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(v.id(req.params.id));
  if (!p) throw new v.HttpError(404, 'Product not found');
  res.json({ product: p });
});

// CREATE - admin
router.post('/', requireAdmin, (req, res) => {
  const d = readBody(req.body);
  const info = db
    .prepare(
      'INSERT INTO products (name, description, category, price, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(d.name, d.description, d.category, d.price, d.stock, d.image_url);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ product });
});

// UPDATE - admin
router.put('/:id', requireAdmin, (req, res) => {
  const id = v.id(req.params.id);
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id))
    throw new v.HttpError(404, 'Product not found');
  const d = readBody(req.body);
  db.prepare(
    `UPDATE products SET name = ?, description = ?, category = ?, price = ?, stock = ?,
     image_url = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(d.name, d.description, d.category, d.price, d.stock, d.image_url, id);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(id) });
});

// DELETE - admin (past orders keep the product name and price they were bought at)
router.delete('/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(v.id(req.params.id));
  if (info.changes === 0) throw new v.HttpError(404, 'Product not found');
  res.json({ ok: true });
});

module.exports = router;
