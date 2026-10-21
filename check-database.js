
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const os = require('os');

const recoveryFolder = path.join(
  os.homedir(),
  'Desktop',
  'TechMart-Recovery'
);

const files = [
  path.join(recoveryFolder, 'shop.db'),
  path.join(recoveryFolder, 'shop-backup.db'),
];

for (const file of files) {
  console.log('\nChecking:', file);

  try {
    const db = new DatabaseSync(file, { readOnly: true });

    const tables = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    if (tables.length === 0) {
      console.log('No tables found.');
    }

    for (const table of tables) {
      const safeName = '"' + table.name.replace(/"/g, '""') + '"';
      const result = db.prepare(
        `SELECT COUNT(*) AS total FROM ${safeName}`
      ).get();

      console.log(`${table.name}: ${result.total} rows`);
    }

    db.close();
  } catch (error) {
    console.log('Could not check this file:', error.message);
  }
}
