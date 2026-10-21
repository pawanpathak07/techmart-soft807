
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const file = path.resolve('data', 'shop.db');

try {
  const db = new DatabaseSync(file, { readOnly: true });

  console.log('Database:', file);

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
  ).all();

  console.log('Tables found:', tables.length);

  for (const table of tables) {
    const name = '"' + table.name.replace(/"/g, '""') + '"';
    const result = db.prepare(
      `SELECT COUNT(*) AS total FROM ${name}`
    ).get();

    console.log(`${table.name}: ${result.total} rows`);
  }

  db.close();
} catch (error) {
  console.log('Inspection error:', error.message);
}
