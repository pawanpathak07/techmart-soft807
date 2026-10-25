// Database layer: MySQL (the cloud database) or SQLite (optional local file).
//
// Which one is used:
//   DB_CLIENT=mysql   -> MySQL, using MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE
//   DB_CLIENT=sqlite  -> local file data/shop.db (no server needed)
// If DB_CLIENT is not set, MySQL is used (XAMPP defaults when the MYSQL_* values are empty).
//
// Every route uses the same four async helpers, so the application code is identical for both:
//   db.get(sql, params)   -> first row or undefined
//   db.all(sql, params)   -> array of rows
//   db.run(sql, params)   -> { lastInsertRowid, changes }
//   db.transaction(async (tx) => { ... tx.get / tx.all / tx.run ... })   all-or-nothing
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const wanted = (process.env.DB_CLIENT || '').toLowerCase();
// MySQL is the default. Missing values fall back to the XAMPP defaults (127.0.0.1, root, no password, techmart).
// SQLite is used only when you write DB_CLIENT=sqlite in .env.
const client = wanted === 'sqlite' ? 'sqlite' : 'mysql';
process.env.MYSQL_HOST = (process.env.MYSQL_HOST || '').trim() || '127.0.0.1';
process.env.MYSQL_USER = (process.env.MYSQL_USER || '').trim() || 'root';
process.env.MYSQL_DATABASE = (process.env.MYSQL_DATABASE || '').trim() || 'techmart';

const TABLES = ['users', 'products', 'orders', 'order_items', 'notifications', 'product_reviews'];

