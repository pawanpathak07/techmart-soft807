(async function () {
  const me = await initPage({ role: 'admin', active: 'customers' });
  if (!me) return;

  const table = document.getElementById('table');
  const dlg = document.getElementById('dlg');
  const form = document.getElementById('form');
  const formAlert = document.getElementById('formAlert');
  const search = document.getElementById('search');
  let users = [];
  let editingId = null;

  async function load() {
    ({ users } = await api('/users'));
    render();
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const rows = users.filter((u) => !q || (u.name + ' ' + u.email).toLowerCase().includes(q));
    if (!rows.length) {
      table.innerHTML = '<div class="empty">No users found.</div>';
      return;
    }
    table.innerHTML = `<table>
      <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Orders</th><th>Joined</th><th></th></tr></thead>
      <tbody>${rows.map((u) => `
        <tr>
          <td>${u.id}</td>
          <td><strong>${esc(u.name)}</strong>${u.id === me.id ? ' <span class="muted small">(you)</span>' : ''}</td>
          <td>${esc(u.email)}</td>
          <td>${pill(u.role)}</td>
          <td>${pill(u.active ? 'active' : 'inactive')}</td>
          <td>${u.order_count}</td>
          <td class="small">${esc(dateText(u.created_at))}</td>
          <td class="actions">
            <button class="btn sm" data-edit="${u.id}">Edit</button>
            <button class="btn sm danger" data-del="${u.id}" ${u.id === me.id ? 'disabled' : ''}>Delete</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  }

  function openForm(u) {
    editingId = u ? u.id : null;
    document.getElementById('dlgTitle').textContent = u ? `Edit user #${u.id}` : 'Add user';
    document.getElementById('pwLabel').textContent = u ? 'New password (leave blank to keep current)' : 'Password (8+ characters)';
    formAlert.className = 'alert';
    document.getElementById('name').value = u ? u.name : '';
    document.getElementById('email').value = u ? u.email : '';
    document.getElementById('password').value = '';
    document.getElementById('role').value = u ? u.role : 'customer';
    document.getElementById('active').checked = u ? !!u.active : true;
    dlg.showModal();
    document.getElementById('name').focus();
  }

  document.getElementById('addBtn').addEventListener('click', () => openForm(null));
  document.getElementById('cancelBtn').addEventListener('click', () => dlg.close());
  search.addEventListener('input', render);

  table.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.edit) openForm(users.find((u) => u.id === Number(t.dataset.edit)));
    if (t.dataset.del) {
      const u = users.find((x) => x.id === Number(t.dataset.del));
      if (!(await askConfirm(`Do you want to delete ${u.name}? Their past orders stay in the system.`, 'Yes, delete', 'Cancel'))) return;
      try {
        await api('/users/' + u.id, { method: 'DELETE' });
        popup('User deleted from the database.', 'success', 2000);
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formAlert.className = 'alert';
    const body = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      role: document.getElementById('role').value,
      active: document.getElementById('active').checked,
    };
    try {
      if (editingId) await api('/users/' + editingId, { method: 'PUT', body });
      else await api('/users', { method: 'POST', body });
      dlg.close();
      popup(editingId ? 'User change saved: user updated in the database.' : 'User change saved: user added to the database.', 'success', 2000);
      load();
    } catch (err) { showAlert(formAlert, err.message); }
  });

  load();
})();
