// In-app notifications and optional email delivery. Email is enabled only when SMTP is configured.
const db = require('./db');

function notify({ userId = null, audience = 'customer', title, message, link = '/orders.html' }) {
  db.prepare('INSERT INTO notifications (user_id, audience, title, message, link) VALUES (?, ?, ?, ?, ?)')
    .run(userId, audience, title, message, link);
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

function customerEmail(userId) {
  return db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);
}

module.exports = { notify, emailUser, customerEmail };
