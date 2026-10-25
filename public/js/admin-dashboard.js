(async function () {
  if (!(await initPage({ role: 'admin', active: 'dashboard' }))) return;

  const s = await api('/stats');
  const card = (label, value, href) =>
    `<a class="card stat" href="${href}" style="color:inherit;text-decoration:none"><div class="label">${label}</div><div class="value">${value}</div></a>`;

  document.getElementById('stats').innerHTML =
    card('Revenue', money(s.totals.revenue), '/admin/orders.html') +
    card('Orders', s.totals.orders, '/admin/orders.html') +
    card('Products', s.totals.products, '/admin/products.html') +
    card('Customers', s.totals.customers, '/admin/customers.html');

  document.getElementById('recent').innerHTML = s.recentOrders.length
    ? `<table><thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${
        s.recentOrders.map((o) => `<tr><td>${o.id}</td><td>${esc(o.customer_name || 'Deleted user')}</td><td>${money(o.total)}</td><td>${pill(o.status)}</td></tr>`).join('')
      }</tbody></table>`
    : '<div class="empty">No orders yet.</div>';

  document.getElementById('low').innerHTML = s.lowStock.length
    ? `<table><thead><tr><th>Product</th><th>Stock</th></tr></thead><tbody>${
        s.lowStock.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.stock === 0 ? '<span class="stock-out">0 - sold out</span>' : `<span class="stock-low">${p.stock}</span>`}</td></tr>`).join('')
      }</tbody></table>`
    : '<div class="empty">Everything is well stocked.</div>';

  const order = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  const counts = Object.fromEntries(s.ordersByStatus.map((r) => [r.status, r.n]));
  document.getElementById('byStatus').innerHTML = order
    .map((st) => `<span style="margin-right:18px">${pill(st)} <strong>${counts[st] || 0}</strong></span>`)
    .join('');
})();
