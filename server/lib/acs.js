// Calls Azure Communication Services directly over HTTPS (no Azure SDK packages needed).
// Signs each request with the access key from the connection string (HMAC-SHA256), as described in
// "Sign an HTTP request" in the Azure Communication Services documentation.

const crypto = require('crypto');

function parse(connectionString) {
  const parts = Object.fromEntries(String(connectionString || '').split(';').filter(Boolean).map((kv) => {
    const i = kv.indexOf('=');
    return [kv.slice(0, i).trim().toLowerCase(), kv.slice(i + 1).trim()];
  }));
  if (!parts.endpoint || !parts.accesskey) throw new Error('ACS_CONNECTION_STRING must look like endpoint=https://...;accesskey=...');
  return { endpoint: parts.endpoint.replace(/\/$/, ''), key: parts.accesskey };
}

async function post(path, apiVersion, body) {
  const { endpoint, key } = parse(process.env.ACS_CONNECTION_STRING);
  const url = new URL(`${endpoint}${path}?api-version=${apiVersion}`);
  const json = JSON.stringify(body);
  const contentHash = crypto.createHash('sha256').update(json).digest('base64');
  const date = new Date().toUTCString();
  const toSign = `POST\n${url.pathname}${url.search}\n${date};${url.host};${contentHash}`;
  const signature = crypto.createHmac('sha256', Buffer.from(key, 'base64')).update(toSign).digest('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ms-date': date,
      'x-ms-content-sha256': contentHash,
      Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    },
    body: json,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.error && j.error.message) || `Azure Communication Services returned HTTP ${res.status}`);
  }
  return res;
}

module.exports = { post, parse };
