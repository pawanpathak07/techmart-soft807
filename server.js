// Entry point: Express app = API (/api/*) + static frontend (/public)
require('dotenv').config();
const crypto = require('crypto');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-me')) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Set a real JWT_SECRET in your .env file before running in production.');
    process.exit(1);
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[warn] No JWT_SECRET set - using a temporary one. Logins reset on every restart.');
}

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

require('./src/seed'); // creates tables (via db.js) and inserts demo data when empty
const { loadUser } = require('./src/middleware/auth');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'], // admins can use external image links
      },
    },
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(loadUser);

// ----- API -----
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/stats', require('./src/routes/stats'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/database', require('./src/routes/database'));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ----- Frontend -----
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ----- Errors (always JSON) -----
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Shop running at http://localhost:${PORT}`);
    console.log(`Admin panel:     http://localhost:${PORT}/admin/`);
  });
}

module.exports = app;
