(async () => {
  try {
    const data = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password',
      role: 'client'
    };

    const res = await fetch('http://127.0.0.1:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const text = await res.text();
    console.log('STATUS', res.status);
    console.log('BODY', text);
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
