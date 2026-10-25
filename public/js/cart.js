(async function () {
  const user = await initPage({ active: 'cart' });
  const box = document.getElementById('cartBox');
  const alertBox = document.getElementById('alert');
  let lines = []; // [{ product, qty }]

  async function load() {
    const items = Cart.get();
    lines = [];
    const keep = [];
    for (const it of items) {
      try {
        const { product } = await api('/products/' + it.id);
        lines.push({ product, qty: Math.min(it.qty, Math.max(product.stock, 1)) });
        keep.push({ id: it.id, qty: Math.min(it.qty, Math.max(product.stock, 1)) });
      } catch (_) { /* product was deleted: drop it from the cart */ }
    }
    Cart.set(keep);
    updateCartBadge();
    render();
  }

  function render() {
    if (!lines.length) {
      box.innerHTML = '<div class="empty">Your cart is empty. <a href="/">Browse the shop</a></div>';
      return;
    }
    const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
    box.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th></th></tr></thead>
        <tbody>${lines.map((l) => `
          <tr>
            <td><strong>${esc(l.product.name)}</strong>${l.product.stock === 0 ? '<div class="stock-out">Out of stock</div>' : ''}</td>
            <td>${money(l.product.price)}</td>
            <td><span class="qty">
              <button data-dec="${l.product.id}" aria-label="Decrease">-</button>
              <span>${l.qty}</span>
              <button data-inc="${l.product.id}" aria-label="Increase">+</button></span></td>
            <td>${money(l.product.price * l.qty)}</td>
            <td class="actions"><button class="btn sm danger" data-del="${l.product.id}">Remove</button></td>
          </tr>`).join('')}
        </tbody></table></div>
      <div class="summary"><span>Total</span><span>${money(total)}</span></div>
      <div style="text-align:right;margin-top:14px">
        <button class="btn" id="clearBtn">Clear cart</button>
        <button class="btn primary" id="checkoutBtn">${user ? 'Place order' : 'Log in to check out'}</button>
      </div>`;
  }

  function save() {
    Cart.set(lines.map((l) => ({ id: l.product.id, qty: l.qty })));
    updateCartBadge();
    render();
  }

  box.addEventListener('click', async (e) => {
    const t = e.target;
    const find = (id) => lines.find((l) => l.product.id === Number(id));
    if (t.dataset.inc) {
      const l = find(t.dataset.inc);
      if (l.qty < l.product.stock) { l.qty++; save(); } else toast('No more stock available', 'error');
    } else if (t.dataset.dec) {
      const l = find(t.dataset.dec);
      if (l.qty > 1) { l.qty--; save(); }
    } else if (t.dataset.del) {
      lines = lines.filter((l) => l.product.id !== Number(t.dataset.del));
      save();
    } else if (t.id === 'clearBtn') {
      lines = [];
      save();
    } else if (t.id === 'checkoutBtn') {
      if (!user) { location.href = '/login.html?next=/cart.html'; return; }
      t.disabled = true;
      alertBox.className = 'alert';
      try {
        const { order } = await api('/orders', {
          method: 'POST',
          body: { items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })) },
        });
        Cart.clear();
        location.href = '/orders.html?placed=' + order.id;
      } catch (err) {
        t.disabled = false;
        showAlert(alertBox, err.message);
        await load(); // refresh stock numbers
      }
    }
  });

  await load();
})();
