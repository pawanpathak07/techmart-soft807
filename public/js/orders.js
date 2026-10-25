(async function () {
  const user = await initPage({ role: 'customer', active: 'orders' });
  if (!user) return;

  const list = document.getElementById('orders');
  const alertBox = document.getElementById('alert');

  const placed = new URLSearchParams(location.search).get('placed');
  if (placed) showAlert(alertBox, `Thank you! Order #${placed} has been placed.`, 'ok');

  async function load() {
    const { orders } = await api('/orders/mine');
    if (!orders.length) {
      list.innerHTML = '<div class="card empty">You have not placed any orders yet. <a href="/">Start shopping</a></div>';
      return;
    }
    list.innerHTML = orders.map((o) => `
      <div class="card order-card">
        <header>
          <div><strong>Order #${o.id}</strong> <span class="muted small">${esc(dateText(o.created_at))}</span></div>
          ${pill(o.status)}
        </header>
        <table><tbody>
          ${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="muted">x${i.qty}</td><td style="text-align:right">${money(i.price * i.qty)}</td></tr>`).join('')}
        </tbody></table>
        <div class="summary"><span>Total</span><span>${money(o.total)}</span></div>
        ${o.status === 'pending' ? `<div style="text-align:right;margin-top:10px"><button class="btn sm danger" data-cancel="${o.id}">Cancel order</button></div>` : ''}
      </div>`).join('');
  }

  list.addEventListener('click', async (e) => {
    const id = e.target.dataset.cancel;
    if (!id || !confirm(`Cancel order #${id}?`)) return;
    try {
      await api(`/orders/${id}/cancel`, { method: 'POST' });
      toast('Order cancelled');
      load();
    } catch (err) { toast(err.message, 'error'); }
  });

  // ----- account form -----
  document.getElementById('accEmail').value = user.email;
  document.getElementById('accName').value = user.name;
  const accAlert = document.getElementById('accAlert');
  document.getElementById('accForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    accAlert.className = 'alert';
    try {
      await api('/auth/me', {
        method: 'PUT',
        body: {
          name: document.getElementById('accName').value,
          currentPassword: document.getElementById('curPw').value,
          newPassword: document.getElementById('newPw').value,
        },
      });
      document.getElementById('curPw').value = '';
      document.getElementById('newPw').value = '';
      showAlert(accAlert, 'Saved', 'ok');
    } catch (err) { showAlert(accAlert, err.message); }
  });

  load();
})();
