(async function () {
  if (!(await initPage({ role: 'admin', active: 'products' }))) return;

  const table = document.getElementById('table');
  const dlg = document.getElementById('dlg');
  const form = document.getElementById('form');
  const formAlert = document.getElementById('formAlert');
  const search = document.getElementById('search');
  const fields = ['name', 'category', 'price', 'stock', 'image_url', 'description'];
  let products = [];
  let editingId = null;

  async function load() {
    ({ products } = await api('/products'));
    render();
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const rows = products.filter((p) => !q || (p.name + ' ' + p.category).toLowerCase().includes(q));
    if (!rows.length) {
      table.innerHTML = '<div class="empty">No products found.</div>';
      return;
    }
    table.innerHTML = `<table>
      <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>${rows.map((p) => `
        <tr>
          <td>${p.id}</td>
          <td><strong>${esc(p.name)}</strong></td>
          <td>${esc(p.category)}</td>
          <td>${money(p.price)}</td>
          <td>${p.stock === 0 ? '<span class="stock-out">0</span>' : p.stock <= 5 ? `<span class="stock-low">${p.stock}</span>` : p.stock}</td>
          <td class="actions">
            <button class="btn sm" data-edit="${p.id}">Edit</button>
            <button class="btn sm danger" data-del="${p.id}">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  }

  function openForm(p) {
    editingId = p ? p.id : null;
    document.getElementById('dlgTitle').textContent = p ? `Edit product #${p.id}` : 'Add product';
    formAlert.className = 'alert';
    fields.forEach((f) => { document.getElementById(f).value = p ? p[f] : (f === 'stock' ? 0 : ''); });
    dlg.showModal();
    document.getElementById('name').focus();
  }

  document.getElementById('addBtn').addEventListener('click', () => openForm(null));
  document.getElementById('cancelBtn').addEventListener('click', () => dlg.close());
  search.addEventListener('input', render);

  table.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.edit) openForm(products.find((p) => p.id === Number(t.dataset.edit)));
    if (t.dataset.del) {
      const p = products.find((x) => x.id === Number(t.dataset.del));
      if (!(await askConfirm(`Do you want to delete "${p.name}"? Past orders keep their record of it.`, 'Yes, delete', 'Cancel'))) return;
      try {
        await api('/products/' + p.id, { method: 'DELETE' });
        await load();
        popup(`Your product change was saved: "${p.name}" has been deleted from the database.`, 'success', 2500);
      } catch (err) { popup(err.message, 'error'); }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formAlert.className = 'alert';
    const body = Object.fromEntries(fields.map((f) => [f, document.getElementById(f).value]));
    try {
      if (editingId) await api('/products/' + editingId, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
      dlg.close();
      const wasEdit = !!editingId;
      await load();
      popup(wasEdit ? `Your product change was saved: "${body.name}" has been updated in the database.` : `Your product change was saved: "${body.name}" has been added to the database.`, 'success', 2500);
    } catch (err) { showAlert(formAlert, err.message); }
  });

  load();
})();
