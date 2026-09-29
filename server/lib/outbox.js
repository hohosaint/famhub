// The last 200 emails and WhatsApp messages the app tried to send (kept in memory, for testing).
const MAX = 200;
const log = [];
function remember(entry) {
  log.unshift(entry);
  if (log.length > MAX) log.length = MAX;
  return entry;
}
module.exports = { remember, list: () => log.slice() };
