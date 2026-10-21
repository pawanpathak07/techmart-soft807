
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/shop.db', {
  readOnly: true
});

for (const table of [
  'users',
  'products',
  'orders',
  'order_items',
  'notifications',
  'product_reviews'
]) {
  const result = db.prepare(
    `SELECT COUNT(*) AS total FROM "${table}"`
  ).get();

  console.log(`${table}: ${result.total} records`);
}

db.close();
