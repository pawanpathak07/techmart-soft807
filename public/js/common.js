// Shared helpers for every page: API calls, cart, navigation, toasts.

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Escape text before putting it inside HTML (prevents XSS)
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
const money = (n) => '$' + Number(n).toFixed(2);
const dateText = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString() : '');

function toast(message, type) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showAlert(el, message, type = 'error') {
  el.textContent = message;
  el.className = 'alert show ' + type;
}

// ---------- cart (kept in the browser until checkout) ----------
const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch (_) { return []; }
  },
  set(items) { localStorage.setItem('cart', JSON.stringify(items)); },
  count() { return this.get().reduce((n, i) => n + i.qty, 0); },
  add(product, qty = 1) {
    const items = this.get();
    const line = items.find((i) => i.id === product.id);
    if (line) line.qty = Math.min(line.qty + qty, 99);
    else items.push({ id: product.id, qty });
    this.set(items);
  },
  clear() { localStorage.removeItem('cart'); },
};

// ---------- navigation + access control ----------
// role: null (anyone), 'customer' (must be logged in) or 'admin'
async function initPage({ role = null, active = '' } = {}) {
  let user = null;
  try { user = (await api('/auth/me')).user; } catch (_) { /* offline */ }

  const next = encodeURIComponent(location.pathname);
  if (role === 'admin' && (!user || user.role !== 'admin')) {
    location.href = '/login.html?next=' + next;
    return null;
  }
  if (role === 'customer' && !user) {
    location.href = '/login.html?next=' + next;
    return null;
  }
  renderNav(user, active);
  return user;
}

function renderNav(user, active) {
  const isAdminArea = location.pathname.startsWith('/admin');
  const link = (href, label, key) =>
    `<a class="link ${active === key ? 'active' : ''}" href="${href}">${label}</a>`;

  let links = '';
  let right = '';
  if (isAdminArea) {
    links =
      link('/admin/', 'Dashboard', 'dashboard') +
      link('/admin/products.html', 'Products', 'products') +
      link('/admin/orders.html', 'Orders', 'orders') +
      link('/admin/customers.html', 'Customers', 'customers') +
      link('/admin/notifications.html', 'Notifications', 'notifications') +
      link('/admin/database.html', 'Database', 'database');
    right = link('/', 'View shop', '') + `<span class="who">${esc(user.name)}</span><button class="btn sm" id="logoutBtn">Log out</button>`;
  } else {
    links = link('/', 'Shop', 'shop');
    const cartLabel = `Cart<span class="badge-count" id="cartCount">${Cart.count()}</span>`;
    if (user) {
      links += link('/cart.html', cartLabel, 'cart') + link('/orders.html', 'My orders', 'orders') + link('/notifications.html', 'Notifications', 'notifications');
      if (user.role === 'admin') links += link('/admin/', 'Admin panel', '');
      right = `<span class="who">${esc(user.name)}</span><button class="btn sm" id="logoutBtn">Log out</button>`;
    } else {
      links += link('/cart.html', cartLabel, 'cart');
      right = link('/login.html', 'Log in', 'login') + `<a class="btn primary sm" href="/register.html">Sign up</a>`;
    }
  }

  const nav = document.createElement('nav');
  nav.className = 'nav' + (isAdminArea ? ' admin' : '');
  nav.innerHTML = `<div class="nav-inner">
      <a class="brand" href="${isAdminArea ? '/admin/' : '/'}">Tech<span>Mart</span>${isAdminArea ? ' Admin' : ''}</a>
      ${links}<span class="spacer"></span>${right}</div>`;
  document.body.prepend(nav);

  const out = document.getElementById('logoutBtn');
  if (out) {
    out.addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' });
      location.href = '/login.html';
    });
  }
}

function updateCartBadge() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = Cart.count();
}

function pill(text) {
  return `<span class="pill ${esc(text)}">${esc(text)}</span>`;
}

// Poll unread notifications while the user is signed in. The API scopes results to the current account.
async function refreshNotificationBadge() {
  try {
    const data = await api('/notifications');
    const links = [...document.querySelectorAll('.nav a.link')].filter(a => /Notifications/.test(a.textContent));
    for (const link of links) {
      const label = link.textContent.replace(/\\s*\\(\\d+\\)$/, '');
      link.textContent = data.unread ? `${label} (${data.unread})` : label;
    }
  } catch (_) { /* notification UI is non-critical */ }
}
setInterval(() => { if (document.querySelector('.nav .who')) refreshNotificationBadge(); }, 30000);
