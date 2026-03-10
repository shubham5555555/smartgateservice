const fetch = global.fetch || require('node-fetch');
require('dotenv').config({ path: '../.env' });

const API_BASE = process.env.API_BASE || 'http://localhost:5050';

async function smoke() {
  console.log('Checking public buildings endpoint...');
  const b = await fetch(`${API_BASE}/buildings/public`);
  console.log('buildings/public status', b.status);

  console.log('Registering a visitor (self-register)...');
  const registerRes = await fetch(`${API_BASE}/visitors/self-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Integration Visitor',
      phoneNumber: '9222222222',
      type: 'Guest',
      residentEmail: 'resident@local.test',
      purpose: 'Integration test',
      expectedDate: new Date().toISOString(),
      expectedTime: '12:00',
    }),
  });
  console.log('self-register status', registerRes.status);
  const regBody = await registerRes.json().catch(() => ({}));
  console.log('self-register response:', regBody);

  console.log('Checking visitor status by phone...');
  const statusRes = await fetch(`${API_BASE}/visitors/status/9222222222`);
  console.log('status endpoint status', statusRes.status);
  const statusBody = await statusRes.json().catch(() => ({}));
  console.log('status response:', statusBody);
}

smoke().catch((err) => {
  console.error(err);
  process.exit(1);
});

