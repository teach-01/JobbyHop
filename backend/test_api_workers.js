const http = require('http');

const req = (method, path, body, headers = {}) =>
  new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (data) r.write(data);
    r.end();
  });

async function run() {
  const r = await req('POST', '/auth/login', { email: 'supportjobbyhop@gmail.com', password: 'admin123' });
  const token = r.body.token;
  
  const res = await req('GET', '/admin/workers', null, { Authorization: `Bearer ${token}` });
  console.log(`GET /admin/workers Status: ${res.status}`);
  console.log(`Response length:`, res.body.workers?.length);
  if (res.body.workers?.length > 0) {
    console.log('Sample worker:', JSON.stringify(res.body.workers[0], null, 2));
  }
}
run();
