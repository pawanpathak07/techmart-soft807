// Database connection + schema. SQLite file is created automatically on first run.
// Uses the SQLite that is built into Node.js (22.13 or newer), so there is nothing to
// compile and no extra package to install.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'shop.db');
fs.mkdirSync(path.dirname(file), { recursive: true });

const raw = new DatabaseSync(file);

// Small wrapper giving the helpers the rest of the app uses
const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => raw.prepare(sql),
  pragma: (text) => raw.exec(`PRAGMA ${text}`),
  // Runs fn inside a transaction: all changes are saved together, or none are
  transaction: (fn) => (...args) => {
    raw.exec('BEGIN IMMEDIATE');
    try {
      const result = fn(...args);
      raw.exec('COMMIT');
      return result;
    } catch (err) {
      raw.exec('ROLLBACK');
      throw err;
    }
  },
};

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT 'General',
  price       REAL    NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url   TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total      REAL    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT    NOT NULL,
  price      REAL    NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  audience TEXT NOT NULL DEFAULT 'customer' CHECK (audience IN ('customer','admin')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '/orders.html',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience, id);

CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, id);
`);

module.exports = db;
