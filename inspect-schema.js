
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
  console.log('\n' + table + ':');
  const columns = db.prepare(
    `PRAGMA table_info("${table}")`
  ).all();

  console.log(columns.map(column => column.name).join(', '));
}

db.close();
