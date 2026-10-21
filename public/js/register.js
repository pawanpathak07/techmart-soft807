(function () {
  const form = document.getElementById('form');
  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.className = 'alert';
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@gmail\.com$/.test(email))
      return showAlert(alertBox, 'Please sign up with a Gmail address ending in @gmail.com');
    if (password.length < 8)
      return showAlert(alertBox, 'Please enter at least 8 characters for a strong password');
    if (password.length > 128)
      return showAlert(alertBox, 'Password must be no more than 128 characters');
    if (!/[@#$%]/.test(password))
      return showAlert(alertBox, 'Please include at least one special character: @, #, $, or % in your password');
    if (password !== document.getElementById('confirm').value)
      return showAlert(alertBox, 'The two passwords do not match');
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          name: document.getElementById('name').value,
          email,
          password,
        },
      });
      location.href = '/';
    } catch (err) {
      showAlert(alertBox, err.message);
    }
  });
})();
