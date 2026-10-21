(async function () {
  const user = await initPage();
  if (!user) return;
  const list = document.getElementById('notifications');
  async function load() {
    try {
      const { notifications } = await api('/notifications');
      if (!notifications.length) { list.innerHTML = '<div class="card empty">You are all caught up.</div>'; return; }
      list.innerHTML = notifications.map(n => `<article class="card notification ${n.read_at ? '' : 'unread'}">
        <div class="page-head" style="margin-bottom:6px"><strong>${esc(n.title)}</strong><span class="muted small">${esc(dateText(n.created_at))}</span></div>
        <p>${esc(n.message)}</p><div class="notification-actions"><a class="btn sm" href="${esc(n.link)}">Open</a>${n.read_at ? '<span class="muted small">Read</span>' : `<button class="btn sm" data-read="${n.id}">Mark as read</button>`}</div>
      </article>`).join('');
    } catch (err) { list.innerHTML = `<div class="alert show error">${esc(err.message)}</div>`; }
  }
  list.addEventListener('click', async e => {
    const id = e.target.dataset.read;
    if (!id) return;
    try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); await load(); } catch (err) { toast(err.message, 'error'); }
  });
  document.getElementById('readAll').addEventListener('click', async () => {
    try { await api('/notifications/read-all', { method: 'POST' }); await load(); toast('Notifications marked as read'); } catch (err) { toast(err.message, 'error'); }
  });
  await load();
})();
