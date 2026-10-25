// Inserts demo data when the database is empty. Safe to run many times.
// Run manually with:  npm run seed
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const images = {
  'Wireless Mouse': '/images/products/mouse.jpeg',
  'Mechanical Keyboard': '/images/products/keyboard.jpeg',
  '27" 4K Monitor': '/images/products/monitor.webp',
  'USB-C Hub 7-in-1': '/images/products/usb-hub.jpg',
  'Noise-Cancelling Headphones': '/images/products/headphones.webp',
  'Portable Speaker': '/images/products/speaker.webp',
  'Webcam 1080p': '/images/products/webcam.jpeg',
  'Laptop Stand': '/images/products/laptop-stand.jpg',
  'External SSD 1TB': '/images/products/ssd.webp',
  'Smart Plug (2 pack)': '/images/products/smart-plug.jpg',
  'LED Desk Lamp': '/images/products/desk-lamp.jpg',
  'Gaming Chair': '/images/products/gaming-chair.jpg'
};

async function seed() {
  const users = await db.get('SELECT COUNT(*) AS n FROM users');
  if (Number(users.n) === 0) {
    const insert = 'INSERT INTO users (name, email, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)';
    await db.run(insert, ['Admin User', 'admin@gmail.com', bcrypt.hashSync('Admin@123', 10), 'admin']);
    await db.run(insert, ['Demo Customer', 'demo@gmail.com', bcrypt.hashSync('Customer@123', 10), 'customer']);
    console.log('Seeded users: admin@gmail.com / Admin@123 and demo@gmail.com / Customer@123');
  }

  const products = await db.get('SELECT COUNT(*) AS n FROM products');
  if (Number(products.n) === 0) {
    const demo = [
      ['Wireless Mouse', 'Ergonomic 2.4GHz wireless mouse with silent clicks.', 'Accessories', 24.99, 40],
      ['Mechanical Keyboard', 'Hot-swappable switches, white backlight, USB-C.', 'Accessories', 89.0, 15],
      ['27" 4K Monitor', 'IPS panel, 60Hz, HDMI and DisplayPort inputs.', 'Displays', 329.0, 8],
      ['USB-C Hub 7-in-1', 'HDMI, 3x USB-A, SD, microSD and 100W power pass-through.', 'Accessories', 45.5, 25],
      ['Noise-Cancelling Headphones', 'Over-ear, 30 hour battery, Bluetooth 5.3.', 'Audio', 159.0, 12],
      ['Portable Speaker', 'Waterproof Bluetooth speaker with 12 hour playtime.', 'Audio', 59.9, 30],
      ['Webcam 1080p', 'Auto-focus webcam with built-in dual microphones.', 'Video', 49.0, 3],
      ['Laptop Stand', 'Adjustable aluminium stand for 10-17 inch laptops.', 'Accessories', 34.0, 50],
      ['External SSD 1TB', 'USB 3.2 portable SSD, up to 1000MB/s read speed.', 'Storage', 109.0, 20],
      ['Smart Plug (2 pack)', 'Wi-Fi smart plugs with scheduling and voice control.', 'Smart Home', 22.0, 60],
      ['LED Desk Lamp', 'Dimmable desk lamp with 5 colour temperatures.', 'Smart Home', 39.0, 18],
      ['Gaming Chair', 'Reclining ergonomic chair with lumbar support.', 'Furniture', 219.0, 0],
    ];
    for (const d of demo) {
      await db.run(
        'INSERT INTO products (name, description, category, price, stock, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [...d, images[d[0]] || '']
      );
    }
    console.log(`Seeded ${demo.length} products`);
  }
}

// Makes sure every product picture path points to a file that really exists in public/images/products.
// If a path ends with a different extension (for example mouse.png but the file is mouse.jpeg), it is corrected.
async function fixLocalImages() {
  const dir = path.join(__dirname, '..', 'public', 'images', 'products');
  let files;
  try { files = fs.readdirSync(dir); } catch (e) { return; }
  const byBase = {};
  files.forEach((f) => { const b = f.replace(/\.[^.]+$/, '').toLowerCase(); if (!byBase[b]) byBase[b] = f; });
  const rows = await db.all("SELECT id, image_url FROM products WHERE image_url LIKE '/images/products/%'");
  for (const r of rows) {
    const rel = r.image_url.replace('/images/products/', '');
    if (files.includes(rel)) continue;
    const base = rel.replace(/\.[^.]+$/, '').toLowerCase();
    if (byBase[base]) await db.run('UPDATE products SET image_url = ? WHERE id = ?', ['/images/products/' + byBase[base], r.id]);
  }
}

async function setup() {
  await db.init();
  await seed();
  await fixLocalImages();
  const info = db.describe();
  console.log(`[db] Using ${info.engine} (${info.mode})`);
}

module.exports = { seed, fixLocalImages, setup };
if (require.main === module) setup().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
