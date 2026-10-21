// One-time, copy-only migration from TechMart SQLite to MySQL.
// This script never deletes or modifies the SQLite source database.
// Configure SQLITE_FILE (optional), MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.
require('dotenv').config();
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const mysql = require('mysql2/promise');

async function main() {
  if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
    throw new Error('Set MYSQL_HOST, MYSQL_USER and MYSQL_DATABASE in .env before migration.');
  }
  const sqlitePath = process.env.SQLITE_FILE || path.join(__dirname, '..', 'data', 'shop.db');
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD || '',
    
database: process.env.MYSQL_DATABASE,
waitForConnections: true,
connectionLimit: 2,
charset: 'utf8mb4',
ssl: { rejectUnauthorized: false },

  });
  const connection = await pool.getConnection();
  const schema = [
    `CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('customer','admin') NOT NULL DEFAULT 'customer', active TINYINT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS products (id BIGINT PRIMARY KEY, name VARCHAR(120) NOT NULL, description TEXT NOT NULL, category VARCHAR(60) NOT NULL, price DECIMAL(12,2) NOT NULL, stock INT NOT NULL, image_url VARCHAR(500) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS orders (id BIGINT PRIMARY KEY, user_id BIGINT NULL, total DECIMAL(12,2) NOT NULL, status ENUM('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending', created_at DATETIME NOT NULL, INDEX idx_orders_user(user_id), CONSTRAINT fk_orders_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL)`,
    `CREATE TABLE IF NOT EXISTS order_items (id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL, product_id BIGINT NULL, name VARCHAR(255) NOT NULL, price DECIMAL(12,2) NOT NULL, qty INT NOT NULL, INDEX idx_items_order(order_id), CONSTRAINT fk_items_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE, CONSTRAINT fk_items_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL)`,
    `CREATE TABLE IF NOT EXISTS notifications (id BIGINT PRIMARY KEY, user_id BIGINT NULL, audience ENUM('customer','admin') NOT NULL DEFAULT 'customer', title VARCHAR(255) NOT NULL, message TEXT NOT NULL, link VARCHAR(255) NOT NULL DEFAULT '/orders.html', read_at DATETIME NULL, created_at DATETIME NOT NULL, INDEX idx_notifications_user(user_id,id), INDEX idx_notifications_audience(audience,id), CONSTRAINT fk_notifications_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS product_reviews (id BIGINT PRIMARY KEY, product_id BIGINT NOT NULL, user_id BIGINT NOT NULL, rating TINYINT NOT NULL, comment VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, UNIQUE KEY uq_review_product_user(product_id,user_id), INDEX idx_reviews_product(product_id,id), CONSTRAINT fk_reviews_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE, CONSTRAINT fk_reviews_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
  ];
  const tableColumns = {
    users: ['id','name','email','password_hash','role','active','created_at'],
    products: ['id','name','description','category','price','stock','image_url','created_at','updated_at'],
    orders: ['id','user_id','total','status','created_at'],
    order_items: ['id','order_id','product_id','name','price','qty'],
    notifications: ['id','user_id','audience','title','message','link','read_at','created_at'],
    product_reviews: ['id','product_id','user_id','rating','comment','created_at'],
  };
  try {
    for (const sql of schema) await connection.query(sql);
    await connection.beginTransaction();
    for (const [table, cols] of Object.entries(tableColumns)) {
      // Copy-only default: every destination table must be empty, even when the source table has no rows.
      const [existing] = await connection.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      if (Number(existing[0].n) !== 0) throw new Error(`Target table ${table} is not empty; migration stopped without overwriting data.`);
      const rows = sqlite.prepare(`SELECT ${cols.join(',')} FROM ${table}`).all();
      if (!rows.length) { console.log(`No rows to copy for ${table}`); continue; }
      const marks = cols.map(() => '?').join(',');
      const sql = `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(',')}) VALUES (${marks})`;
      for (const row of rows) {
        const values = cols.map(c => row[c] === undefined ? null : row[c]);
        await connection.execute(sql, values);
      }
      console.log(`Copied ${rows.length} rows from ${table}`);
    }
    await connection.commit();
    console.log('Migration complete. SQLite source remains unchanged. Verify row counts before switching application traffic.');
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
    await pool.end();
    sqlite.close();
  }
}
main().catch(err => { console.error('Migration failed:', err.message); process.exitCode = 1; });
