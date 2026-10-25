(function () {
  const form = document.getElementById('form');
  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.className = 'alert';
    try {
      const { user } = await api('/auth/login', {
        method: 'POST',
        body: {
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
        },
      });
      await popup('Login successful! Welcome back, ' + user.name + '.', 'success', 1500);
      // Only follow same-site paths from ?next= (blocks open redirects)
      const next = new URLSearchParams(location.search).get('next');
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      if (user.role === 'admin') location.href = safeNext && safeNext.startsWith('/admin') ? safeNext : '/admin/';
      else location.href = safeNext && !safeNext.startsWith('/admin') ? safeNext : '/';
    } catch (err) {
      showAlert(alertBox, err.message);
      popup(err.message, 'error');
    }
  });
})();
