(function () {
  const form = document.getElementById('form');
  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.className = 'alert';
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@gmail\.com$/.test(email))
      { showAlert(alertBox, 'Please sign up with a Gmail address ending in @gmail.com'); return popup('Please sign up with a Gmail address ending in @gmail.com', 'error'); }
    if (password.length < 8)
      { showAlert(alertBox, 'Please enter at least 8 characters for a strong password'); return popup('Please enter at least 8 characters for a strong password', 'error'); }
    if (password.length > 128)
      { showAlert(alertBox, 'Password must be no more than 128 characters'); return popup('Password must be no more than 128 characters', 'error'); }
    if (!/[@#$%]/.test(password))
      { showAlert(alertBox, 'Please include at least one special character: @, #, $, or % in your password'); return popup('Please include at least one special character: @, #, $, or % in your password', 'error'); }
    if (password !== document.getElementById('confirm').value)
      { showAlert(alertBox, 'The two passwords do not match'); return popup('The two passwords do not match', 'error'); }
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          name: document.getElementById('name').value,
          email,
          password,
        },
      });
      await popup('Signup successful! Your account has been created and saved. Welcome to TechMart.', 'success', 2200);
      location.href = '/';
    } catch (err) {
      showAlert(alertBox, err.message);
      popup(err.message, 'error');
    }
  });
})();
