
const db = require('./src/db');

const images = {
  'Wireless Mouse': 'https://placehold.co/600x400?text=Wireless+Mouse',
  'Mechanical Keyboard': 'https://placehold.co/600x400?text=Keyboard',
  '27" 4K Monitor': 'https://placehold.co/600x400?text=4K+Monitor',
  'USB-C Hub 7-in-1': 'https://placehold.co/600x400?text=USB-C+Hub',
  'Noise-Cancelling Headphones': 'https://placehold.co/600x400?text=Headphones',
  'Portable Speaker': 'https://placehold.co/600x400?text=Speaker',
  'Webcam 1080p': 'https://placehold.co/600x400?text=Webcam',
  'Laptop Stand': 'https://placehold.co/600x400?text=Laptop+Stand',
  'External SSD 1TB': 'https://placehold.co/600x400?text=SSD+1TB',
  'Smart Plug (2 pack)': 'https://placehold.co/600x400?text=Smart+Plug',
  'LED Desk Lamp': 'https://placehold.co/600x400?text=Desk+Lamp',
  'Gaming Chair': 'https://placehold.co/600x400?text=Gaming+Chair'
};

const update = db.prepare(
  'UPDATE products SET image_url = ? WHERE name = ?'
);

db.transaction(() => {
  for (const [name, url] of Object.entries(images)) {
    update.run(url, name);
  }
})();

console.log('Image URLs updated in the selected database.');
console.log(
  db.prepare('SELECT name, image_url FROM products').all()
);

