// WhatsApp alerts to a person's mobile phone.
//
// WhatsApp only lets a business start a conversation with an approved message template.
// Create one template (category "Utility") with two body variables, for example:
//     Name: famhub_alert     Language: English (en)
//     Body: Famhub: {{1}}. {{2}}
// Then choose one way to send (Azure portal > the web app > Environment variables):
//  1. Azure Communication Services Advanced Messaging (recommended on Azure):
//       ACS_CONNECTION_STRING       (from the Communication Service > Keys)
//       ACS_WHATSAPP_CHANNEL_ID     (Communication Service > Channels > WhatsApp > Channel ID)
//  2. Meta WhatsApp Cloud API directly:
//       WHATSAPP_TOKEN              (a permanent system-user access token)
//       WHATSAPP_PHONE_NUMBER_ID    (WhatsApp Manager > Phone numbers > Phone number ID)
// Optional for both: WHATSAPP_TEMPLATE (default famhub_alert), WHATSAPP_TEMPLATE_LANG (default en).
// With neither set, messages are not sent but still appear in the test "Message outbox".

const Outbox = require('./outbox');
const ACS = require('./acs');

function mode() {
  if (process.env.ACS_CONNECTION_STRING && process.env.ACS_WHATSAPP_CHANNEL_ID) return 'acs';
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return 'meta';
  return 'none';
}

// Accepts 9123 4567 (Singapore) or an international number like +60 12 345 6789. Returns +<digits> or ''.
function normalise(number) {
  const digits = String(number || '').replace(/[^\d+]/g, '');
  if (/^[89]\d{7}$/.test(digits)) return `+65${digits}`;
  if (/^65[89]\d{7}$/.test(digits)) return `+${digits}`;
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  return '';
}

// WhatsApp template variables cannot contain new lines, tabs or more than 4 spaces in a row.
const clean = (s, max) => String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, max) || '-';

async function send(to, n) {
  const title = clean(`${n.priority === 'urgent' ? 'URGENT: ' : ''}${n.title}`, 200);
  const body = clean(n.body || 'Open Famhub for details.', 700);
  const template = process.env.WHATSAPP_TEMPLATE || 'famhub_alert';
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const entry = Outbox.remember({ channel: 'whatsapp', id: n.id, to, subject: title, at: new Date().toISOString(), status: 'queued', via: mode(), error: '' });
  try {
    if (entry.via === 'acs') {
      await ACS.post('/messages/notifications:send', '2024-02-01', {
        channelRegistrationId: process.env.ACS_WHATSAPP_CHANNEL_ID,
        to: [to],
        kind: 'template',
        template: {
          name: template, language: lang,
          values: [{ kind: 'text', name: 'title', text: title }, { kind: 'text', name: 'body', text: body }],
          bindings: { kind: 'whatsApp', body: [{ refValue: 'title' }, { refValue: 'body' }] },
        },
      });
      entry.status = 'sent';
    } else if (entry.via === 'meta') {
      const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'template',
          template: { name: template, language: { code: lang }, components: [{ type: 'body', parameters: [{ type: 'text', text: title }, { type: 'text', text: body }] }] },
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j.error && j.error.message) || `HTTP ${res.status}`); }
      entry.status = 'sent';
    } else {
      entry.status = 'not sent (WhatsApp is not set up)';
    }
  } catch (e) {
    entry.status = 'failed';
    entry.error = String(e && e.message ? e.message : e).slice(0, 300);
    console.error('WhatsApp failed:', entry.error);
  }
  return entry;
}

module.exports = { send, mode, normalise };
