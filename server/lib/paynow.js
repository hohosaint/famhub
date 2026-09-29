// Builds a PayNow QR payload (SGQR / EMVCo format) for paying a mobile number.
// Family members pay each other directly; no money passes through the app.

function tlv(id, value) {
  const v = String(value);
  return id + String(v.length).padStart(2, '0') + v;
}

function crc16(text) {
  // CRC-16/CCITT-FALSE, as required by EMVCo QR codes.
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function payNowPayload({ mobile, amount, name, reference }) {
  const merchantAccount =
    tlv('00', 'SG.PAYNOW') +
    tlv('01', '0') + // proxy type 0 = mobile number
    tlv('02', mobile) +
    tlv('03', '0'); // amount not editable
  let payload =
    tlv('00', '01') +
    tlv('01', '12') + // dynamic QR (one payment)
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '702') + // SGD
    tlv('54', Number(amount).toFixed(2)) +
    tlv('58', 'SG') +
    tlv('59', (name || 'NA').slice(0, 25)) +
    tlv('60', 'Singapore');
  if (reference) payload += tlv('62', tlv('01', String(reference).slice(0, 25)));
  payload += '6304';
  return payload + crc16(payload);
}

function normaliseMobile(input) {
  const digits = String(input || '').replace(/[^\d+]/g, '');
  if (/^\+65[89]\d{7}$/.test(digits)) return digits;
  if (/^65[89]\d{7}$/.test(digits)) return `+${digits}`;
  if (/^[89]\d{7}$/.test(digits)) return `+65${digits}`;
  return null;
}

module.exports = { payNowPayload, normaliseMobile, crc16 };
