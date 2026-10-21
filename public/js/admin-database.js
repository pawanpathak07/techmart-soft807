(async function () {
  if (!(await initPage({ role: 'admin', active: 'database' }))) return;
  const counts = document.getElementById('counts');
  try {
    const data = await api('/database');
    document.getElementById('engine').textContent = `${data.engine} · ${data.mode}`;
    counts.innerHTML = Object.entries(data.counts).map(([name, count]) => `<div class="card stat"><div class="label">${esc(name.replaceAll('_',' '))}</div><div class="value">${Number(count).toLocaleString()}</div></div>`).join('');
  } catch (err) { document.getElementById('engine').textContent = err.message; }
  document.getElementById('exportBtn').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/database/export', { credentials: 'same-origin' });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Backup export failed'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'techmart-database-export.json'; a.click();
      URL.revokeObjectURL(url); toast('Backup export downloaded');
    } catch (err) { toast(err.message, 'error'); }
  });
})();
