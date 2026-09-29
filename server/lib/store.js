// Prototype data store.
// The whole app state is one JSON document, saved either to a file (default)
// or to PostgreSQL when the PG* app settings exist. This keeps the prototype
// simple; production uses the relational schema from the blueprint.

const fs = require('fs');
const path = require('path');
const { seedState, migrate, STATE_VERSION } = require('./seed');

function dataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  // On Azure App Service (Linux) /home is persistent storage.
  if (process.env.WEBSITE_SITE_NAME) return '/home/data';
  return path.join(__dirname, '..', 'data');
}

function fileStore() {
  const dir = dataDir();
  const file = path.join(dir, 'ecare-prototype.json');
  let queue = Promise.resolve();

  function load() {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      const state = seedState();
      fs.writeFileSync(file, JSON.stringify(state, null, 2));
      return state;
    }
    const state = migrate(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (state.version !== STATE_VERSION) {
      // Older prototype data: start again with fresh demo data.
      const fresh = seedState();
      fs.writeFileSync(file, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    return state;
  }

  function save(state) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
  }

  return {
    kind: `file (${file})`,
    async read() { return load(); },
    // Writes run one at a time so two requests cannot overwrite each other.
    update(fn) {
      const run = queue.then(() => {
        const state = load();
        const before = JSON.stringify(state);
        const result = fn(state);
        // Only write (and tell open apps) when something really changed.
        if (JSON.stringify(state) !== before) { save(state); store.changed(); }
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

function pgStore() {
  const { Pool } = require('pg');
  const pool = new Pool({ ssl: { rejectUnauthorized: true }, max: 5 });
  let ready = null;

  function init() {
    if (!ready) {
      ready = (async () => {
        await pool.query(
          `create table if not exists ecare_prototype_state (
             id int primary key,
             data jsonb not null,
             updated_at timestamptz not null default now()
           )`
        );
        await pool.query(
          `insert into ecare_prototype_state (id, data) values (1, $1)
           on conflict (id) do nothing`,
          [JSON.stringify(seedState())]
        );
      })().catch((err) => { ready = null; throw err; });
    }
    return ready;
  }

  return {
    kind: 'PostgreSQL',
    async read() {
      await init();
      const { rows } = await pool.query('select data from ecare_prototype_state where id = 1');
      migrate(rows[0].data);
      if (rows[0].data.version !== STATE_VERSION) {
        const fresh = seedState();
        await pool.query('update ecare_prototype_state set data = $1, updated_at = now() where id = 1', [JSON.stringify(fresh)]);
        return fresh;
      }
      return rows[0].data;
    },
    async update(fn) {
      await init();
      const client = await pool.connect();
      try {
        await client.query('begin');
        const { rows } = await client.query('select data from ecare_prototype_state where id = 1 for update');
        let state = migrate(rows[0].data);
        if (state.version !== STATE_VERSION) state = seedState();
        const before = JSON.stringify(state);
        const result = fn(state);
        const after = JSON.stringify(state);
        if (after !== before) await client.query('update ecare_prototype_state set data = $1, updated_at = now() where id = 1', [after]);
        await client.query('commit');
        if (after !== before) store.changed();
        return result;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

const store = process.env.PGHOST ? pgStore() : fileStore();
// Called after every real change; the server sets this to tell open apps (see /api/live).
store.changed = () => {};
store.filesDir = path.join(dataDir(), 'files');
store.dataDir = dataDir();
fs.mkdirSync(store.filesDir, { recursive: true });
// Replaces everything with fresh demo data (test mode only).
store.reset = () => store.update((state) => { const fresh = seedState(); for (const k of Object.keys(state)) delete state[k]; Object.assign(state, fresh); });
module.exports = store;
