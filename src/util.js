// Small helpers shared by the route files.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value, { field, min = 0, max = 255, required = false } = {}) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (required && v.length === 0) throw new HttpError(400, `${field} is required`);
  if (v.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  if (v.length < min && (required || v.length > 0))
    throw new HttpError(400, `${field} must be at least ${min} characters`);
  return v;
}

function email(value) {
  const v = str(value, { field: 'Email', required: true, max: 160 }).toLowerCase();
  if (!EMAIL_RE.test(v)) throw new HttpError(400, 'Please enter a valid email address');
  if (!/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@gmail\.com$/.test(v)) {
    throw new HttpError(400, 'Please sign up with a Gmail address ending in @gmail.com');
  }
  return v;
}

function password(value) {
  const v = typeof value === 'string' ? value : '';
  if (v.length < 8) throw new HttpError(400, 'Password must be at least 8 characters long');
  if (v.length > 128) throw new HttpError(400, 'Password must be no more than 128 characters long');
  if (!/[@#$%]/.test(v)) throw new HttpError(400, 'Password must include at least one special character: @, #, $, or %');
  return v;
}

function money(value, field = 'Price') {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw new HttpError(400, `${field} must be a number of 0 or more`);
  return Math.round(n * 100) / 100;
}

function int(value, { field, min = 0, max = 1000000 } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}`);
  return n;
}

function id(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid id');
  return n;
}

module.exports = { HttpError, str, email, password, money, int, id };
