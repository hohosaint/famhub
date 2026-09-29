// When each person was last active (any page or request). Kept in memory and saved to
// last-seen.json in the data folder once a minute, separately from the app data, so it does
// not make every open app reload.
const fs = require('fs');
const path = require('path');

let file = null;
let seen = {};
let dirty = false;

function init(dir) {
  file = path.join(dir, 'last-seen.json');
  try { seen = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { seen = {}; }
  setInterval(flush, 60000).unref();
}
function flush() {
  if (!dirty || !file) return;
  try { fs.writeFileSync(file, JSON.stringify(seen)); dirty = false; } catch (e) { console.error('last-seen save failed', e.message); }
}
function touch(userId) {
  if (!userId) return;
  const now = Date.now();
  if (!seen[userId] || now - seen[userId] > 15000) { seen[userId] = now; dirty = true; }
}
const lastSeen = (userId) => (seen[userId] ? new Date(seen[userId]).toISOString() : '');

module.exports = { init, touch, lastSeen, flush };
