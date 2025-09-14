document.getElementById('accessForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const submitButton = document.getElementById('submitButton');
  const messageDiv = document.getElementById('message');

  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  messageDiv.style.display = 'none';

  try {
    const response = await fetch('/api/request-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json().catch(() => ({ error: 'Invalid server response' }));

    if (response.ok) {
      messageDiv.className = 'message success';
      messageDiv.textContent = result.message || 'Access link sent to your email';
      document.getElementById('email').value = '';
    } else {
      messageDiv.className = 'message error';
      messageDiv.textContent = result.error || 'An error occurred';
    }
  } catch (error) {
    messageDiv.className = 'message error';
    messageDiv.textContent = 'Network error: ' + error.message;
  }

  messageDiv.style.display = 'block';
  submitButton.disabled = false;
  submitButton.textContent = 'Send Access Link';
});

