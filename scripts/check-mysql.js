// Checks that the app can reach MySQL with the MYSQL_* values in .env:   npm run check:mysql
require('dotenv').config();
const db = require('../src/db');

(async () => {
  const d = db.describe();
  console.log('Using .env  : ' + (require('fs').existsSync(require('path').join(process.cwd(), '.env')) ? 'found' : 'NOT FOUND (using XAMPP defaults)'));
  console.log('Database engine : ' + d.engine + ' (' + d.mode + ')');
  if (db.client !== 'mysql') {
    console.log('\nThe app is using SQLite, not MySQL. Remove the line DB_CLIENT=sqlite from .env.');
    process.exit(1);
  }
  const one = await db.get('SELECT 1 AS ok');
  console.log('Connection      : OK (' + JSON.stringify(one) + ')');
  await db.init();
  for (const t of db.TABLES) {
    const r = await db.get('SELECT COUNT(*) AS n FROM `' + t + '`');
    console.log('  ' + t.padEnd(16) + r.n + ' row(s)');
  }
  console.log('\nMySQL is connected. Products, users and orders are saved in this database.');
  process.exit(0);
})().catch((e) => {
  console.error('\nConnection FAILED: ' + e.message);
  console.error('Check MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE in .env and that MySQL is running.');
  process.exit(1);
});
