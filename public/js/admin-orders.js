(async function () {
  if (!(await initPage({ role: 'admin', active: 'orders' }))) return;

  const table = document.getElementById('table');
  const filter = document.getElementById('filter');
  const dlg = document.getElementById('dlg');
  const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  let orders = [];

  async function load() {
    ({ orders } = await api('/orders' + (filter.value ? '?status=' + filter.value : '')));
    render();
  }

  function render() {
    if (!orders.length) {
      table.innerHTML = '<div class="empty">No orders found.</div>';
      return;
    }
    table.innerHTML = `<table>
      <thead><tr><th>#</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${orders.map((o) => `
        <tr>
          <td>${o.id}</td>
          <td>${esc(o.customer_name || 'Deleted user')}<div class="muted small">${esc(o.customer_email || '')}</div></td>
          <td class="small">${esc(dateText(o.created_at))}</td>
          <td>${o.items.reduce((n, i) => n + i.qty, 0)}</td>
          <td>${money(o.total)}</td>
          <td>
            <select data-status="${o.id}" ${o.status === 'cancelled' ? 'disabled' : ''} style="width:auto">
              ${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td class="actions">
            <button class="btn sm" data-view="${o.id}">View</button>
            <button class="btn sm danger" data-del="${o.id}">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  }

  filter.addEventListener('change', load);

  table.addEventListener('change', async (e) => {
    const id = e.target.dataset.status;
    if (!id) return;
    const status = e.target.value;
    if (status === 'cancelled' && !confirm('Cancel this order? Stock will be returned to the shop.')) return load();
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
      toast(`Order #${id} marked ${status}`);
    } catch (err) { toast(err.message, 'error'); }
    load();
  });

  table.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.view) {
      const o = orders.find((x) => x.id === Number(t.dataset.view));
      document.getElementById('dlgBody').innerHTML = `
        <h2>Order #${o.id} ${pill(o.status)}</h2>
        <p class="muted small">${esc(o.customer_name || 'Deleted user')} ${esc(o.customer_email ? '(' + o.customer_email + ')' : '')}<br>${esc(dateText(o.created_at))}</p>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>
          ${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`).join('')}
        </tbody></table>
        <div class="summary"><span>Total</span><span>${money(o.total)}</span></div>
        <div class="dlg-actions"><button class="btn" id="closeBtn">Close</button></div>`;
      dlg.showModal();
      document.getElementById('closeBtn').addEventListener('click', () => dlg.close());
    }
    if (t.dataset.del) {
      if (!confirm(`Delete order #${t.dataset.del}? This cannot be undone.`)) return;
      try {
        await api('/orders/' + t.dataset.del, { method: 'DELETE' });
        toast('Order deleted');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  load();
})();
