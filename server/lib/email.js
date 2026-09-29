// Email alerts.
// Two ways to send, chosen by app settings (Azure portal > the web app > Environment variables):
//  1. Azure Communication Services Email (recommended on Azure):
//       ACS_CONNECTION_STRING  (from the Communication Service > Keys)
//       ACS_SENDER             (for example DoNotReply@xxxxxxxx.azurecomm.net)
//  2. Any SMTP mail server (for example Outlook.com or Gmail with an app password):
//       SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_FROM
// With neither set, emails are not sent but still appear in the test "Message outbox",
// so the rules can be checked before email is set up.

const Outbox = require('./outbox');
const ACS = require('./acs');
let smtp = null;

function mode() {
  if (process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER) return 'acs';
  if (process.env.SMTP_HOST && process.env.SMTP_FROM) return 'smtp';
  return 'none';
}


const escapeHtml = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(n, appUrl) {
  const link = appUrl ? `${appUrl.replace(/\/$/, '')}/?open=${encodeURIComponent(n.id)}` : '';
  const urgent = n.priority === 'urgent';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:20px;border:1px solid #e6e2da;border-radius:14px">
  <div style="color:#0F766E;font-weight:800;font-size:14px;letter-spacing:.5px">FAMHUB</div>
  <h2 style="margin:8px 0;color:${urgent ? '#B42318' : '#1F2937'}">${escapeHtml(n.title)}</h2>
  ${n.body ? `<p style="font-size:16px;color:#374151;line-height:1.5">${escapeHtml(n.body)}</p>` : ''}
  ${link ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:${urgent ? '#B42318' : '#0F766E'};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open in Famhub</a></p>` : ''}
  <p style="font-size:12px;color:#9CA3AF">You get this email because email alerts are on in Famhub (More &gt; Notification settings).</p></div>`;
  const plain = `${n.title}\n\n${n.body || ''}\n\n${link ? `Open in Famhub: ${link}\n\n` : ''}You get this email because email alerts are on in Famhub.`;
  return { subject: `${urgent ? 'URGENT: ' : ''}${n.title}`, html, plain };
}

async function send(to, n, appUrl) {
  const { subject, html, plain } = render(n, appUrl);
  const entry = Outbox.remember({ channel: 'email', id: n.id, to, subject, at: new Date().toISOString(), status: 'queued', via: mode(), error: '' });
  try {
    if (entry.via === 'acs') {
      await ACS.post('/emails:send', '2023-03-31', {
        senderAddress: process.env.ACS_SENDER,
        recipients: { to: [{ address: to }] },
        content: { subject, html, plainText: plain },
      });
      entry.status = 'sent';
    } else if (entry.via === 'smtp') {
      if (!smtp) {
        let nodemailer;
        try { nodemailer = require('nodemailer'); } catch { throw new Error('The nodemailer package is not installed. Run npm install in the server folder.'); }
        const port = Number(process.env.SMTP_PORT || 587);
        smtp = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
      }
      await smtp.sendMail({ from: process.env.SMTP_FROM, to, subject, html, text: plain });
      entry.status = 'sent';
    } else {
      entry.status = 'not sent (email is not set up)';
    }
  } catch (e) {
    entry.status = 'failed';
    entry.error = String(e && e.message ? e.message : e).slice(0, 300);
    console.error('Email failed:', entry.error);
  }
  return entry;
}

// A plain message that is not a notification (for example a password reset link).
async function sendRaw(to, subject, plain, link) {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:20px;border:1px solid #e4e7ec;border-radius:14px">
  <div style="color:#1D5FD8;font-weight:800;font-size:14px;letter-spacing:.5px">FAMHUB</div>
  <h2 style="margin:8px 0;color:#101828">${escapeHtml(subject)}</h2>
  <p style="font-size:16px;color:#374151;line-height:1.5;white-space:pre-line">${escapeHtml(plain.replace(link, '').trim())}</p>
  ${link ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1D5FD8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Choose a new password</a></p>` : ''}</div>`;
  const entry = Outbox.remember({ channel: 'email', id: `raw-${Date.now()}`, to, subject, at: new Date().toISOString(), status: 'queued', via: mode(), error: '' });
  try {
    if (entry.via === 'acs') {
      await ACS.post('/emails:send', '2023-03-31', { senderAddress: process.env.ACS_SENDER, recipients: { to: [{ address: to }] }, content: { subject, html, plainText: plain } });
      entry.status = 'sent';
    } else if (entry.via === 'smtp') {
      if (!smtp) {
        const nodemailer = require('nodemailer');
        const port = Number(process.env.SMTP_PORT || 587);
        smtp = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
      }
      await smtp.sendMail({ from: process.env.SMTP_FROM, to, subject, html, text: plain });
      entry.status = 'sent';
    } else entry.status = 'not sent (email is not set up)';
  } catch (e) { entry.status = 'failed'; entry.error = String(e && e.message ? e.message : e).slice(0, 300); console.error('Email failed:', entry.error); }
  return entry;
}

module.exports = { send, sendRaw, mode };
