// Inserts demo data when the database is empty. Safe to run many times.
// Run manually with:  npm run seed
const bcrypt = require('bcryptjs');
const db = require('./db');

function seed() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n === 0) {
    const insert = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    );
    // insert.run('Admin User', 'admin@shop.local', bcrypt.hashSync('Admin@123', 10), 'admin');
    // insert.run('Demo Customer', 'demo@shop.local', bcrypt.hashSync('Customer@123', 10), 'customer');
    // console.log('Seeded users: admin@shop.local / Admin@123 and demo@shop.local / Customer@123');
    insert.run('Admin User', 'admin@gmail.com', bcrypt.hashSync('Admin@123', 10), 'admin');
    insert.run('Demo Customer', 'demo@gmail.com', bcrypt.hashSync('Customer@123', 10), 'customer');
    console.log('Seeded users: admin@gmail.com / Admin@123 and demo@shop.local / Customer@123');
  }

  const { p } = db.prepare('SELECT COUNT(*) AS p FROM products').get();
  if (p === 0) {
    const insert = db.prepare(
      'INSERT INTO products (name, description, category, price, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    );
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
    const tx = db.transaction(() => demo.forEach((d) => insert.run(...d, '')));
    tx();
    console.log(`Seeded ${demo.length} products`);
  }
}

seed();
module.exports = seed;