/* ------------------------------------------------------------------ MySQL */
function createMysql() {
  const mysql = require('mysql2/promise');
  const need = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'].filter((k) => !process.env[k]);
  if (need.length) throw new Error('Missing ' + need.join(', ') + ' in .env (needed for MySQL).');

  const ssl = String(process.env.MYSQL_SSL || '').toLowerCase();
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL || 10),
    charset: 'utf8mb4',
    dateStrings: true,     // dates come back as 'YYYY-MM-DD HH:MM:SS' text, like SQLite
    decimalNumbers: true,  // DECIMAL columns (price, total) come back as numbers
    // Azure Database for MySQL needs SSL: set MYSQL_SSL=true (or MYSQL_SSL=no-verify if the certificate check fails)
    ssl: ssl === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
      : ssl === 'no-verify' ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined,
  });
  // Keep every date in UTC so the browser can convert it to local time.
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

  const clean = (params) => params.map((p) => (p === undefined ? null : p));
  const exec = (conn) => ({
    async all(sql, params = []) { const [rows] = await conn.execute(sql, clean(params)); return rows; },
    async get(sql, params = []) { const [rows] = await conn.execute(sql, clean(params)); return rows[0]; },
    async run(sql, params = []) {
      const [res] = await conn.execute(sql, clean(params));
      return { lastInsertRowid: res.insertId, changes: res.affectedRows };
    },
  });
  const api = exec(pool);
  api.client = 'mysql';
  api.forUpdate = ' FOR UPDATE';
  api.describe = () => ({ engine: 'MySQL', mode: process.env.MYSQL_HOST + ' / ' + process.env.MYSQL_DATABASE });
  api.transaction = async (fn) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(exec(conn));
      await conn.commit();
      return result;
    } catch (err) {
      try { await conn.rollback(); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      conn.release();
    }
  };

  api.init = async () => {
    // XAMPP: create the database automatically when it does not exist yet (visible in phpMyAdmin).
    try {
      const boot = await mysql.createConnection({
        host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD || '',
      });
      await boot.query('CREATE DATABASE IF NOT EXISTS `' + process.env.MYSQL_DATABASE.replace(/`/g, '') + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      await boot.end();
    } catch (err) {
      if (err.code === 'ECONNREFUSED') throw new Error('Cannot reach MySQL at ' + process.env.MYSQL_HOST + ':' + (process.env.MYSQL_PORT || 3306) + '. Open XAMPP Control Panel and click Start next to MySQL.');
      if (err.code === 'ER_ACCESS_DENIED_ERROR') throw new Error('MySQL refused the user/password in .env (XAMPP default: user root, empty password).');
      // other errors (for example no CREATE permission) are ignored; the pool connection below reports real problems
    }
    const create = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL, role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  active TINYINT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_users_email (email)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS products (
  id BIGINT NOT NULL AUTO_INCREMENT, name VARCHAR(200) NOT NULL, description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General', price DECIMAL(12,2) NOT NULL, stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT NOT NULL AUTO_INCREMENT, user_id BIGINT NULL, total DECIMAL(12,2) NOT NULL,
  status ENUM('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), KEY idx_orders_user (user_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT NOT NULL AUTO_INCREMENT, order_id BIGINT NOT NULL, product_id BIGINT NULL, name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL, qty INT NOT NULL, PRIMARY KEY (id), KEY idx_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT, user_id BIGINT NULL, audience ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  title VARCHAR(255) NOT NULL, message TEXT NOT NULL, link VARCHAR(255) NOT NULL DEFAULT '/orders.html',
  read_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, id), KEY idx_notifications_audience (audience, id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT NOT NULL AUTO_INCREMENT, product_id BIGINT NOT NULL, user_id BIGINT NOT NULL, rating TINYINT NOT NULL,
  comment VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
  UNIQUE KEY uq_review_product_user (product_id, user_id), KEY idx_reviews_product (product_id, id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE) ENGINE=InnoDB;`;
    const conn = await pool.getConnection();
    try {
      for (const stmt of create.split(/;\s*\n(?=CREATE)/)) await conn.query(stmt.replace(/;\s*$/, ''));
      // Tables copied by the old migration script have no AUTO_INCREMENT on id: add it so that
      // new products, users and orders can be inserted.
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of TABLES) {
        const [cols] = await conn.query(
          "SELECT COLUMN_TYPE AS t, EXTRA AS e FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'id'",
          [table]
        );
        if (cols.length && !/auto_increment/i.test(cols[0].e || '')) {
          await conn.query('ALTER TABLE `' + table + '` MODIFY `id` ' + cols[0].t + ' NOT NULL AUTO_INCREMENT');
          console.log('[db] Added AUTO_INCREMENT to ' + table + '.id');
        }
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      conn.release();
    }
  };
  return api;
}

/* ----------------------------------------------------------------- SQLite */
function createSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'shop.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA foreign_keys = ON');

  const fix = (r) => (r === undefined ? undefined : { ...r });
  const api = {
    async all(sql, params = []) { return raw.prepare(sql).all(...params).map(fix); },
    async get(sql, params = []) { return fix(raw.prepare(sql).get(...params)); },
    async run(sql, params = []) {
      const r = raw.prepare(sql).run(...params);
      return { lastInsertRowid: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    client: 'sqlite',
    forUpdate: '',
    describe: () => ({ engine: 'SQLite', mode: 'local file' }),
  };
  let queue = Promise.resolve();
  api.transaction = (fn) => {
    const job = queue.then(async () => {
      raw.exec('BEGIN IMMEDIATE');
      try { const result = await fn(api); raw.exec('COMMIT'); return result; }
      catch (err) { raw.exec('ROLLBACK'); throw err; }
    });
    queue = job.catch(() => {});
    return job;
  };
  api.init = async () => {
    raw.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')), active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General', price REAL NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0), image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, name TEXT NOT NULL, price REAL NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0));
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  audience TEXT NOT NULL DEFAULT 'customer' CHECK (audience IN ('customer','admin')), title TEXT NOT NULL,
  message TEXT NOT NULL, link TEXT NOT NULL DEFAULT '/orders.html', read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience, id);
CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(product_id, user_id));
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, id);`);
  };
  return api;
}

const db = client === 'mysql' ? createMysql() : createSqlite();
db.TABLES = TABLES;
module.exports = db;
