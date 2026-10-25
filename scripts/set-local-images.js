// Attaches the pictures in public/images/products to the products (matched by product name).
// Works with any file extension (.png, .jpg, .jpeg, .webp). Use it on an existing database:
//   npm run fix-images
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const names = {
  'Wireless Mouse': 'mouse', 'Mouse': 'mouse',
  'Mechanical Keyboard': 'keyboard',
  '27" 4K Monitor': 'monitor',
  'USB-C Hub 7-in-1': 'usb-hub',
  'Noise-Cancelling Headphones': 'headphones',
  'Portable Speaker': 'speaker',
  'Webcam 1080p': 'webcam',
  'Laptop Stand': 'laptop-stand',
  'External SSD 1TB': 'ssd',
  'Smart Plug (2 pack)': 'smart-plug',
  'LED Desk Lamp': 'desk-lamp',
  'Gaming Chair': 'gaming-chair',
};

const dir = path.join(__dirname, '..', 'public', 'images', 'products');
const files = fs.readdirSync(dir);
const fileFor = (base) => files.find((f) => f.replace(/\.[^.]+$/, '').toLowerCase() === base);

(async () => {
  await db.init();
  let changed = 0;
  for (const [name, base] of Object.entries(names)) {
    const file = fileFor(base);
    if (!file) { console.log('No picture file found for ' + name + ' (' + base + ')'); continue; }
    const r = await db.run('UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?', ['/images/products/' + file, name]);
    changed += Number(r.changes);
  }
  console.log('Updated pictures for ' + changed + ' product(s).');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
