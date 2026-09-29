// After the web build: move bundled fonts out of a folder named "node_modules",
// so deployment tools that skip node_modules folders still upload them.
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', '..', 'server', 'public');
const from = path.join(out, 'assets', 'node_modules');
const to = path.join(out, 'assets', 'vendor');
if (fs.existsSync(from)) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
  const jsDir = path.join(out, '_expo', 'static', 'js', 'web');
  for (const f of fs.readdirSync(jsDir)) {
    const p = path.join(jsDir, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split('/assets/node_modules/').join('/assets/vendor/'));
  }
  console.log('Fonts moved to assets/vendor');
}
