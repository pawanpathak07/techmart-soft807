// In-app notifications and optional email delivery. Email is enabled only when SMTP is configured.
const db = require('./db');

async function notify({ userId = null, audience = 'customer', title, message, link = '/orders.html' }) {
  await db.run(
    'INSERT INTO notifications (user_id, audience, title, message, link, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [userId, audience, title, message, link]
  );
}

async function emailUser(to, subject, text) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !to) return;
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
    });
    await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
  } catch (err) {
    // An email provider outage must not roll back a successful order/status change.
    console.error('[email] Notification could not be sent:', err.message);
  }
}

async function customerEmail(userId) {
  return db.get('SELECT name, email FROM users WHERE id = ?', [userId]);
}

module.exports = { notify, emailUser, customerEmail };
