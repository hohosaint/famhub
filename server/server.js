// Famhub web prototype 4.7: serves the web app (public/) and the API (/api/*).
// Full-featured test version: roles, invites, calendar, tasks, notes, medicines,
// costs with statements and PayNow, documents, renewals, check-ins and alerts.

const fs = require('fs');
const path = require('path');
const { randomUUID, randomInt } = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const store = require('./lib/store');
const Seen = require('./lib/seen');
Seen.init(store.dataDir);
const { payNowPayload, normaliseMobile } = require('./lib/paynow');
const PAY = require('./lib/payments');
const A = require('./lib/auth');
const { currentUser, testModeAllowed, DEMO_USERS } = A;
const L = require('./lib/logic');
const R = require('./lib/recur');
const P = require('./lib/profile');
const F = require('./lib/formulas');
const BF = require('./lib/babyfoods');
const { addDemoCircle } = require('./lib/seed');
const N = require('./lib/notify');
const Email = require('./lib/email');
const WhatsApp = require('./lib/whatsapp');
const Outbox = require('./lib/outbox');

// Push notifications: keys are created once and kept in the data folder.
const VAPID_PUBLIC_KEY = N.initPush(store.dataDir);

// After every saved change, send any queued pushes and forget dead subscriptions.
const rawUpdate = store.update.bind(store);
async function flushPushes() {
  const gone = await N.flush();
  if (gone.length) await rawUpdate((state) => { state.pushSubs = state.pushSubs.filter((x) => !gone.includes(x.subscription.endpoint)); });
}
store.update = async (fn) => { const r = await rawUpdate(fn); setImmediate(() => flushPushes().catch((e) => console.error(e))); return r; };

const app = express();
app.use(express.json({ limit: '200kb' }));

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'",
  });
  next();
});

// ---------- helpers ----------

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const text = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
const money = (v) => Math.round(Number(v) * 100) / 100;

function me(req) {
  const u = currentUser(req);
  if (!u) fail(401, 'Please sign in.');
  Seen.touch(u.id);
  return u;
}

// Makes sure the person has a profile.
function ensureUser(state, user) {
  let u = state.users.find((x) => x.id === user.id);
  if (!u) { u = { id: user.id, name: user.name, paynow: '', ...(user.id.startsWith('test-') ? { test: true } : {}) }; state.users.push(u); }
  return u;
}

function log(state, circleId, userId, message) {
  state.activity.push({ id: randomUUID(), circleId, userId, text: message, createdAt: new Date().toISOString() });
  if (state.activity.length > 1000) state.activity = state.activity.slice(-1000);
}

// Runs a change inside one circle after checking membership and permission.
function inCircle(req, action, fn) {
  const user = me(req);
  return store.update((state) => {
    ensureUser(state, user);
    const circle = state.circles.find((c) => c.id === req.params.circleId);
    const member = circle && state.members.find((m) => m.circleId === circle.id && m.userId === user.id);
    if (!member) fail(404, 'Care circle not found, or you are not a member.');
    if (action && !L.can(member.role, action)) fail(403, `Your role (${member.role}) cannot do this.`);
    const name = L.userName(state, user.id);
    const notify = (spec) => N.notify(state, { circleId: circle.id, except: user.id, ...spec });
    const who = (...roles) => N.people(state, circle.id, roles);
    return fn({ state, circle, member, role: member.role, userId: user.id, name, notify, who, say: (m) => log(state, circle.id, user.id, `${name} ${m}`) });
  });
}

function find(list, id, circleId, what) {
  const item = list.find((x) => x.id === id && x.circleId === circleId);
  if (!item) fail(404, `${what} not found.`);
  return item;
}

// ---------- session, test mode ----------

// When this version was built (the web pages) and when the server started, shown in the app under the profile button.
const APP_VERSION = '4.8';
const STARTED_AT = new Date().toISOString();
let BUILT_AT = '';
try { BUILT_AT = fs.statSync(path.join(__dirname, 'public', 'index.html')).mtime.toISOString(); } catch { /* no pages yet */ }

app.get('/api/health', wrap(async (req, res) => {
  await store.read();
  res.json({ status: 'ok', storage: store.kind.startsWith('file') ? 'file' : 'database', version: APP_VERSION, mode: A.isLive() ? 'live' : 'test', builtAt: BUILT_AT, startedAt: STARTED_AT });
}));

app.get('/api/session', wrap(async (req, res) => {
  const user = me(req);
  const data = await store.update((state) => {
    if ((user.id.startsWith('test-') || A.ACCOUNT_ID.test(user.id)) && !state.users.some((x) => x.id === user.id)) return null;
    const u = ensureUser(state, user);
    const circles = state.members.filter((m) => m.userId === user.id).map((m) => {
      const c = state.circles.find((x) => x.id === m.circleId);
      return { id: c.id, name: c.name, role: m.role, careFor: (c.profile && c.profile.careFor) || 'elder', parentName: c.parentName };
    });
    A.ensureUsernames(state);
    const testing = user.source === 'test mode' ? profileLabel(state, u) : '';
    return { user: { id: u.id, name: u.name, username: u.username || '', email: u.email || '', account: !!u.account, paynow: u.paynow, source: user.source, testingAs: testing }, circles };
  });
  if (!data) { A.clearSession(req, res); fail(401, 'This account was removed. Please sign in again.'); }
  const testMode = testModeAllowed(req);
  res.json({ ...data, testMode, mode: A.isLive() ? 'live' : 'test', microsoft: !!A.signedIn(req), demoUsers: testMode ? DEMO_USERS.map(({ id, label }) => ({ id, label })) : [] });
}));

// ---------- sign in and sign out ----------

// What the sign-in page offers.
app.get('/api/auth/options', wrap(async (req, res) => {
  const ms = A.signedIn(req);
  const testMode = testModeAllowed(req);
  let accounts = [];
  if (testMode) {
    accounts = await store.update((state) => {
      A.ensureUsernames(state);
      return state.users.filter(isTestUser).map((u) => ({ username: u.username, name: u.name, label: profileLabel(state, u) }));
    });
  }
  res.json({ testMode, mode: A.isLive() ? 'live' : 'test', emailReset: Email.mode() !== 'none', signedIn: !!currentUser(req), microsoft: ms ? { name: ms.name, email: ms.email } : null, accounts });
}));

const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v || '');

app.post('/api/auth/login', wrap(async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!testModeAllowed(req)) {
    // Live mode: sign in with the email (or username) and password of a real account.
    if (A.tooManyFailures(ip)) fail(429, 'Too many wrong passwords. Wait 10 minutes and try again.');
    const who = text(req.body.email || req.body.username, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const state = await store.read();
    const user = state.users.find((u) => u.account && (u.email === who || u.username === who)) || null;
    if (!user || !user.passwordHash || !A.checkPassword(user, password)) { A.noteFailure(ip); fail(401, 'Wrong email or password.'); }
    const token = A.setSession(req, res, user.id, 'account');
    return res.json({ ok: true, name: user.name, token });
  }
  if (A.tooManyFailures(ip)) fail(429, 'Too many wrong passwords. Wait 10 minutes and try again.');
  const username = text(req.body.username, 40).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await store.update((state) => {
    A.ensureUsernames(state);
    return state.users.find((u) => (isTestUser(u) || u.account) && (u.username === username || (u.account && u.email === username))) || null;
  });
  if (!user || !A.checkPassword(user, password)) { A.noteFailure(ip); fail(401, 'Wrong username or password.'); }
  const token = A.setSession(req, res, user.id, user.account ? 'account' : 'test');
  res.json({ ok: true, name: user.name, token });
}));

// Test mode: anyone can register a new account (name, username, password) and then set up
// or join a circle. Accounts made here are test profiles (they show in Profiles and can be removed).
app.post('/api/auth/register', wrap(async (req, res) => {
  const ip = req.ip || 'unknown';
  if (A.tooManyFailures(ip)) fail(429, 'Too many tries. Wait 10 minutes and try again.');
  const name = text(req.body.name, 40);
  if (!name) fail(400, 'Enter your name.');
  if (typeof req.body.password !== 'string' || req.body.password.length < 8) fail(400, 'Password must be at least 8 characters.');
  if (!testModeAllowed(req)) {
    // Live mode: a real account with an email address. They then set up a circle or join one with an invite code.
    const email = text(req.body.email, 120).toLowerCase();
    if (!isEmail(email)) fail(400, 'Enter a valid email address.');
    if (process.env.REGISTRATION === 'closed') fail(403, 'New sign-ups are closed. Ask the Famhub admin.');
    const user = await store.update((state) => {
      if (state.users.some((u) => u.account && u.email === email)) fail(400, 'An account with this email already exists. Sign in, or use "Forgot password".');
      const u = { id: `u-${randomUUID().replace(/-/g, '').slice(0, 12)}`, name, email, paynow: '', account: true, createdAt: new Date().toISOString() };
      u.username = A.usernameFrom(name, new Set(state.users.map((x) => x.username).filter(Boolean)));
      u.passwordHash = A.hashPassword(req.body.password);
      state.users.push(u);
      state.prefs = state.prefs || {};
      state.prefs[u.id] = { email: { address: email, on: false } };
      return u;
    });
    const token = A.setSession(req, res, user.id, 'account');
    return res.status(201).json({ ok: true, name: user.name, token });
  }
  const user = await store.update((state) => {
    A.ensureUsernames(state);
    if (state.users.filter((u) => u.test).length >= 100) fail(400, 'The test site has reached 100 accounts. Remove some in Profiles first.');
    const u = { id: `test-${randomUUID().replace(/-/g, '').slice(0, 10)}`, name, paynow: '', test: true, selfRegistered: true, createdAt: new Date().toISOString() };
    const email = text(req.body.email, 120).toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'That email address does not look right.');
    if (text(req.body.username, 24)) setLogin(state, u, { username: req.body.username });
    else u.username = A.usernameFrom(name, new Set(state.users.map((x) => x.username).filter(Boolean)));
    setLogin(state, u, { password: req.body.password });
    state.users.push(u);
    // The email is filled in on Notification settings > Email alerts (off until they turn it on).
    if (email) { state.prefs = state.prefs || {}; state.prefs[u.id] = { email: { address: email, on: false } }; }
    return u;
  });
  const token = A.setSession(req, res, user.id, 'test');
  res.status(201).json({ ok: true, name: user.name, username: user.username, token });
}));

// Forgot password: emails a link that works for one hour (needs email set up; see Email alerts).
app.post('/api/auth/forgot', wrap(async (req, res) => {
  const ip = req.ip || 'unknown';
  if (A.tooManyFailures(ip)) fail(429, 'Too many tries. Wait 10 minutes and try again.');
  A.noteFailure(ip); // every request counts, so the form cannot be used to spam
  const email = text(req.body.email, 120).toLowerCase();
  if (Email.mode() === 'none') fail(400, 'Password reset by email is not set up on this site yet. Ask the Famhub admin to reset your password.');
  const state = await store.read();
  const user = state.users.find((u) => u.account && u.email === email);
  if (user) {
    const base = process.env.APP_URL || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : `${req.protocol}://${req.get('host')}`);
    const link = `${base.replace(/\/$/, '')}/?reset=${encodeURIComponent(A.resetToken(user))}`;
    Email.sendRaw(email, 'Reset your Famhub password', `Hello ${user.name},\n\nTap the link below to choose a new password. It works for one hour.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`, link).catch(() => {});
  }
  // The same answer either way, so nobody can find out which emails have accounts.
  res.json({ ok: true });
}));

app.post('/api/auth/reset', wrap(async (req, res) => {
  const t = A.readResetToken(req.body.token);
  if (!t) fail(400, 'This link has expired or was already used. Ask for a new one.');
  if (typeof req.body.password !== 'string' || req.body.password.length < 8) fail(400, 'Password must be at least 8 characters.');
  const user = await store.update((state) => {
    const u = state.users.find((x) => x.id === t.u && x.account);
    if (!u || (u.passwordHash || '').slice(0, 12) !== t.h) fail(400, 'This link has expired or was already used. Ask for a new one.');
    u.passwordHash = A.hashPassword(req.body.password);
    return u;
  });
  const token = A.setSession(req, res, user.id, 'account');
  res.json({ ok: true, token });
}));

app.post('/api/me/password', wrap(async (req, res) => {
  const user = me(req);
  if (typeof req.body.password !== 'string' || req.body.password.length < 8) fail(400, 'The new password must be at least 8 characters.');
  await store.update((state) => {
    const u = state.users.find((x) => x.id === user.id && x.account);
    if (!u) fail(400, 'This account signs in another way.');
    if (!A.checkPassword(u, req.body.current)) fail(400, 'Your current password is not right.');
    u.passwordHash = A.hashPassword(req.body.password);
  });
  res.json({ ok: true });
}));

// In test mode on Azure, a person signed in with Microsoft can continue as themselves.
app.post('/api/auth/microsoft', (req, res) => {
  const ms = A.signedIn(req);
  if (!ms) return res.status(400).json({ error: 'You are not signed in with Microsoft.' });
  const token = A.setSession(req, res, ms.id, 'microsoft');
  res.json({ ok: true, token });
});

// Plain link version: clears the session and goes back to the sign-in page (works even if scripts fail).
app.get('/api/auth/logout', (req, res) => {
  A.clearSession(req, res);
  res.set('Cache-Control', 'no-store');
  const microsoft = !!A.signedIn(req) && (!testModeAllowed(req) || req.query.everywhere === '1');
  res.redirect(302, microsoft ? '/.auth/logout?post_logout_redirect_uri=/' : '/?signedout=1');
});

app.post('/api/auth/logout', (req, res) => {
  A.clearSession(req, res);
  // Without test mode the only sign-in is Microsoft, so the app must also sign out there.
  res.json({ ok: true, microsoftLogout: !!A.signedIn(req) && (!testModeAllowed(req) || req.body.everywhere === true) });
});

// ---------- test profiles (test mode only) ----------
// Every demo person and every profile created here can be switched to, like accounts in an app.

const ROLE_WORD = { owner: 'owner', family: 'family', helper: 'helper', parent: 'parent' };
const isTestUser = (u) => u && (u.demo || u.test);

function profileLabel(state, u) {
  const roles = [...new Set(state.members.filter((m) => m.userId === u.id).map((m) => ROLE_WORD[m.role]))];
  return `${u.name}${roles.length ? ` (${roles.join(', ')})` : ' (no circle yet)'}`;
}

function profilesView(state) {
  const circles = state.circles.map((c) => ({ id: c.id, name: c.name, parentName: c.parentName }));
  const profiles = state.users.filter(isTestUser).map((u) => ({
    id: u.id, name: u.name, username: u.username || '', customPassword: !!u.passwordHash, builtIn: !!u.demo, label: profileLabel(state, u),
    memberships: state.members.filter((m) => m.userId === u.id).map((m) => ({ circleId: m.circleId, role: m.role })),
    unread: state.notifications.filter((n) => n.userId === u.id && !n.readAt).length,
    urgent: state.notifications.some((n) => n.userId === u.id && !n.readAt && n.priority === 'urgent'),
  }));
  return { profiles, circles };
}

function testOnly(req) { if (!testModeAllowed(req)) fail(403, 'Test mode is off.'); me(req); }

function setLogin(state, u, body) {
  if (body.username !== undefined) {
    const un = text(body.username, 24).toLowerCase();
    if (!/^[a-z0-9._-]{3,24}$/.test(un)) fail(400, 'Username must be 3 to 24 letters or numbers (no spaces).');
    if (state.users.some((x) => x !== u && x.username === un)) fail(400, `The username "${un}" is taken.`);
    u.username = un;
  }
  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 8) fail(400, 'Password must be at least 8 characters.');
    u.passwordHash = A.hashPassword(body.password);
  }
  if (body.resetPassword === true) delete u.passwordHash;
}

function setMembership(state, userId, circleId, role) {
  const circle = state.circles.find((c) => c.id === circleId);
  if (!circle) fail(404, 'Care circle not found.');
  const current = state.members.find((m) => m.circleId === circleId && m.userId === userId);
  const owners = state.members.filter((m) => m.circleId === circleId && m.role === 'owner');
  if (current && current.role === 'owner' && role !== 'owner' && owners.length === 1) fail(400, `${circle.name} needs at least one owner. Make someone else owner first.`);
  if (!role) { if (current) state.members = state.members.filter((m) => m !== current); return; }
  if (!ROLE_WORD[role]) fail(400, 'Choose owner, family, helper or parent.');
  if (current) current.role = role;
  else state.members.push({ circleId, userId, role, joinedAt: new Date().toISOString() });
}

app.get('/api/test/profiles', wrap(async (req, res) => {
  testOnly(req);
  res.json(await store.update((state) => { A.ensureUsernames(state); return profilesView(state); }));
}));

app.post('/api/test/profiles', wrap(async (req, res) => {
  testOnly(req);
  const name = text(req.body.name, 40);
  if (!name) fail(400, 'Enter a name for the profile.');
  const out = await store.update((state) => {
    if (state.users.filter((u) => u.test).length >= 30) fail(400, 'You can have up to 30 test profiles. Remove some first.');
    const id = `test-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    A.ensureUsernames(state);
    const u = { id, name, paynow: '', test: true, createdAt: new Date().toISOString() };
    state.users.push(u);
    if (text(req.body.username, 24)) setLogin(state, u, { username: req.body.username });
    else u.username = A.usernameFrom(name, new Set(state.users.map((x) => x.username).filter(Boolean)));
    setLogin(state, u, { password: req.body.password });
    if (req.body.circleId) setMembership(state, id, text(req.body.circleId, 60), text(req.body.role, 10) || 'family');
    return { id, ...profilesView(state) };
  });
  res.status(201).json(out);
}));

app.patch('/api/test/profiles/:id', wrap(async (req, res) => {
  testOnly(req);
  const out = await store.update((state) => {
    const u = state.users.find((x) => x.id === req.params.id);
    if (!isTestUser(u)) fail(404, 'Profile not found.');
    const name = text(req.body.name, 40);
    if (name) u.name = name;
    setLogin(state, u, req.body);
    if (req.body.circleId) setMembership(state, u.id, text(req.body.circleId, 60), text(req.body.role, 10));
    return profilesView(state);
  });
  res.json(out);
}));

app.delete('/api/test/profiles/:id', wrap(async (req, res) => {
  testOnly(req);
  const out = await store.update((state) => {
    const u = state.users.find((x) => x.id === req.params.id);
    if (!u || !u.test) fail(400, 'Only profiles you created can be removed. Use "Reset demo data" to restore the demo people.');
    for (const m of state.members.filter((x) => x.userId === u.id)) setMembership(state, u.id, m.circleId, '');
    state.users = state.users.filter((x) => x !== u);
    state.notifications = state.notifications.filter((n) => n.userId !== u.id);
    state.pushSubs = (state.pushSubs || []).filter((x) => x.userId !== u.id);
    return profilesView(state);
  });
  res.json(out);
}));

// Switch profile without typing a password (test mode, already signed in).
app.post('/api/test/user', wrap(async (req, res) => {
  testOnly(req);
  const id = text(req.body.userId, 60);
  if (!id) {
    if (!A.signedIn(req)) fail(400, 'You are not signed in with Microsoft on this site.');
    const token = A.setSession(req, res, A.signedIn(req).id, 'microsoft');
    return res.json({ ok: true, token });
  }
  const state = await store.read();
  if (!isTestUser(state.users.find((u) => u.id === id)) && !DEMO_USERS.some((u) => u.id === id)) fail(400, 'Unknown test profile.');
  const token = A.setSession(req, res, id, 'test');
  res.json({ ok: true, token });
}));

app.post('/api/test/reset', wrap(async (req, res) => {
  testOnly(req);
  await store.reset();
  res.json({ ok: true });
}));

app.patch('/api/me', wrap(async (req, res) => {
  const user = me(req);
  const name = text(req.body.name, 40);
  let paynow = req.body.paynow === undefined ? undefined : text(req.body.paynow, 20);
  if (paynow) { paynow = normaliseMobile(paynow); if (!paynow) fail(400, 'PayNow mobile must be a Singapore mobile number, for example 9123 4567.'); }
  const u = await store.update((state) => {
    const u = ensureUser(state, user);
    if (name) u.name = name;
    if (paynow !== undefined) u.paynow = paynow || '';
    return u;
  });
  res.json(u);
}));

// ---------- circles, invites, members ----------

app.post('/api/circles', wrap(async (req, res) => {
  const user = me(req);
  const withDemo = req.body.withDemoData === true;
  if (withDemo && A.isLive()) fail(403, 'Sample data is only available in test mode.');
  const id = await store.update((state) => {
    const u = ensureUser(state, user);
    if (withDemo) {
      const cid = addDemoCircle(state, user.id, u.name);
      log(state, cid, user.id, `${u.name} created the demo circle`);
      return cid;
    }
    const name = text(req.body.name, 60);
    const parentName = text(req.body.parentName, 40);
    if (!name || !parentName) fail(400, 'Enter a circle name and the parent\'s name.');
    const cid = randomUUID();
    // A care profile (from the launch wizard) sets the check-in time and a starter plan.
    const pl = req.body.profile ? P.plan(req.body.profile) : null;
    const checkinBy = isTime(req.body.checkinBy) ? req.body.checkinBy : pl ? pl.checkinBy : '10:00';
    const isBaby = pl && pl.profile.careFor === 'baby';
    state.circles.push({ id: cid, name, parentName, parentPhone: text(req.body.parentPhone, 20), checkinBy: isBaby || pl && pl.profile.careFor === 'kid' ? '' : checkinBy, emergencyContacts: [], createdAt: new Date().toISOString(), ...(pl ? { profile: pl.profile } : {}),
      ...(isBaby ? { baby: { feedEvery: req.body.feedEvery !== undefined ? Math.max(0, Math.min(8, Number(req.body.feedEvery) || 0)) : pl.feedEvery }, babies: newBabies(req.body, parentName) } : {}) });
    state.members.push({ circleId: cid, userId: user.id, role: 'owner', joinedAt: new Date().toISOString() });
    if (pl) addStarterTasks(state, cid, user.id, pl, req.body.tasks);
    log(state, cid, user.id, `${u.name} created the circle`);
    return cid;
  });
  res.status(201).json({ id });
}));

// Starter requests from the care plan (only the ones ticked in the wizard).
function addStarterTasks(state, circleId, userId, pl, picked) {
  const want = new Set(Array.isArray(picked) ? picked : pl.tasks.map((t) => t.key));
  const already = new Set(state.tasks.filter((t) => t.circleId === circleId && t.planKey).map((t) => t.planKey));
  let n = 0;
  for (const t of pl.tasks) {
    if (!want.has(t.key) || already.has(t.key)) continue;
    const due = new Date(Date.now() + 8 * 3600e3 + t.days * 86400e3).toISOString().slice(0, 10);
    state.tasks.push({ id: randomUUID(), circleId, title: t.title, category: t.category, dueDate: due, dueTime: '', assigneeUserId: '', status: 'open', createdBy: userId, createdAt: new Date().toISOString(), doneBy: '', doneAt: '', planKey: t.key, fileIds: [] });
    n += 1;
  }
  return n;
}

// The choices for the launch wizard, and the plan for a profile.
app.get('/api/profile/catalogue', (req, res) => res.json({ stages: P.STAGES, living: P.LIVING, needs: P.NEEDS, baby: { stages: P.BABY_STAGES, living: P.BABY_LIVING, needs: P.BABY_NEEDS }, kid: { stages: P.KID_STAGES, living: P.KID_LIVING, needs: P.KID_NEEDS }, teen: { stages: P.TEEN_STAGES, living: P.TEEN_LIVING, needs: P.TEEN_NEEDS } }));
app.post('/api/profile/plan', (req, res) => res.json(P.plan(req.body.profile)));

// Change the care profile of a circle later (More > Care profile).
app.post('/api/circles/:circleId/profile', wrap(async (req, res) => {
  const out = await inCircle(req, 'editCircle', ({ state, circle, userId, say }) => {
    const pl = P.plan(req.body.profile);
    circle.profile = pl.profile;
    if (isTime(req.body.checkinBy)) circle.checkinBy = req.body.checkinBy;
    const added = addStarterTasks(state, circle.id, userId, pl, req.body.tasks || []);
    say(`updated ${circle.parentName}'s care profile${added ? ` and added ${added} starter request${added === 1 ? '' : 's'}` : ''}`);
    return { circle, added };
  });
  res.json(out);
}));

app.post('/api/invites/accept', wrap(async (req, res) => {
  const user = me(req);
  const code = text(req.body.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const result = await store.update((state) => {
    const u = ensureUser(state, user);
    const inv = state.invites.find((i) => i.code === code);
    if (!inv) fail(404, 'That invite code was not found. Check it and try again.');
    if (inv.usedAt) fail(400, 'That invite code has already been used.');
    if (new Date(inv.expiresAt) < new Date()) fail(400, 'That invite code has expired. Ask for a new one.');
    if (state.members.some((m) => m.circleId === inv.circleId && m.userId === user.id)) fail(400, 'You are already in this circle.');
    state.members.push({ circleId: inv.circleId, userId: user.id, role: inv.role, joinedAt: new Date().toISOString() });
    inv.usedAt = new Date().toISOString();
    inv.usedBy = user.id;
    log(state, inv.circleId, user.id, `${u.name} joined as ${inv.role}`);
    N.notify(state, { circleId: inv.circleId, to: N.people(state, inv.circleId, ['owner', 'family']), except: user.id, category: 'updates', title: `${u.name} joined the circle`, body: `As ${inv.role}.`, tab: 'circle' });
    return { circleId: inv.circleId };
  });
  res.json(result);
}));

// Everything the app needs for one circle, filtered by role.
app.get('/api/circles/:circleId', wrap(async (req, res) => {
  const view = await inCircle(req, null, ({ state, circle, member, role, userId , notify, who }) => {
    const c = circle.id;
    const canList = Object.fromEntries(Object.keys(L.CAN).map((k) => [k, L.can(role, k)]));
    const members = state.members.filter((m) => m.circleId === c).map((m) => {
      const u = state.users.find((x) => x.id === m.userId) || { name: '?', paynow: '' };
      return { userId: m.userId, name: u.name, role: m.role, paynow: L.can(role, 'seePayNow') ? u.paynow : '', placeholder: Boolean(u.placeholder), demo: Boolean(u.demo) };
    });
    const lastSeen = (state.reads[userId] || {})[c] || '';
    const activity = state.activity.filter((a) => a.circleId === c).slice(-40).reverse().map((a) => ({ ...a, unread: a.createdAt > lastSeen && a.userId !== userId }));
    const checkins = state.checkins.filter((x) => x.circleId === c);
    const view = {
      circle, role, can: canList,
      me: { userId, name: L.userName(state, userId), paynow: (state.users.find((u) => u.id === userId) || {}).paynow || '', email: (state.users.find((u) => u.id === userId) || {}).email || '', account: !!(state.users.find((u) => u.id === userId) || {}).account },
      members,
      appointments: state.appointments.filter((x) => x.circleId === c).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      tasks: state.tasks.filter((x) => x.circleId === c),
      notes: state.notes.filter((x) => x.circleId === c).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 150),
      medications: state.medications.filter((x) => x.circleId === c),
      dosesToday: L.dosesToday(state, c),
      lastCheckin: checkins.filter((x) => x.kind === 'ok').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null,
      openHelp: checkins.filter((x) => x.kind === 'help' && !x.resolvedAt),
      alerts: L.alerts(state, c, userId, role),
      activity,
      unreadCount: activity.filter((a) => a.unread).length,
      documents: state.documents.filter((d) => d.circleId === c && (L.can(role, 'seeAllDocuments') || (role === 'helper' && d.shareWithHelper))),
      carePlan: circle.profile ? P.plan(circle.profile) : null,
      baby: circle.profile && circle.profile.careFor === 'baby' ? babyView(state, circle) : null,
      visits: L.can(role, 'seeVisits') ? (state.visits || []).filter((v) => v.circleId === c).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).map((v) => ({
        ...v, files: (v.fileIds || []).map((id) => { const f = state.files.find((x) => x.id === id); return f ? { id, name: f.name, type: f.type } : null; }).filter(Boolean),
      })) : [],
    };
    if (L.can(role, 'seeMoney')) {
      view.expenses = state.expenses.filter((x) => x.circleId === c).sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
      view.balances = L.balances(state, c);
    }
    if (L.can(role, 'seeRenewals')) view.renewals = state.renewals.filter((x) => x.circleId === c).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (L.can(role, 'invite')) view.invites = state.invites.filter((i) => i.circleId === c && !i.usedAt && new Date(i.expiresAt) > new Date());
    return view;
  });
  res.json(view);
}));

app.patch('/api/circles/:circleId', wrap(async (req, res) => {
  const c = await inCircle(req, 'editCircle', ({ circle, say }) => {
    if (req.body.name !== undefined) circle.name = text(req.body.name, 60) || circle.name;
    if (req.body.parentName !== undefined) circle.parentName = text(req.body.parentName, 40) || circle.parentName;
    if (req.body.parentPhone !== undefined) circle.parentPhone = text(req.body.parentPhone, 20);
    if (req.body.checkinBy !== undefined) { if (!isTime(req.body.checkinBy)) fail(400, 'Check-in time must look like 10:00.'); circle.checkinBy = req.body.checkinBy; }
    if (Array.isArray(req.body.emergencyContacts)) {
      circle.emergencyContacts = req.body.emergencyContacts.slice(0, 5).map((x) => ({ name: text(x.name, 40), phone: text(x.phone, 20), relation: text(x.relation, 30) })).filter((x) => x.name && x.phone);
    }
    say('updated the circle settings');
    return circle;
  });
  res.json(c);
}));

app.post('/api/circles/:circleId/invites', wrap(async (req, res) => {
  const inv = await inCircle(req, 'invite', ({ state, circle, role, userId, say , notify, who }) => {
    const want = L.ROLES.includes(req.body.role) ? req.body.role : 'family';
    if (want === 'owner' && role !== 'owner') fail(403, 'Only an owner can invite another owner.');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (state.invites.some((i) => i.code === code));
    const item = { code, circleId: circle.id, role: want, createdBy: userId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400e3).toISOString() };
    state.invites.push(item);
    say(`created an invite code for a new ${want}`);
    return item;
  });
  res.status(201).json(inv);
}));

app.delete('/api/circles/:circleId/invites/:code', wrap(async (req, res) => {
  await inCircle(req, 'invite', ({ state, circle , notify, who }) => {
    state.invites = state.invites.filter((i) => !(i.circleId === circle.id && i.code === req.params.code));
  });
  res.status(204).end();
}));

// Add a person who will not sign in (for example a helper without a phone).
app.post('/api/circles/:circleId/people', wrap(async (req, res) => {
  const p = await inCircle(req, 'manageMembers', ({ state, circle, say , notify, who }) => {
    const name = text(req.body.name, 40);
    const role = ['family', 'helper', 'parent'].includes(req.body.role) ? req.body.role : 'family';
    if (!name) fail(400, 'Enter a name.');
    const id = `person-${randomUUID()}`;
    state.users.push({ id, name, paynow: '', placeholder: true });
    state.members.push({ circleId: circle.id, userId: id, role, joinedAt: new Date().toISOString() });
    say(`added ${name} as ${role}`);
    return { userId: id, name, role };
  });
  res.status(201).json(p);
}));

app.patch('/api/circles/:circleId/members/:userId', wrap(async (req, res) => {
  const m = await inCircle(req, 'manageMembers', ({ state, circle, say , notify, who }) => {
    const target = state.members.find((x) => x.circleId === circle.id && x.userId === req.params.userId);
    if (!target) fail(404, 'Member not found.');
    const role = req.body.role;
    if (!L.ROLES.includes(role)) fail(400, 'Unknown role.');
    const owners = state.members.filter((x) => x.circleId === circle.id && x.role === 'owner');
    if (target.role === 'owner' && role !== 'owner' && owners.length === 1) fail(400, 'A circle needs at least one owner. Make someone else owner first.');
    target.role = role;
    say(`changed ${L.userName(state, target.userId)} to ${role}`);
    return target;
  });
  res.json(m);
}));

app.delete('/api/circles/:circleId/members/:userId', wrap(async (req, res) => {
  await inCircle(req, null, ({ state, circle, role, userId, say , notify, who }) => {
    const leaving = req.params.userId === userId;
    if (!leaving && role !== 'owner') fail(403, 'Only an owner can remove people.');
    const target = state.members.find((x) => x.circleId === circle.id && x.userId === req.params.userId);
    if (!target) fail(404, 'Member not found.');
    const owners = state.members.filter((x) => x.circleId === circle.id && x.role === 'owner');
    if (target.role === 'owner' && owners.length === 1) fail(400, 'The last owner cannot leave. Make someone else owner first.');
    state.members = state.members.filter((x) => x !== target);
    say(leaving ? 'left the circle' : `removed ${L.userName(state, target.userId)}`);
  });
  res.status(204).end();
}));

app.post('/api/circles/:circleId/seen', wrap(async (req, res) => {
  await inCircle(req, null, ({ state, circle, userId , notify, who }) => {
    state.reads[userId] = { ...(state.reads[userId] || {}), [circle.id]: new Date().toISOString() };
  });
  res.status(204).end();
}));

// ---------- appointments ----------

function readAppointment(body, into = {}) {
  if (body.title !== undefined) { into.title = text(body.title, 80); if (!into.title) fail(400, 'Enter what the appointment is for.'); }
  if (body.startsAt !== undefined) { const d = new Date(body.startsAt); if (Number.isNaN(d.getTime())) fail(400, 'Enter a valid date and time.'); into.startsAt = d.toISOString(); }
  for (const k of ['location', 'notes', 'outcome']) if (body[k] !== undefined) into[k] = text(body[k], k === 'location' ? 80 : 500);
  if (body.escortUserId !== undefined) into.escortUserId = text(body.escortUserId, 100);
  return into;
}

app.post('/api/circles/:circleId/appointments', wrap(async (req, res) => {
  const a = await inCircle(req, 'editAppointments', ({ state, circle, userId, say , notify, who }) => {
    if (!req.body.title || !req.body.startsAt) fail(400, 'Enter what the appointment is for and when.');
    const item = { id: randomUUID(), circleId: circle.id, title: '', startsAt: '', location: '', notes: '', escortUserId: '', outcome: '', createdBy: userId, updatedAt: new Date().toISOString() };
    readAppointment(req.body, item);
    item.fileIds = photoIds(state, circle.id, req.body.fileIds);
    const sg = new Date(new Date(item.startsAt).getTime() + 8 * 3600e3).toISOString();
    const rule = R.clean(req.body.repeat, sg.slice(0, 10));
    let count = 1;
    if (rule) {
      // A repeating appointment: one appointment per day in the pattern, same time, linked by seriesId.
      const days = R.expand(sg.slice(0, 10), rule);
      if (!days.length) fail(400, 'No days match that repeat pattern. Tick at least one day, or change the end date.');
      item.seriesId = randomUUID(); item.repeat = rule; item.repeatText = R.describe(rule);
      const hm = sg.slice(11, 16);
      days.forEach((day, i) => state.appointments.push({ ...item, id: i === 0 ? item.id : randomUUID(), fileIds: [...item.fileIds], startsAt: new Date(`${day}T${hm}:00+08:00`).toISOString() }));
      item.startsAt = new Date(`${days[0]}T${hm}:00+08:00`).toISOString();
      count = days.length;
    } else state.appointments.push(item);
    say(`added an appointment: ${item.title}${count > 1 ? ` (${item.repeatText.toLowerCase()}, ${count} times)` : ''}`);
    notify({ to: [...who('owner', 'family'), ...(item.escortUserId ? [item.escortUserId] : [])], category: 'appointments', title: `New ${count > 1 ? 'repeating ' : ''}appointment: ${item.title}`,
      body: `${new Date(new Date(item.startsAt).getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')}, ${item.location}${item.escortUserId ? `. Escort: ${L.userName(state, item.escortUserId)}` : '. Escort needed.'}`,
      tab: 'calendar', itemId: item.id, actions: item.escortUserId ? [] : [{ id: 'appt-go', label: "I'll go" }] });
    return item;
  });
  res.status(201).json(a);
}));

app.patch('/api/circles/:circleId/appointments/:id', wrap(async (req, res) => {
  const a = await inCircle(req, null, ({ state, circle, role, userId, say , notify, who }) => {
    const item = find(state.appointments, req.params.id, circle.id, 'Appointment');
    const onlyEscortSelf = Object.keys(req.body).length === 1 && req.body.escortUserId === userId;
    if (!L.can(role, 'editAppointments') && !(role === 'helper' && onlyEscortSelf)) fail(403, `Your role (${role}) cannot change appointments.`);
    const before = { ...item };
    const { series, ...fields } = req.body;
    readAppointment(fields, item);
    if (fields.fileIds !== undefined) item.fileIds = photoIds(state, circle.id, fields.fileIds);
    item.updatedAt = new Date().toISOString();
    // Apply the change to the other repeats too: "later" (this and later) or "all". Each keeps its own day;
    // a new time of day (or a shift of days) moves them all the same way.
    const scope = item.seriesId && !onlyEscortSelf && ['later', 'all'].includes(series) ? series : '';
    if (scope) {
      const shift = new Date(item.startsAt).getTime() - new Date(before.startsAt).getTime();
      for (const x of state.appointments.filter((x) => x !== item && x.circleId === circle.id && x.seriesId === item.seriesId && (scope === 'all' || x.startsAt >= before.startsAt))) {
        for (const k of ['title', 'location', 'notes', 'escortUserId']) if (fields[k] !== undefined) x[k] = item[k];
        if (fields.fileIds !== undefined) x.fileIds = [...item.fileIds];
        if (shift) x.startsAt = new Date(new Date(x.startsAt).getTime() + shift).toISOString();
        x.updatedAt = item.updatedAt;
      }
    }
    say(onlyEscortSelf ? `will go with ${circle.parentName} to ${item.title}` : `updated the appointment: ${item.title}`);
    if (onlyEscortSelf) notify({ to: who('owner', 'family'), category: 'appointments', title: `${L.userName(state, userId)} will go to ${item.title}`, body: 'Escort sorted.', tab: 'calendar', itemId: item.id });
    else if (before.startsAt !== item.startsAt || before.location !== item.location) notify({ to: [...who('owner', 'family'), item.escortUserId, ...who('parent')], category: 'appointments', priority: 'important', title: `Changed: ${item.title}`, body: `Now ${new Date(new Date(item.startsAt).getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} at ${item.location}`, tab: 'calendar', itemId: item.id });
    else if (item.escortUserId && item.escortUserId !== before.escortUserId) notify({ to: [item.escortUserId], category: 'appointments', title: `You are the escort for ${item.title}`, body: `${item.location}`, tab: 'calendar', itemId: item.id });
    return item;
  });
  res.json(a);
}));

// ---------- live: real-time presence and changes (Server-Sent Events) ----------
// Each open app keeps one /api/live stream open. The server pushes:
//   "presence" - who else in the circle is online, which page they are on, what they are doing, and their last moves;
//   "changed"  - something was saved, so the app reloads its data and notifications at once.
// Presence is kept in memory only. A person drops off when their stream closes (or after 35 s without a heartbeat).
const presence = new Map();   // key circleId|userId|clientId -> { circleId, userId, clientId, tab, doing, typing, at, since, trail }
const streams = new Set();    // { res, circleId, userId, clientId }
const PRESENCE_TTL = 35000;
const PAGES = ['home', 'calendar', 'care', 'launch', 'requests', 'updates', 'more', 'inbox', 'notify', 'costs', 'docs', 'renewals', 'circle', 'activity', 'me', 'photos', 'repeats', 'visits', 'profile', 'appearance', 'babyreport', 'payments'];

// Everyone else: never the viewer themselves, and never the viewer's own window.
function presenceFor(state, circleId, viewerId, viewerClientId = '') {
  const now = Date.now();
  const latest = new Map();
  for (const [k, p] of presence) {
    if (now - p.at > PRESENCE_TTL) { presence.delete(k); continue; }
    if (p.circleId !== circleId || p.userId === viewerId || (viewerClientId && p.clientId === viewerClientId)) continue;
    if (!latest.has(p.userId) || latest.get(p.userId).since < p.since) latest.set(p.userId, p);
  }
  return [...latest.values()].map((p) => {
    const m = state.members.find((x) => x.circleId === circleId && x.userId === p.userId);
    return { userId: p.userId, name: L.userName(state, p.userId), role: m ? m.role : '', tab: p.tab, doing: p.doing || '', typing: !!p.typing, scroll: p.scroll || 0, cursor: p.cursor || null, at: new Date(p.at).toISOString(), since: new Date(p.since).toISOString(), trail: p.trail };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Presence updates can arrive every 200 ms, so they use a short-lived copy of the data instead of reading it each time.
let liveCache = null;
async function liveState() {
  if (!liveCache || Date.now() - liveCache.at > 3000) liveCache = { at: Date.now(), state: await store.read() };
  return liveCache.state;
}

const sse = (res, event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* closed */ } };

async function broadcastPresence(circleId) {
  const state = await liveState();
  for (const s of streams) if (s.circleId === circleId) sse(s.res, 'presence', { people: presenceFor(state, circleId, s.userId, s.clientId) });
}

let changeTimer = null;
function broadcastChanged() {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => { for (const s of streams) sse(s.res, 'changed', { at: new Date().toISOString() }); }, 150);
}
store.changed = () => { liveCache = null; broadcastChanged(); };

function setPresence(circleId, userId, clientId, body) {
  const key = `${circleId}|${userId}|${clientId}`;
  const now = Date.now();
  const tab = PAGES.includes(body.tab) ? body.tab : 'home';
  const doing = text(body.doing, 60);
  const old = presence.get(key);
  const moved = !old || old.tab !== tab || old.doing !== doing;
  const trail = old ? old.trail.slice() : [];
  if (moved) { trail.unshift({ tab, doing, at: new Date(now).toISOString() }); trail.length = Math.min(trail.length, 8); }
  const scroll = Math.max(0, Math.min(1, Number(body.scroll) || 0));
  const c = body.cursor;
  let cursor = c && Number.isFinite(c.x) && Number.isFinite(c.y) ? { x: Math.max(0, Math.min(1, c.x)), y: Math.max(0, Math.min(100000, Math.round(c.y))), kind: ['move', 'tap', 'scroll'].includes(c.kind) ? c.kind : 'move' } : null;
  // Keep the last position (with when it happened) even after the pointer leaves the page.
  if (cursor) cursor.at = old && old.cursor && old.cursor.x === cursor.x && old.cursor.y === cursor.y && old.cursor.kind === cursor.kind ? old.cursor.at : new Date(now).toISOString();
  else if (old && old.cursor && old.tab === tab) cursor = old.cursor;
  presence.set(key, { circleId, userId, clientId, tab, doing, typing: body.typing === true, scroll, cursor, at: now, since: moved ? now : old.since, trail });
  return moved || (old && (old.typing !== (body.typing === true) || Math.abs((old.scroll || 0) - scroll) > 0.005 || JSON.stringify(old.cursor) !== JSON.stringify(cursor)));
}

async function memberOf(req, circleId) {
  const user = me(req);
  let state = await liveState();
  if (!state.members.some((m) => m.circleId === circleId && m.userId === user.id)) { liveCache = null; state = await liveState(); }
  const member = state.members.find((m) => m.circleId === circleId && m.userId === user.id);
  if (!member) fail(404, 'Care circle not found, or you are not a member.');
  return { user, member, state };
}

app.get('/api/live', wrap(async (req, res) => {
  const { user, member, state } = await memberOf(req, text(req.query.cid, 60));
  const clientId = text(req.query.clientId, 40) || 'web';
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const s = { res, circleId: member.circleId, userId: user.id, clientId };
  streams.add(s);
  sse(res, 'presence', { people: presenceFor(state, member.circleId, user.id, clientId) });
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 20000);
  req.on('close', () => {
    clearInterval(ping);
    streams.delete(s);
    // Gone at once when the app closes, unless the same app reconnects within a few seconds.
    setTimeout(() => {
      if ([...streams].some((x) => x.circleId === s.circleId && x.userId === s.userId && x.clientId === s.clientId)) return;
      if (presence.delete(`${s.circleId}|${s.userId}|${s.clientId}`)) broadcastPresence(s.circleId).catch(() => {});
    }, 4000);
  });
}));

app.post('/api/circles/:circleId/presence', wrap(async (req, res) => {
  const { user, member, state } = await memberOf(req, req.params.circleId);
  const clientId = text(req.body.clientId, 40) || 'web';
  Seen.touch(user.id);
  let changed;
  if (req.body.away === true) changed = presence.delete(`${member.circleId}|${user.id}|${clientId}`);
  else {
    // The same window may just have switched person: the old person is no longer there.
    for (const [k, p] of presence) if (p.clientId === clientId && p.userId !== user.id) { presence.delete(k); changed = true; }
    changed = setPresence(member.circleId, user.id, clientId, req.body) || changed;
  }
  if (changed) broadcastPresence(member.circleId).catch(() => {});
  res.json({ people: presenceFor(state, member.circleId, user.id, clientId) });
}));

// An owner can make a one-hour password reset link for a member (to send by WhatsApp) when
// email is not set up or the person cannot reach their inbox.
app.post('/api/circles/:circleId/members/:userId/reset-link', wrap(async (req, res) => {
  const { member, state } = await memberOf(req, req.params.circleId);
  if (member.role !== 'owner') fail(403, 'Only the owner can do this.');
  if (!state.members.some((m) => m.circleId === member.circleId && m.userId === req.params.userId)) fail(404, 'Member not found.');
  const u = state.users.find((x) => x.id === req.params.userId && x.account);
  if (!u) fail(400, 'This person does not sign in with an email and password.');
  const base = process.env.APP_URL || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : `${req.protocol}://${req.get('host')}`);
  res.json({ link: `${base.replace(/\/$/, '')}/?reset=${encodeURIComponent(A.resetToken(u))}`, name: u.name, expiresIn: '1 hour' });
}));

// Who is online and when each member was last active. Owners see this for their circle.
app.get('/api/circles/:circleId/people', wrap(async (req, res) => {
  const { member, state } = await memberOf(req, req.params.circleId);
  if (member.role !== 'owner') fail(403, 'Only the owner can see who is online.');
  const now = Date.now();
  const people = state.members.filter((m) => m.circleId === member.circleId).map((m) => {
    const here = [...presence.values()].filter((p) => p.userId === m.userId && now - p.at <= PRESENCE_TTL);
    const inCircle = here.filter((p) => p.circleId === member.circleId).sort((a, b) => b.at - a.at)[0];
    const streaming = [...streams].some((x) => x.userId === m.userId);
    return {
      userId: m.userId, name: L.userName(state, m.userId), role: m.role,
      online: here.length > 0 || streaming,
      where: inCircle ? inCircle.tab : '', doing: inCircle ? inCircle.doing || '' : '', elsewhere: !inCircle && (here.length > 0 || streaming),
      lastSeenAt: here.length ? new Date(Math.max(...here.map((p) => p.at))).toISOString() : Seen.lastSeen(m.userId),
      joinedAt: m.joinedAt || '', account: !!(state.users.find((x) => x.id === m.userId) || {}).account,
    };
  }).sort((a, b) => (b.online - a.online) || (b.lastSeenAt || '').localeCompare(a.lastSeenAt || '') || a.name.localeCompare(b.name));
  res.json({ people, at: new Date(now).toISOString() });
}));

// Delete chosen dates of a repeating request or appointment (tick boxes in "Manage repeats").
app.post('/api/circles/:circleId/series/delete', wrap(async (req, res) => {
  const out = await inCircle(req, null, ({ state, circle, role, userId, say }) => {
    const kind = req.body.kind === 'appointment' ? 'appointments' : 'tasks';
    const ids = new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map((x) => text(x, 60)));
    const list = state[kind].filter((x) => x.circleId === circle.id && ids.has(x.id));
    if (!list.length) fail(400, 'Tick at least one date to delete.');
    if (kind === 'appointments' && !L.can(role, 'editAppointments')) fail(403, `Your role (${role}) cannot change appointments.`);
    if (kind === 'tasks' && role !== 'owner' && list.some((x) => x.createdBy !== userId)) fail(403, 'Only the owner or the person who added it can delete it.');
    state[kind] = state[kind].filter((x) => !list.includes(x));
    say(`deleted ${list.length} repeat${list.length === 1 ? '' : 's'} of ${kind === 'tasks' ? 'the task' : 'the appointment'}: ${list[0].title}`);
    return { deleted: list.length };
  });
  res.json(out);
}));

// ---------- baby log: feeds, sleep, diapers, growth ----------
const BABY_KINDS = ['bottle', 'breast', 'pump', 'solids', 'sleep', 'diaper', 'weight', 'height', 'head'];

// One circle can care for one baby or for twins and triplets (up to 4). Each baby has its own
// birth details, formula and feed reminder; every log entry says which baby it is for.
const BABY_COLORS = ['#2563EB', '#DB2777', '#0F8A45', '#C2410C'];
// A milk is a formula from the Singapore list or one of the family's own milks (id "my:...").
const myFoods = (circle) => (circle && Array.isArray(circle.babyFoods) ? circle.babyFoods : []);
const pickFormula = (id, circle) => (F.FORMULAS.some((f) => f.id === id) || myFoods(circle).some((f) => f.id === id && f.kind === 'milk') ? id : '');
function milkById(circle, id) {
  const f = F.FORMULAS.find((x) => x.id === id);
  if (f) return { id: f.id, name: f.product, brand: f.brand, stageLabel: f.stageLabel, per100ml: f.per100ml, typical: true };
  const m = myFoods(circle).find((x) => x.id === id && x.kind === 'milk');
  return m ? { id: m.id, name: m.name, brand: m.brand || '', stageLabel: 'My milk', per100ml: m.per100, typical: false } : null;
}
function foodById(circle, id) {
  return myFoods(circle).find((x) => x.id === id && x.kind === 'food') || BF.FOODS.find((x) => x.id === id) || null;
}
function newBabies(body, parentName) {
  const shared = { birthDate: isDay(body.birthDate) ? body.birthDate : '', formulaId: pickFormula(body.formulaId, null) };
  const list = Array.isArray(body.babies) && body.babies.length ? body.babies.slice(0, 4) : [{ name: parentName, sex: body.sex }];
  return list.map((b, i) => ({ id: randomUUID(), name: text(b.name, 40) || `Baby ${i + 1}`, sex: ['boy', 'girl'].includes(b.sex) ? b.sex : '',
    birthDate: isDay(b.birthDate) ? b.birthDate : shared.birthDate, formulaId: b.formulaId !== undefined ? pickFormula(b.formulaId, null) : shared.formulaId, per100ml: null, customName: '', color: BABY_COLORS[i] }));
}
// Older 4.0 data kept one baby in circle.baby: turn it into the list.
function babiesOf(circle) {
  if (!Array.isArray(circle.babies)) {
    const b = circle.baby || {};
    circle.babies = [{ id: 'baby-1', name: circle.parentName, sex: b.sex || '', birthDate: b.birthDate || '', formulaId: b.formulaId || '', per100ml: b.per100ml || null, customName: b.customName || '', color: BABY_COLORS[0] }];
  }
  return circle.babies;
}
function babyFormula(b, circle) {
  const f = b.formulaId ? milkById(circle, b.formulaId) : null;
  const per100ml = b.per100ml || (f ? f.per100ml : null);
  return f || b.per100ml ? { id: f ? f.id : 'custom', name: f ? f.name : (b.customName || 'My formula'), brand: f ? f.brand : '', stageLabel: f ? f.stageLabel : '', per100ml, typical: !b.per100ml && !!f && f.typical } : null;
}

// Baby log entries for this circle, oldest data made complete (baby id and bottle nutrition).
function babyLogsWhere(state, circle, keep) {
  const babies = babiesOf(circle);
  const first = babies[0].id;
  return (state.babyLogs || []).filter((x) => x.circleId === circle.id && keep(x))
    .map((x) => {
      const y = x.babyId ? x : { ...x, babyId: first };
      // A formula bottle saved without nutrition (older data) uses that baby's current formula.
      if (y.kind === 'bottle' && y.source !== 'breastmilk' && !y.per100ml) {
        const f = babyFormula(babies.find((b) => b.id === y.babyId) || babies[0], circle);
        if (f) return { ...y, formula: y.formula || f.name, per100ml: f.per100ml };
      }
      return y;
    }).sort((a, b) => b.at.localeCompare(a.at));
}

function babyView(state, circle) {
  const since = new Date(Date.now() - 30 * 86400e3).toISOString();
  const babies = babiesOf(circle);
  const logs = babyLogsWhere(state, circle, (x) => x.at >= since || ['weight', 'height', 'head'].includes(x.kind));
  const feedEvery = (circle.baby && circle.baby.feedEvery) || 0;
  return { babies: babies.map((b) => ({ ...b, formula: babyFormula(b, circle), targets: b.targets || null })), feedEvery, breastMilk: F.BREAST_MILK, logs,
    myFoods: myFoods(circle), presetFoods: BF.FOODS };
}

// Reports: every log between two Singapore dates (up to about 13 months), plus all growth entries.
app.get('/api/circles/:circleId/baby/report', wrap(async (req, res) => {
  const { member, state } = await memberOf(req, req.params.circleId);
  const circle = state.circles.find((c) => c.id === member.circleId);
  if (!circle || !(circle.profile && circle.profile.careFor === 'baby')) fail(400, 'This circle has no baby log.');
  const from = isDay(req.query.from) ? req.query.from : null;
  const to = isDay(req.query.to) ? req.query.to : null;
  if (!from || !to || from > to) fail(400, 'Choose the dates for the report.');
  const start = new Date(`${from}T00:00:00+08:00`).getTime();
  const end = new Date(`${to}T00:00:00+08:00`).getTime() + 86400e3;
  if ((end - start) / 86400e3 > 400) fail(400, 'A report can cover up to 400 days.');
  // Sleep that started the evening before still counts on the first day.
  const startIso = new Date(start - 86400e3).toISOString(); const endIso = new Date(end).toISOString();
  const logs = babyLogsWhere(state, circle, (x) => (x.at >= startIso && x.at < endIso) || ['weight', 'height', 'head'].includes(x.kind));
  const babies = babiesOf(circle).map((b) => ({ id: b.id, name: b.name, color: b.color, birthDate: b.birthDate, sex: b.sex || '', targetsMode: b.targetsMode || 'manual', targets: b.targets || null, formula: babyFormula(b, circle) }));
  res.json({ from, to, babies, breastMilk: F.BREAST_MILK, logs, parentName: circle.parentName });
}));

function findBaby(circle, id) {
  const list = babiesOf(circle);
  const b = id ? list.find((x) => x.id === id) : list[0];
  if (!b) fail(404, 'Baby not found.');
  return b;
}

app.get('/api/formulas', (req, res) => res.json({ formulas: F.FORMULAS, breastMilk: F.BREAST_MILK, foods: BF.FOODS }));

// The family's own milk powders and foods, with nutrition per 100 ml (milk, made up) or per 100 g (food).
function readFood(body, old) {
  const kind = (old && old.kind) || (body.kind === 'milk' ? 'milk' : 'food');
  const name = body.name !== undefined ? text(body.name, 60) : old.name;
  if (!name) fail(400, kind === 'milk' ? 'Enter the name of the milk powder.' : 'Enter the name of the food.');
  const v = body.per100 || (old && old.per100) || {};
  const num = (x, max, what) => { const n = Number(x); if (!(n >= 0 && n <= max)) fail(400, `Check the ${what} (per 100 ${kind === 'milk' ? 'ml' : 'g'}).`); return Math.round(n * 100) / 100; };
  return { kind, unit: kind === 'milk' ? 'ml' : 'g', name, brand: body.brand !== undefined ? text(body.brand, 40) : (old && old.brand) || '', group: body.group !== undefined ? text(body.group, 30) : (old && old.group) || (kind === 'milk' ? 'Milk' : 'My foods'),
    per100: { kcal: num(v.kcal, 900, 'energy'), protein: num(v.protein, 100, 'protein'), fat: num(v.fat, 100, 'fat'), carbs: num(v.carbs, 100, 'carbs') }, custom: true };
}
app.post('/api/circles/:circleId/baby/foods', wrap(async (req, res) => {
  const out = await inCircle(req, 'logDoses', ({ circle, role, userId, say }) => {
    if (role === 'parent') fail(403, 'Only family and helpers can change the food list.');
    circle.babyFoods = myFoods(circle);
    if (circle.babyFoods.length >= 200) fail(400, 'The list is full (200). Remove some first.');
    const item = { id: `my:${randomUUID().slice(0, 8)}`, ...readFood(req.body), from: text(req.body.from, 40), createdBy: userId, createdAt: new Date().toISOString() };
    circle.babyFoods.push(item);
    if (item.kind === 'milk' && req.body.useFor) for (const b of babiesOf(circle)) if (req.body.useFor === 'all' || req.body.useFor === b.id) { b.formulaId = item.id; b.per100ml = null; }
    say(`added ${item.kind === 'milk' ? 'the milk' : 'the food'} ${item.name} to the baby food list`);
    return item;
  });
  res.status(201).json(out);
}));
app.patch('/api/circles/:circleId/baby/foods/:id', wrap(async (req, res) => {
  const out = await inCircle(req, 'logDoses', ({ circle, role }) => {
    if (role === 'parent') fail(403, 'Only family and helpers can change the food list.');
    const item = myFoods(circle).find((x) => x.id === req.params.id);
    if (!item) fail(404, 'Food not found.');
    Object.assign(item, readFood(req.body, item));
    return item;
  });
  res.json(out);
}));
app.delete('/api/circles/:circleId/baby/foods/:id', wrap(async (req, res) => {
  await inCircle(req, 'logDoses', ({ circle, role }) => {
    if (role === 'parent') fail(403, 'Only family and helpers can change the food list.');
    circle.babyFoods = myFoods(circle).filter((x) => x.id !== req.params.id);
    for (const b of babiesOf(circle)) if (b.formulaId === req.params.id) b.formulaId = '';
  });
  res.status(204).end();
}));

app.patch('/api/circles/:circleId/baby', wrap(async (req, res) => {
  const out = await inCircle(req, 'logDoses', ({ state, circle, role, say }) => {
    if (role === 'parent') fail(403, 'Only family and helpers can change the baby settings.');
    const b = findBaby(circle, req.body.babyId);
    if (req.body.name !== undefined) b.name = text(req.body.name, 40) || b.name;
    if (req.body.birthDate !== undefined) b.birthDate = isDay(req.body.birthDate) ? req.body.birthDate : '';
    if (req.body.sex !== undefined) b.sex = ['boy', 'girl'].includes(req.body.sex) ? req.body.sex : '';
    if (req.body.formulaId !== undefined) { b.formulaId = pickFormula(req.body.formulaId, circle); b.per100ml = null; }
    // Automatic targets (worked out in the app from weight, length, sex and age) or the family's own.
    if (req.body.targetsMode !== undefined) b.targetsMode = req.body.targetsMode === 'auto' ? 'auto' : 'manual';
    // Daily targets the family set (for example from the doctor or dietitian); empty clears them.
    if (req.body.targets !== undefined) {
      const t = req.body.targets || {};
      const num = (x, max) => { if (x === '' || x === null || x === undefined) return null; const n = Number(x); if (!(n >= 0 && n <= max)) fail(400, 'Check the daily targets.'); return Math.round(n * 10) / 10; };
      const v = { kcal: num(t.kcal, 4000), protein: num(t.protein, 300), fat: num(t.fat, 300), carbs: num(t.carbs, 600), ml: num(t.ml, 3000) };
      b.targets = Object.values(v).some((x) => x !== null) ? v : null;
    }
    if (req.body.customName !== undefined) b.customName = text(req.body.customName, 60);
    if (req.body.per100ml !== undefined) {
      const v = req.body.per100ml;
      const num = (x, max) => { const n = Number(x); if (!(n >= 0 && n <= max)) fail(400, 'Nutrition values look wrong. Check the tin (per 100 ml).'); return Math.round(n * 10) / 10; };
      b.per100ml = v ? { kcal: num(v.kcal, 150), protein: num(v.protein, 10), fat: num(v.fat, 15), carbs: num(v.carbs, 20) } : null;
    }
    if (req.body.feedEvery !== undefined) { circle.baby = circle.baby || {}; circle.baby.feedEvery = Math.max(0, Math.min(8, Number(req.body.feedEvery) || 0)); }
    // The same formula for every baby (twins usually share a tin).
    if (req.body.formulaForAll) for (const x of babiesOf(circle)) { x.formulaId = b.formulaId; x.per100ml = b.per100ml; x.customName = b.customName; }
    say(`updated ${b.name}'s baby settings`);
    return babyView(state, circle);
  });
  res.json(out);
}));

// Add a baby (a twin or triplet) or remove one added by mistake.
app.post('/api/circles/:circleId/baby/babies', wrap(async (req, res) => {
  const out = await inCircle(req, 'logDoses', ({ circle, role, say }) => {
    if (role === 'parent') fail(403, 'Only family and helpers can add a baby.');
    const list = babiesOf(circle);
    if (list.length >= 4) fail(400, 'A circle can follow up to 4 babies.');
    const name = text(req.body.name, 40);
    if (!name) fail(400, 'Enter the baby\'s name.');
    const b = { id: randomUUID(), name, sex: ['boy', 'girl'].includes(req.body.sex) ? req.body.sex : '', birthDate: isDay(req.body.birthDate) ? req.body.birthDate : list[0].birthDate,
      formulaId: req.body.formulaId !== undefined ? pickFormula(req.body.formulaId, circle) : list[0].formulaId, per100ml: req.body.formulaId !== undefined ? null : list[0].per100ml, customName: list[0].customName || '', color: BABY_COLORS.find((c) => !list.some((x) => x.color === c)) || BABY_COLORS[list.length % 4] };
    list.push(b);
    say(`added ${b.name} to the baby log`);
    return b;
  });
  res.status(201).json(out);
}));

app.delete('/api/circles/:circleId/baby/babies/:babyId', wrap(async (req, res) => {
  await inCircle(req, 'logDoses', ({ state, circle, role, say }) => {
    if (role === 'parent') fail(403, 'Only family and helpers can remove a baby.');
    const list = babiesOf(circle);
    const b = findBaby(circle, req.params.babyId);
    if (list.length < 2) fail(400, 'The circle needs at least one baby.');
    circle.babies = list.filter((x) => x !== b);
    const first = list[0].id;
    state.babyLogs = (state.babyLogs || []).filter((x) => !(x.circleId === circle.id && (x.babyId || first) === b.id));
    say(`removed ${b.name} from the baby log`);
  });
  res.status(204).end();
}));

// Log for one baby, or the same thing for several babies at once (twins fed together).
// For bottles, "amounts" can give each baby its own ml: { babyId: ml }.
app.post('/api/circles/:circleId/baby/logs', wrap(async (req, res) => {
  const out = await inCircle(req, 'logDoses', ({ state, circle, userId, say }) => {
    const b = req.body;
    if (!BABY_KINDS.includes(b.kind)) fail(400, 'Unknown kind of log.');
    const ids = Array.isArray(b.babyIds) && b.babyIds.length ? [...new Set(b.babyIds)] : [b.babyId];
    const babies = ids.map((id) => findBaby(circle, id));
    const at = b.at && !Number.isNaN(new Date(b.at).getTime()) ? new Date(b.at).toISOString() : new Date().toISOString();
    if (at > new Date(Date.now() + 5 * 60e3).toISOString()) fail(400, 'That time is in the future.');
    const n = (x, max, what) => { const v = Number(x); if (!(v > 0 && v <= max)) fail(400, `Enter ${what}.`); return Math.round(v * 100) / 100; };
    if (b.kind === 'solids' && Array.isArray(b.foods) && b.foods.length > 12) fail(400, 'Up to 12 foods at a time.');
    const foodsList = b.kind === 'solids' && Array.isArray(b.foods) && b.foods.length ? b.foods : [null];
    const items = foodsList.flatMap((food) => babies.map((baby) => {
      const item = { id: randomUUID(), circleId: circle.id, babyId: baby.id, kind: b.kind, at, by: userId, note: text(b.note, 300) };
      if (b.kind === 'bottle') {
        const ml = b.amounts && b.amounts[baby.id] !== undefined ? b.amounts[baby.id] : b.ml;
        item.ml = n(ml, 400, `how many ml${babies.length > 1 ? ` for ${baby.name}` : ''}`); item.source = b.source === 'breastmilk' ? 'breastmilk' : 'formula';
        if (item.source === 'formula') {
          const f = b.milkId ? milkById(circle, b.milkId) : babyFormula(baby, circle);
          if (b.milkId && !f) fail(400, 'That milk is not in the list.');
          if (f) { item.formula = f.name; item.per100ml = f.per100ml; if (b.milkId) item.milkId = f.id; }
        }
      }
      if (b.kind === 'breast') { item.side = ['left', 'right', 'both'].includes(b.side) ? b.side : 'both'; item.minutes = n(b.minutes, 120, 'how many minutes'); }
      if (b.kind === 'pump') item.ml = n(b.ml, 600, 'how many ml');
      if (b.kind === 'solids') {
        // One food per entry; a meal with several foods is sent as "foods" and split below.
        const one = food || b;
        const fd = one.foodId ? foodById(circle, one.foodId) : null;
        if (one.foodId && !fd) fail(400, 'That food is not in the list.');
        item.food = fd ? fd.name : text(one.food, 80);
        if (!item.food) fail(400, 'Enter what was eaten.');
        item.amount = text(one.amount, 40);
        const gAll = one.grams && typeof one.grams === 'object' ? one.grams[baby.id] : one.grams;
        if (gAll !== undefined && gAll !== '' && gAll !== null) item.grams = n(gAll, 1000, `how many grams of ${item.food}`);
        if (fd) item.foodId = fd.id;
        if (fd && item.grams) { const f = item.grams / 100; item.macros = { kcal: Math.round(fd.per100.kcal * f * 10) / 10, protein: Math.round(fd.per100.protein * f * 10) / 10, fat: Math.round(fd.per100.fat * f * 10) / 10, carbs: Math.round(fd.per100.carbs * f * 10) / 10 }; }
      }
      if (b.kind === 'sleep') item.endAt = b.endAt && !Number.isNaN(new Date(b.endAt).getTime()) ? new Date(b.endAt).toISOString() : '';
      if (b.kind === 'diaper') item.diaper = ['wet', 'dirty', 'both'].includes(b.diaper) ? b.diaper : 'wet';
      const w = b.values && b.values[baby.id] !== undefined ? b.values[baby.id] : undefined;
      if (b.kind === 'weight') item.kg = n(w !== undefined ? w : b.kg, 40, `the weight in kg${babies.length > 1 ? ` for ${baby.name}` : ''}`);
      if (b.kind === 'height') item.cm = n(w !== undefined ? w : b.cm, 130, 'the length in cm');
      if (b.kind === 'head') item.cm = n(w !== undefined ? w : b.cm, 60, 'the head size in cm');
      return item;
    }));
    state.babyLogs = state.babyLogs || [];
    state.babyLogs.push(...items);
    // A new feed clears that baby's "feed due" reminders.
    if (b.kind === 'bottle' || b.kind === 'breast') for (const x of state.notifications.filter((x) => x.circleId === circle.id && x.category === 'baby' && !x.readAt && (!x.babyId || babies.some((bb) => bb.id === x.babyId)))) x.readAt = new Date().toISOString();
    const item = items[0];
    const what = { bottle: items.length > 1 ? `bottles (${items.map((x, i) => `${(babies[i] || babies[0]).name} ${x.ml} ml`).join(', ')})` : `a ${item.ml} ml bottle`, breast: `a ${item.minutes} min breastfeed`, pump: `pumped ${item.ml} ml`, solids: `solids (${[...new Set(items.map((x) => x.food))].join(', ')})`, sleep: 'sleep', diaper: `a ${item.diaper} diaper`, weight: `weight`, height: `length`, head: `head size` }[b.kind];
    say(`logged ${what} for ${babies.map((x) => x.name).join(' and ')}`);
    return items.length > 1 ? { items } : item;
  });
  res.status(201).json(out);
}));

app.patch('/api/circles/:circleId/baby/logs/:id', wrap(async (req, res) => {
  const out = await inCircle(req, 'logDoses', ({ state, circle }) => {
    const item = find(state.babyLogs || [], req.params.id, circle.id, 'Log');
    if (req.body.endAt !== undefined) item.endAt = req.body.endAt ? new Date(req.body.endAt).toISOString() : '';
    if (req.body.note !== undefined) item.note = text(req.body.note, 300);
    return item;
  });
  res.json(out);
}));

app.delete('/api/circles/:circleId/baby/logs/:id', wrap(async (req, res) => {
  await inCircle(req, 'logDoses', ({ state, circle }) => {
    const item = find(state.babyLogs || [], req.params.id, circle.id, 'Log');
    state.babyLogs = state.babyLogs.filter((x) => x !== item);
  });
  res.status(204).end();
}));

// ---------- visit notes: doctor, dentist, physio, therapy ----------
const VISIT_TYPES = ['doctor', 'dentist', 'physio', 'therapy', 'specialist', 'other'];
const VISIT_LABEL = { doctor: 'Doctor', dentist: 'Dentist', physio: 'Physio', therapy: 'Therapy', specialist: 'Specialist', other: 'Visit' };

// Photos and documents (PDF) attached to a visit, up to 12, from this circle only.
function attachIds(state, circleId, list) {
  const ids = [...new Set((Array.isArray(list) ? list : []).map((x) => text(x, 60)).filter(Boolean))];
  if (ids.length > 12) fail(400, 'You can attach up to 12 photos and files.');
  for (const id of ids) find(state.files, id, circleId, 'File');
  return ids;
}

function readVisit(state, circleId, body, into) {
  if (body.type !== undefined) into.type = VISIT_TYPES.includes(body.type) ? body.type : 'other';
  if (body.provider !== undefined) into.provider = text(body.provider, 100);
  if (body.date !== undefined) { if (!isDay(body.date)) fail(400, 'Choose the date of the visit.'); into.date = body.date; }
  if (body.time !== undefined) into.time = isTime(body.time) ? body.time : '';
  if (body.appointmentId !== undefined) into.appointmentId = text(body.appointmentId, 60) && state.appointments.some((a) => a.id === body.appointmentId && a.circleId === circleId) ? body.appointmentId : '';
  for (const k of ['summary', 'instructions', 'medChanges']) if (body[k] !== undefined) into[k] = text(body[k], 3000);
  if (body.followUpDate !== undefined) into.followUpDate = isDay(body.followUpDate) ? body.followUpDate : '';
  if (body.fileIds !== undefined) into.fileIds = attachIds(state, circleId, body.fileIds);
  return into;
}

app.post('/api/circles/:circleId/visits', wrap(async (req, res) => {
  const v = await inCircle(req, 'editVisits', ({ state, circle, userId, say, notify, who }) => {
    state.visits = state.visits || [];
    const item = readVisit(state, circle.id, req.body, { id: randomUUID(), circleId: circle.id, type: 'doctor', provider: '', date: '', time: '', appointmentId: '', summary: '', instructions: '', medChanges: '', followUpDate: '', fileIds: [], comments: [], createdBy: userId, createdAt: new Date().toISOString() });
    if (!item.date) fail(400, 'Choose the date of the visit.');
    if (!item.summary && !item.instructions && !item.medChanges && !item.fileIds.length) fail(400, 'Write what was said, or attach a photo or file.');
    item.updatedAt = item.createdAt;
    state.visits.push(item);
    const label = `${VISIT_LABEL[item.type]}${item.provider ? ` (${item.provider})` : ''}`;
    // Optionally put the follow-up in the calendar.
    if (item.followUpDate && req.body.addFollowUp === true) {
      const t = isTime(req.body.followUpTime) ? req.body.followUpTime : '09:00';
      state.appointments.push({ id: randomUUID(), circleId: circle.id, title: `Follow-up: ${label}`, startsAt: new Date(`${item.followUpDate}T${t}:00+08:00`).toISOString(), location: item.provider, notes: item.instructions.slice(0, 500), escortUserId: '', outcome: '', createdBy: userId, updatedAt: item.createdAt, fileIds: [] });
    }
    say(`added visit notes: ${label}`);
    notify({ to: who('owner', 'family', 'helper'), category: 'appointments', title: `Visit notes: ${label}`, body: (item.summary || item.instructions || 'Photos and files added.').slice(0, 140), tab: 'visits', itemId: item.id });
    return item;
  });
  res.status(201).json(v);
}));

app.patch('/api/circles/:circleId/visits/:id', wrap(async (req, res) => {
  const v = await inCircle(req, 'editVisits', ({ state, circle, say }) => {
    const item = find(state.visits || [], req.params.id, circle.id, 'Visit');
    readVisit(state, circle.id, req.body, item);
    item.updatedAt = new Date().toISOString();
    say(`updated visit notes: ${VISIT_LABEL[item.type]}${item.provider ? ` (${item.provider})` : ''}`);
    return item;
  });
  res.json(v);
}));

app.delete('/api/circles/:circleId/visits/:id', wrap(async (req, res) => {
  await inCircle(req, 'editVisits', ({ state, circle, role, userId, say }) => {
    const item = find(state.visits || [], req.params.id, circle.id, 'Visit');
    if (role !== 'owner' && item.createdBy !== userId) fail(403, 'Only the owner or the person who added it can delete it.');
    state.visits = state.visits.filter((x) => x !== item);
    say(`deleted visit notes: ${VISIT_LABEL[item.type]}`);
  });
  res.status(204).end();
}));

app.post('/api/circles/:circleId/visits/:id/comments', wrap(async (req, res) => {
  const c = await inCircle(req, 'seeVisits', ({ state, circle, userId, notify }) => {
    const item = find(state.visits || [], req.params.id, circle.id, 'Visit');
    const body = text(req.body.text, 1000);
    if (!body) fail(400, 'Write a comment.');
    const comment = { id: randomUUID(), userId, text: body, createdAt: new Date().toISOString() };
    item.comments = [...(item.comments || []), comment];
    notify({ to: [item.createdBy, ...(item.comments || []).map((x) => x.userId)], category: 'updates', title: `${L.userName(state, userId)} commented on the ${VISIT_LABEL[item.type].toLowerCase()} visit`, body: body.slice(0, 120), tab: 'visits', itemId: item.id });
    return comment;
  });
  res.status(201).json(c);
}));

// Calendar file (.ics) so an appointment can be added to iPhone, Android, Outlook or Google calendars.
function icsText(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsFold(line) { const out = []; let rest = line; while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; } out.push(rest); return out.join('\r\n'); }
const icsTime = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

app.get('/api/circles/:circleId/appointments/:id.ics', wrap(async (req, res) => {
  const out = await inCircle(req, null, ({ state, circle }) => {
    const a = find(state.appointments, req.params.id, circle.id, 'Appointment');
    const details = [
      `For ${circle.parentName}`,
      a.escortUserId ? `Going with ${circle.parentName}: ${L.userName(state, a.escortUserId)}` : 'Escort still needed',
      a.notes ? `Notes: ${a.notes}` : '',
      'Shared from Famhub',
    ].filter(Boolean).join('\n');
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Famhub//Care calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${a.id}@famhub`, `DTSTAMP:${icsTime(new Date().toISOString())}`,
      `DTSTART:${icsTime(a.startsAt)}`, `DTEND:${icsTime(new Date(new Date(a.startsAt).getTime() + 3600e3).toISOString())}`,
      `SUMMARY:${icsText(`${a.title} (${circle.parentName})`)}`,
      a.location ? `LOCATION:${icsText(a.location)}` : '',
      `DESCRIPTION:${icsText(details)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(a.title)}`, 'TRIGGER:-PT1H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).map(icsFold);
    return { body: `${lines.join('\r\n')}\r\n`, name: `${a.title.replace(/[^\w -]+/g, '').trim() || 'appointment'}.ics` };
  });
  res.type('text/calendar; charset=utf-8').set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${out.name}"`).set('Cache-Control', 'no-store').send(out.body);
}));

app.delete('/api/circles/:circleId/appointments/:id', wrap(async (req, res) => {
  await inCircle(req, 'editAppointments', ({ state, circle, say , notify, who }) => {
    const item = find(state.appointments, req.params.id, circle.id, 'Appointment');
    const series = item.seriesId && ['later', 'all'].includes(req.query.series) ? req.query.series : '';
    const gone = (x) => x === item || (series && x.seriesId === item.seriesId && (series === 'all' || x.startsAt >= item.startsAt));
    const n = state.appointments.filter(gone).length;
    state.appointments = state.appointments.filter((x) => !gone(x));
    say(`deleted the appointment: ${item.title}${n > 1 ? ` (${n} repeats)` : ''}`);
  });
  res.status(204).end();
}));

// ---------- tasks ----------

// Photos attached to a request (up to 6, images from this circle only).
function photoIds(state, circleId, list) {
  const ids = [...new Set((Array.isArray(list) ? list : []).map((x) => text(x, 60)).filter(Boolean))];
  if (ids.length > 6) fail(400, 'You can add up to 6 photos.');
  for (const id of ids) { const f = find(state.files, id, circleId, 'Photo'); if (!f.type.startsWith('image/')) fail(400, 'Only photos can be added.'); }
  return ids;
}

const TASK_CATEGORIES = ['errand', 'refill', 'bill', 'care', 'other'];

app.post('/api/circles/:circleId/tasks', wrap(async (req, res) => {
  const t = await inCircle(req, 'addTasks', ({ state, circle, userId, say , notify, who }) => {
    const title = text(req.body.title, 100);
    if (!title) fail(400, 'Enter a task.');
    const assignee = text(req.body.assigneeUserId, 100);
    if (assignee && !state.members.some((m) => m.circleId === circle.id && m.userId === assignee)) fail(400, 'That person is not in this circle.');
    const rule = R.clean(req.body.repeat, isDay(req.body.dueDate) ? req.body.dueDate : L.todaySG());
    const item = {
      id: randomUUID(), circleId: circle.id, title, category: TASK_CATEGORIES.includes(req.body.category) ? req.body.category : 'other',
      dueDate: isDay(req.body.dueDate) ? req.body.dueDate : '', dueTime: isDay(req.body.dueDate) && isTime(req.body.dueTime) ? req.body.dueTime : '', assigneeUserId: assignee,
      fileIds: photoIds(state, circle.id, req.body.fileIds),
      status: assignee === userId ? 'accepted' : 'open', createdBy: userId, createdAt: new Date().toISOString(), doneBy: '', doneAt: '',
    };
    let count = 1;
    if (rule) {
      // A repeating request: one request per day in the pattern, linked by seriesId.
      const days = R.expand(item.dueDate || L.todaySG(), rule);
      if (!days.length) fail(400, 'No days match that repeat pattern. Tick at least one day, or change the end date.');
      item.seriesId = randomUUID(); item.repeat = rule; item.repeatText = R.describe(rule);
      if (!item.dueTime && !isDay(req.body.dueDate)) item.dueTime = '';
      days.forEach((day, i) => state.tasks.push({ ...item, id: i === 0 ? item.id : randomUUID(), dueDate: day, fileIds: [...(item.fileIds || [])] }));
      item.dueDate = days[0];
      count = days.length;
    } else state.tasks.push(item);
    say(`added a task: ${title}${count > 1 ? ` (${item.repeatText.toLowerCase()}, ${count} times)` : ''}${assignee && assignee !== userId ? ` for ${L.userName(state, assignee)}` : ''}`);
    if (assignee) notify({ to: [assignee], category: 'tasks', priority: 'important', title: `New ${count > 1 ? 'repeating ' : ''}request for you: ${title}`, body: `From ${L.userName(state, userId)}${item.dueDate ? `, on ${item.dueDate}${item.dueTime ? ` at ${item.dueTime}` : ''}` : ''}.`, tab: 'requests', itemId: item.id, actions: [{ id: 'task-accept', label: 'Accept' }, { id: 'task-decline', label: "Can't do it" }] });
    else notify({ to: who('owner', 'family', 'helper'), category: 'tasks', title: `Help wanted${count > 1 ? ` (${item.repeatText.toLowerCase()})` : ''}: ${title}`, body: `${item.dueDate ? `On ${item.dueDate}${item.dueTime ? ` at ${item.dueTime}` : ''}. ` : ''}Can you take it?`, tab: 'requests', itemId: item.id, actions: [{ id: 'task-take', label: "I'll do it" }] });
    return item;
  });
  res.status(201).json(t);
}));

app.patch('/api/circles/:circleId/tasks/:id', wrap(async (req, res) => {
  const t = await inCircle(req, null, ({ state, circle, role, userId, say , notify, who }) => {
    const item = find(state.tasks, req.params.id, circle.id, 'Task');
    const manager = ['owner', 'family'].includes(role);
    const action = req.body.action;
    if (action === 'take') {
      if (role === 'parent') fail(403, 'Parents cannot take tasks.');
      item.assigneeUserId = userId; item.status = 'accepted'; say(`took the task: ${item.title}`);
      notify({ to: [item.createdBy], category: 'tasks', title: `${L.userName(state, userId)} will do: ${item.title}`, tab: 'requests', itemId: item.id });
    } else if (action === 'accept') {
      if (item.assigneeUserId !== userId) fail(403, 'Only the person it is assigned to can accept it.');
      item.status = 'accepted'; say(`accepted the task: ${item.title}`);
    } else if (action === 'decline') {
      if (item.assigneeUserId !== userId) fail(403, 'Only the person it is assigned to can hand it back.');
      item.assigneeUserId = ''; item.status = 'open'; say(`handed back the task: ${item.title}`);
      notify({ to: [item.createdBy, ...who('owner', 'family')], category: 'tasks', priority: 'important', title: `Needs someone else: ${item.title}`, body: `${L.userName(state, userId)} cannot do it.`, tab: 'requests', itemId: item.id, actions: [{ id: 'task-take', label: "I'll do it" }] });
    } else if (action === 'done' || action === 'reopen') {
      if (!manager && item.assigneeUserId !== userId) fail(403, 'Only the assignee or family can complete this task.');
      if (action === 'done' && L.taskLocked(item)) fail(400, `Not yet. You can tick this from ${new Date(`${item.dueDate}T12:00:00+08:00`).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short' })}${item.dueTime ? ` at ${item.dueTime}` : ''}.`);
      item.status = action === 'done' ? 'done' : (item.assigneeUserId ? 'accepted' : 'open');
      item.doneBy = action === 'done' ? userId : ''; item.doneAt = action === 'done' ? new Date().toISOString() : '';
      say(`${action === 'done' ? 'completed' : 'reopened'} the task: ${item.title}`);
      if (action === 'done') notify({ to: [item.createdBy], category: 'tasks', title: `Done: ${item.title}`, body: `By ${L.userName(state, userId)}.`, tab: 'requests', itemId: item.id });
    } else if (action === 'assign') {
      if (!manager) fail(403, 'Only family can assign tasks.');
      const to = text(req.body.assigneeUserId, 100);
      if (to && !state.members.some((m) => m.circleId === circle.id && m.userId === to)) fail(400, 'That person is not in this circle.');
      item.assigneeUserId = to; item.status = to ? (to === userId ? 'accepted' : 'open') : 'open';
      say(`assigned ${item.title} to ${to ? L.userName(state, to) : 'nobody'}`);
      if (to) notify({ to: [to], category: 'tasks', priority: 'important', title: `New request for you: ${item.title}`, body: `From ${L.userName(state, userId)}.`, tab: 'requests', itemId: item.id, actions: [{ id: 'task-accept', label: 'Accept' }, { id: 'task-decline', label: "Can't do it" }] });
    } else if (action === 'edit') {
      if (!manager && item.createdBy !== userId) fail(403, 'Only family or the person who added it can edit it.');
      if (req.body.title !== undefined) item.title = text(req.body.title, 100) || item.title;
      if (req.body.dueDate !== undefined) item.dueDate = isDay(req.body.dueDate) ? req.body.dueDate : '';
      if (req.body.dueTime !== undefined) item.dueTime = item.dueDate && isTime(req.body.dueTime) ? req.body.dueTime : '';
      if (TASK_CATEGORIES.includes(req.body.category)) item.category = req.body.category;
      if (req.body.fileIds !== undefined) item.fileIds = photoIds(state, circle.id, req.body.fileIds);
      if (req.body.assigneeUserId !== undefined && manager) {
        const to = text(req.body.assigneeUserId, 100);
        if (to && !state.members.some((m) => m.circleId === circle.id && m.userId === to)) fail(400, 'That person is not in this circle.');
        item.assigneeUserId = to; if (item.status !== 'done') item.status = to ? (to === userId ? 'accepted' : 'open') : 'open';
      }
      // Apply the same change to the other repeats: series "later" (this and later) or "all".
      const scope = item.seriesId && ['later', 'all'].includes(req.body.series) ? req.body.series : '';
      let n = 1;
      if (scope) {
        for (const x of state.tasks.filter((x) => x !== item && x.circleId === circle.id && x.seriesId === item.seriesId && (scope === 'all' || (x.dueDate || '') >= (item.dueDate || '')))) {
          x.title = item.title; x.category = item.category; if (item.dueDate) x.dueTime = item.dueTime;
          if (req.body.fileIds !== undefined) x.fileIds = [...(item.fileIds || [])];
          if (req.body.assigneeUserId !== undefined && manager && x.status !== 'done') { x.assigneeUserId = item.assigneeUserId; x.status = item.assigneeUserId ? (item.assigneeUserId === userId ? 'accepted' : 'open') : 'open'; }
          n += 1;
        }
      }
      say(`edited the task: ${item.title}${n > 1 ? ` (${n} repeats)` : ''}`);
    } else fail(400, 'Unknown task action.');
    return item;
  });
  res.json(t);
}));

app.delete('/api/circles/:circleId/tasks/:id', wrap(async (req, res) => {
  await inCircle(req, null, ({ state, circle, role, userId, say , notify, who }) => {
    const item = find(state.tasks, req.params.id, circle.id, 'Task');
    if (role !== 'owner' && item.createdBy !== userId) fail(403, 'Only the owner or the person who added it can delete it.');
    // ?series=later removes this one and the later repeats; ?series=all removes the whole series.
    const series = item.seriesId && ['later', 'all'].includes(req.query.series) ? req.query.series : '';
    const gone = (x) => x === item || (series && x.seriesId === item.seriesId && (series === 'all' || (x.dueDate || '') >= (item.dueDate || '')));
    const n = state.tasks.filter(gone).length;
    state.tasks = state.tasks.filter((x) => !gone(x));
    say(`deleted the task: ${item.title}${n > 1 ? ` (${n} repeats)` : ''}`);
  });
  res.status(204).end();
}));

// ---------- notes ----------

app.post('/api/circles/:circleId/notes', wrap(async (req, res) => {
  const n = await inCircle(req, 'postNotes', ({ state, circle, userId, say , notify, who }) => {
    const body = text(req.body.text, 2000);
    const ids = [...new Set([...(Array.isArray(req.body.fileIds) ? req.body.fileIds : []), req.body.fileId].map((x) => text(x, 60)).filter(Boolean))];
    if (ids.length > 6) fail(400, 'You can add up to 6 photos to one update.');
    if (!body && !ids.length) fail(400, 'Write a note or add a photo.');
    for (const id of ids) { const f = find(state.files, id, circle.id, 'Photo'); if (!f.type.startsWith('image/')) fail(400, 'Only photos can be added to an update.'); }
    const item = { id: randomUUID(), circleId: circle.id, authorUserId: userId, text: body, fileId: ids[0] || '', fileIds: ids, urgent: req.body.urgent === true, createdAt: new Date().toISOString(), reactions: {}, comments: [] };
    state.notes.push(item);
    say(item.urgent ? 'posted an URGENT note' : 'posted a care update');
    notify({ to: who('owner', 'family', 'helper', 'parent'), category: item.urgent ? 'emergency' : 'updates', priority: item.urgent ? 'urgent' : 'normal',
      title: `${item.urgent ? 'URGENT from ' : 'Update from '}${L.userName(state, userId)}`, body: body.slice(0, 140) || (ids.length > 1 ? `Shared ${ids.length} photos.` : 'Shared a photo.'), tab: 'updates', itemId: item.id });
    return item;
  });
  res.status(201).json(n);
}));

app.delete('/api/circles/:circleId/notes/:id', wrap(async (req, res) => {
  await inCircle(req, null, ({ state, circle, role, userId , notify, who }) => {
    const item = find(state.notes, req.params.id, circle.id, 'Note');
    if (item.authorUserId !== userId && role !== 'owner') fail(403, 'You can only delete your own notes.');
    state.notes = state.notes.filter((x) => x !== item);
  });
  res.status(204).end();
}));

// ---------- expenses, statements, PayNow ----------

const EXPENSE_CATEGORIES = ['medical', 'transport', 'supplies', 'food', 'helper', 'bills', 'other'];

app.post('/api/circles/:circleId/expenses', wrap(async (req, res) => {
  const e = await inCircle(req, 'editMoney', ({ state, circle, userId, say , notify, who }) => {
    const item = text(req.body.item, 80);
    const amount = money(req.body.amount);
    if (!item) fail(400, 'Enter what was bought.');
    if (!(amount > 0 && amount < 100000)) fail(400, 'Enter an amount in dollars, for example 18.50.');
    const ids = state.members.filter((m) => m.circleId === circle.id).map((m) => m.userId);
    const paidBy = ids.includes(req.body.paidByUserId) ? req.body.paidByUserId : userId;
    const mode = ['equal', 'ratio', 'fixed'].includes(req.body.splitMode) ? req.body.splitMode : 'equal';
    const shares = {};
    for (const [u, v] of Object.entries(req.body.shares || {})) if (ids.includes(u) && Number(v) > 0) shares[u] = mode === 'fixed' ? money(v) : Number(v);
    if (!Object.keys(shares).length) fail(400, 'Choose at least one person to share the cost.');
    if (mode === 'fixed') {
      const sum = money(Object.values(shares).reduce((a, b) => a + b, 0));
      if (Math.abs(sum - amount) > 0.001) fail(400, `Fixed amounts add up to S$${sum.toFixed(2)}, but the expense is S$${amount.toFixed(2)}.`);
    }
    const receiptFileId = text(req.body.receiptFileId, 60);
    if (receiptFileId) find(state.files, receiptFileId, circle.id, 'Receipt');
    const exp = {
      id: randomUUID(), circleId: circle.id, item, category: EXPENSE_CATEGORIES.includes(req.body.category) ? req.body.category : 'other',
      amount, paidByUserId: paidBy, spentOn: isDay(req.body.spentOn) ? req.body.spentOn : L.todaySG(), splitMode: mode, shares,
      receiptFileId, settlement: false, createdBy: userId, createdAt: new Date().toISOString(),
    };
    state.expenses.push(exp);
    say(`added an expense: ${item} S$${amount.toFixed(2)}`);
    const mine = L.sharesOf(exp);
    for (const u of Object.keys(shares).filter((x) => x !== paidBy)) {
      notify({ to: [u], category: 'money', title: `Your share: S$${((mine[u] || 0) / 100).toFixed(2)} for ${item}`, body: `Paid by ${L.userName(state, paidBy)}.`, tab: 'costs', itemId: exp.id });
    }
    return exp;
  });
  res.status(201).json(e);
}));

app.delete('/api/circles/:circleId/expenses/:id', wrap(async (req, res) => {
  await inCircle(req, 'editMoney', ({ state, circle, say , notify, who }) => {
    const item = find(state.expenses, req.params.id, circle.id, 'Expense');
    state.expenses = state.expenses.filter((x) => x !== item);
    say(`deleted the expense: ${item.item}`);
  });
  res.status(204).end();
}));

app.post('/api/circles/:circleId/settlements', wrap(async (req, res) => {
  const e = await inCircle(req, 'editMoney', ({ state, circle, userId, say , notify, who }) => {
    const amount = money(req.body.amount);
    const ids = state.members.filter((m) => m.circleId === circle.id).map((m) => m.userId);
    if (!(amount > 0) || !ids.includes(req.body.fromUserId) || !ids.includes(req.body.toUserId)) fail(400, 'Invalid settlement.');
    const from = L.userName(state, req.body.fromUserId), to = L.userName(state, req.body.toUserId);
    const exp = { id: randomUUID(), circleId: circle.id, item: `Settled up: ${from} paid ${to}`, category: 'other', amount, paidByUserId: req.body.fromUserId, spentOn: L.todaySG(), splitMode: 'equal', shares: { [req.body.toUserId]: 1 }, receiptFileId: '', settlement: true, createdBy: userId, createdAt: new Date().toISOString() };
    state.expenses.push(exp);
    say(`recorded that ${from} paid ${to} S$${amount.toFixed(2)}`);
    notify({ to: [req.body.toUserId, req.body.fromUserId], category: 'money', title: `Payment recorded: ${from} paid ${to} S$${amount.toFixed(2)}`, tab: 'costs' });
    return exp;
  });
  res.status(201).json(e);
}));

app.get('/api/circles/:circleId/statement', wrap(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : L.todaySG().slice(0, 7);
  const s = await inCircle(req, 'seeMoney', ({ state, circle , notify, who }) => L.statement(state, circle.id, month));
  if (req.query.format === 'csv') {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Date', 'Item', 'Category', 'Amount (SGD)', 'Paid by', 'Split']].concat(
      s.expenses.map((e) => [e.spentOn, e.item, e.category, e.amount.toFixed(2), s.people.find((p) => p.userId === e.paidByUserId)?.name || '', e.splitMode]),
      [[]], [['Person', 'Paid (SGD)', 'Share (SGD)', 'Difference (SGD)']], s.people.map((p) => [p.name, p.paid.toFixed(2), p.share.toFixed(2), p.difference.toFixed(2)]),
    );
    res.type('text/csv').set('Content-Disposition', `attachment; filename="famhub-statement-${month}.csv"`).send(rows.map((r) => r.map(q).join(',')).join('\r\n'));
    return;
  }
  res.json(s);
}));

app.get('/api/circles/:circleId/paynow-qr', wrap(async (req, res) => {
  const amount = money(req.query.amount);
  if (!(amount > 0 && amount < 100000)) fail(400, 'Invalid amount.');
  const to = await inCircle(req, 'seeMoney', ({ state, circle , notify, who }) => {
    if (!state.members.some((m) => m.circleId === circle.id && m.userId === req.query.to)) fail(404, 'Person not found.');
    return state.users.find((u) => u.id === req.query.to);
  });
  if (!to || !to.paynow) fail(404, 'This person has not saved a PayNow mobile yet.');
  const payload = payNowPayload({ mobile: to.paynow, amount, name: to.name, reference: 'Famhub' });
  const svg = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 240 });
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
}));

// ---------- payments with PayNow or PayLah! (4.8) ----------

const payWho = (state, circle, id) => (id === 'person' ? N.people(state, circle.id, ['parent']) : [id]);
function planNotify(state) {
  return (circle, p) => N.notify(state, { circleId: circle.id, to: p.fromId === 'person' ? [] : [p.fromId], category: 'money',
    title: `Time to pay ${PAY.nameOf(state, circle, p.toId)} S$${p.amount.toFixed(2)}`, body: `${PAY.label(p)}. Pay with PayNow or PayLah! in Famhub.`, tab: 'payments', itemId: p.id });
}

app.get('/api/circles/:circleId/payments', wrap(async (req, res) => {
  const v = await inCircle(req, null, ({ state, circle, userId, role }) => { PAY.runPlans(state, planNotify(state)); return PAY.view(state, circle, userId, role); });
  res.json(v);
}));

app.post('/api/circles/:circleId/payments', wrap(async (req, res) => {
  const out = await inCircle(req, null, ({ state, circle, userId, role, say, notify }) => {
    PAY.ensure(state);
    const b = req.body || {};
    const kind = PAY.KINDS.includes(b.kind) ? b.kind : fail(400, 'Choose what kind of payment this is.');
    const sub = PAY.SUBS[kind].includes(b.sub) ? b.sub : 'other';
    const amount = money(b.amount);
    if (!(amount > 0 && amount < 100000)) fail(400, 'Enter an amount in dollars, for example 50 or 12.80.');
    const members = state.members.filter((m) => m.circleId === circle.id);
    const roleOf = (id) => (members.find((m) => m.userId === id) || {}).role;
    const family = (id) => ['owner', 'family'].includes(roleOf(id));
    const reason = text(b.reason, 80);
    let fromId = b.fromId, toId = b.toId;
    if (kind === 'request') {
      toId = toId === 'person' && ['owner', 'family', 'parent'].includes(role) ? 'person' : userId;
      if (!roleOf(fromId) || fromId === userId) fail(400, 'Choose who you are asking to pay.');
    } else {
      if (!L.can(role, 'editMoney')) fail(403, 'Only the owner and family can set up helper pay and allowances.');
      fromId = family(fromId) ? fromId : userId;
      if (kind === 'helper' && roleOf(toId) !== 'helper') fail(400, 'Choose the helper to pay. Add the helper to the circle first (Circle and people).');
      if (kind === 'allowance' && toId !== 'person' && !roleOf(toId)) fail(400, 'Choose who gets the allowance.');
      if (toId === fromId) fail(400, 'The person paying and the person paid must be different.');
    }
    const dueOn = isDay(b.dueOn) ? b.dueOn : PAY.sgToday();
    const addToCosts = kind !== 'request' && !!b.addToCosts;
    const repeat = b.repeat && ['week', 'month'].includes(b.repeat.every) && kind !== 'request' ? b.repeat : null;
    let plan = null;
    if (repeat) {
      const day = repeat.every === 'week' ? Math.max(0, Math.min(6, Number(repeat.day) || 0)) : Math.max(1, Math.min(31, Number(repeat.day) || 1));
      plan = { id: randomUUID(), circleId: circle.id, kind, sub, fromId, toId, amount, reason, every: repeat.every, day, startOn: dueOn, lastOn: '', active: true, addToCosts, createdBy: userId, createdAt: new Date().toISOString() };
      state.payPlans.push(plan);
    }
    let p = null;
    if (!plan || PAY.nextDue(plan, dueOn) <= PAY.sgToday()) {
      p = PAY.makePayment(state, circle, { kind, sub, fromId, toId, amount, reason, dueOn, addToCosts, planId: plan ? plan.id : '' }, userId);
      if (plan) plan.lastOn = PAY.nextDue(plan, dueOn);
    }
    const toName = PAY.nameOf(state, circle, toId), fromName = PAY.nameOf(state, circle, fromId);
    const what = PAY.label({ kind, sub, reason });
    say(kind === 'request' ? `asked ${fromName} for S$${amount.toFixed(2)} (${what})` : `set up ${what} of S$${amount.toFixed(2)} from ${fromName} to ${toName}${plan ? `, every ${plan.every}` : ''}`);
    if (p && fromId !== userId) notify({ to: [fromId], category: 'money', title: kind === 'request' ? `${L.userName(state, userId)} asked you for S$${amount.toFixed(2)}` : `Please pay ${toName} S$${amount.toFixed(2)}`, body: `${what}. Pay with PayNow or PayLah! in Famhub.`, tab: 'payments', itemId: p.id });
    return { payment: p, plan };
  });
  res.status(201).json(out);
}));

function payAction(action) {
  return wrap(async (req, res) => {
    const out = await inCircle(req, null, ({ state, circle, userId, role, say, notify }) => {
      PAY.ensure(state);
      const p = find(state.payments, req.params.id, circle.id, 'Payment');
      if (!PAY.visible(p, userId, role)) fail(404, 'Payment not found.');
      const toName = PAY.nameOf(state, circle, p.toId), fromName = PAY.nameOf(state, circle, p.fromId);
      const amt = `S$${p.amount.toFixed(2)}`;
      if (action === 'paid') {
        if (p.status !== 'due' || !PAY.isPayer(p, userId, role)) fail(400, 'This payment cannot be marked as paid.');
        p.status = 'paid'; p.method = PAY.METHODS.includes(req.body.method) ? req.body.method : 'paynow'; p.paidAt = new Date().toISOString(); p.paidBy = userId;
        if (p.toId === 'person' && !N.people(state, circle.id, ['parent']).length) { p.status = 'received'; p.receivedAt = p.paidAt; }
        if (p.addToCosts) {
          const fam = state.members.filter((m) => m.circleId === circle.id && ['owner', 'family'].includes(m.role)).map((m) => m.userId);
          const shares = Object.fromEntries(fam.map((u) => [u, 1]));
          if (fam.length && p.fromId !== 'person') {
            state.expenses.push({ id: randomUUID(), circleId: circle.id, item: `${PAY.label(p)} (${toName})`, category: p.kind === 'helper' ? 'helper' : 'other', amount: p.amount, paidByUserId: p.fromId, spentOn: PAY.sgToday(), splitMode: 'equal', shares, receiptFileId: '', settlement: false, paymentId: p.id, createdBy: userId, createdAt: new Date().toISOString() });
          }
        }
        say(`paid ${toName} ${amt} by ${PAY.METHOD_LABEL[p.method]} (${PAY.label(p)})`);
        notify({ to: payWho(state, circle, p.toId), category: 'money', title: `${fromName} paid you ${amt} by ${PAY.METHOD_LABEL[p.method]}`, body: `${PAY.label(p)}. Reference ${p.ref}. Tap "Got it" once you see it in your account.`, tab: 'payments', itemId: p.id });
      } else if (action === 'received') {
        if (p.status !== 'paid' || !PAY.isPayee(p, userId, role)) fail(400, 'Only the person paid can confirm this.');
        p.status = 'received'; p.receivedAt = new Date().toISOString();
        say(`confirmed receiving ${amt} from ${fromName}`);
        notify({ to: [p.fromId], category: 'money', title: `${toName} received your ${amt}`, body: PAY.label(p), tab: 'payments', itemId: p.id });
      } else if (action === 'decline') {
        if (p.status !== 'due' || p.kind !== 'request' || p.fromId !== userId) fail(400, 'Only the person asked can decline a request.');
        p.status = 'declined'; p.declinedAt = new Date().toISOString(); p.declineNote = text(req.body.note, 120);
        say(`declined ${toName}'s request for ${amt}`);
        notify({ to: payWho(state, circle, p.toId), category: 'money', title: `${fromName} declined your request for ${amt}`, body: p.declineNote || PAY.label(p), tab: 'payments', itemId: p.id });
      } else if (action === 'cancel') {
        if (p.status !== 'due' || !(p.createdBy === userId || role === 'owner')) fail(400, 'This payment cannot be cancelled.');
        p.status = 'cancelled';
        say(`cancelled the payment ${PAY.label(p)} (${amt})`);
      } else if (action === 'remind') {
        if (p.status !== 'due') fail(400, 'This payment is not waiting.');
        if (p.remindedAt && Date.now() - new Date(p.remindedAt).getTime() < 3600e3) fail(429, 'A reminder was sent less than an hour ago.');
        p.remindedAt = new Date().toISOString();
        notify({ to: [p.fromId], category: 'money', title: `Reminder: pay ${toName} ${amt}`, body: `${PAY.label(p)}. Pay with PayNow or PayLah! in Famhub.`, tab: 'payments', itemId: p.id });
      }
      return p;
    });
    res.json(out);
  });
}
for (const a of ['paid', 'received', 'decline', 'cancel', 'remind']) app.post(`/api/circles/:circleId/payments/:id/${a}`, payAction(a));

app.patch('/api/circles/:circleId/payplans/:id', wrap(async (req, res) => {
  const out = await inCircle(req, 'editMoney', ({ state, circle, say }) => {
    PAY.ensure(state);
    const plan = find(state.payPlans, req.params.id, circle.id, 'Repeating payment');
    if (req.body.active !== undefined) plan.active = !!req.body.active;
    if (req.body.amount !== undefined) { const a = money(req.body.amount); if (!(a > 0 && a < 100000)) fail(400, 'Enter a valid amount.'); plan.amount = a; }
    say(`${plan.active ? 'updated' : 'paused'} the repeating payment ${PAY.label(plan)}`);
    return plan;
  });
  res.json(out);
}));

app.delete('/api/circles/:circleId/payplans/:id', wrap(async (req, res) => {
  await inCircle(req, 'editMoney', ({ state, circle, say }) => {
    PAY.ensure(state);
    const plan = find(state.payPlans, req.params.id, circle.id, 'Repeating payment');
    state.payPlans = state.payPlans.filter((x) => x !== plan);
    say(`stopped the repeating payment ${PAY.label(plan)}`);
  });
  res.status(204).end();
}));

// The PayNow mobile of the person the circle is for (a kid, teen or parent without their own account).
app.put('/api/circles/:circleId/person-paynow', wrap(async (req, res) => {
  const out = await inCircle(req, null, ({ circle, role, say }) => {
    if (!['owner', 'family', 'parent'].includes(role)) fail(403, 'Only the owner, family or the person themselves can change this.');
    const raw = text(req.body.paynow, 20);
    const m = raw ? normaliseMobile(raw) : '';
    if (raw && !m) fail(400, 'PayNow mobile must be a Singapore mobile number, for example 9123 4567.');
    circle.personPaynow = m;
    say(m ? `saved ${circle.parentName}'s PayNow mobile` : `removed ${circle.parentName}'s PayNow mobile`);
    return { paynow: m };
  });
  res.json(out);
}));

// PayNow QR for one payment. PayLah! and all Singapore banking apps scan it. format=png for saving to the phone's photos.
app.get('/api/circles/:circleId/payments/:id/qr', wrap(async (req, res) => {
  const info = await inCircle(req, null, ({ state, circle, userId, role }) => {
    PAY.ensure(state);
    const p = find(state.payments, req.params.id, circle.id, 'Payment');
    if (!PAY.visible(p, userId, role)) fail(404, 'Payment not found.');
    return { p, mobile: PAY.payNowOf(state, circle, p.toId), name: PAY.nameOf(state, circle, p.toId) };
  });
  if (!info.mobile) fail(404, `${info.name} has not saved a PayNow mobile yet.`);
  const payload = payNowPayload({ mobile: info.mobile, amount: info.p.amount, name: info.name, reference: info.p.ref });
  if (req.query.format === 'png') {
    const png = await QRCode.toBuffer(payload, { type: 'png', errorCorrectionLevel: 'M', margin: 3, width: 600 });
    res.type('image/png').set('Cache-Control', 'no-store').set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="paynow-${info.p.ref}.png"`).send(png);
    return;
  }
  const svg = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 260 });
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
}));

// The payee's PayNow mobile, shown to the payer to copy into PayLah! or a bank app ("pay to mobile").
app.get('/api/circles/:circleId/payments/:id/details', wrap(async (req, res) => {
  const out = await inCircle(req, null, ({ state, circle, userId, role }) => {
    PAY.ensure(state);
    const p = find(state.payments, req.params.id, circle.id, 'Payment');
    if (!PAY.visible(p, userId, role) || !(p.status === 'due' && PAY.isPayer(p, userId, role))) fail(404, 'Payment not found.');
    return { mobile: PAY.payNowOf(state, circle, p.toId), name: PAY.nameOf(state, circle, p.toId), amount: p.amount, ref: p.ref };
  });
  res.json(out);
}));

// ---------- files, documents ----------

const FILE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'application/pdf': '.pdf' };

app.post('/api/circles/:circleId/files', express.raw({ type: Object.keys(FILE_TYPES), limit: '8mb' }), wrap(async (req, res) => {
  const type = (req.get('content-type') || '').split(';')[0];
  if (!FILE_TYPES[type] || !Buffer.isBuffer(req.body) || !req.body.length) fail(400, 'Only photos (JPG, PNG, WEBP, HEIC) and PDF files up to 8 MB can be uploaded.');
  const name = text(decodeURIComponent(req.get('x-file-name') || 'file'), 120) || 'file';
  const f = await inCircle(req, null, ({ state, circle, role, userId , notify, who }) => {
    if (role === 'parent' && !type.startsWith('image/')) fail(403, 'Parents can upload photos only.');
    const id = randomUUID();
    fs.writeFileSync(path.join(store.filesDir, id), req.body);
    const item = { id, circleId: circle.id, name, type, size: req.body.length, uploadedBy: userId, uploadedAt: new Date().toISOString() };
    state.files.push(item);
    return item;
  });
  res.status(201).json(f);
}));

app.get('/api/files/:fileId', wrap(async (req, res) => {
  const user = me(req);
  const state = await store.read();
  const f = state.files.find((x) => x.id === req.params.fileId);
  const member = f && state.members.find((m) => m.circleId === f.circleId && m.userId === user.id);
  if (!member) fail(404, 'File not found.');
  const doc = state.documents.find((d) => d.fileId === f.id);
  if (doc && !L.can(member.role, 'seeAllDocuments') && !(member.role === 'helper' && doc.shareWithHelper)) fail(403, 'You do not have access to this document.');
  if (state.expenses.some((e) => e.receiptFileId === f.id) && !L.can(member.role, 'seeMoney')) fail(403, 'You do not have access to this receipt.');
  const disk = path.join(store.filesDir, f.id);
  if (!fs.existsSync(disk)) fail(404, 'File is missing.');
  res.type(f.type).set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${f.name.replace(/"/g, '')}"`).set('Cache-Control', 'private, max-age=300');
  fs.createReadStream(disk).pipe(res);
}));

const DOC_CATEGORIES = ['appointment', 'discharge', 'insurance', 'scheme', 'identity', 'other'];

app.post('/api/circles/:circleId/documents', wrap(async (req, res) => {
  const d = await inCircle(req, 'editDocuments', ({ state, circle, userId, say , notify, who }) => {
    const title = text(req.body.title, 80);
    const fileId = text(req.body.fileId, 60);
    if (!title) fail(400, 'Enter a title for the document.');
    find(state.files, fileId, circle.id, 'Uploaded file');
    const item = { id: randomUUID(), circleId: circle.id, title, category: DOC_CATEGORIES.includes(req.body.category) ? req.body.category : 'other', fileId, shareWithHelper: req.body.shareWithHelper === true, uploadedBy: userId, uploadedAt: new Date().toISOString() };
    state.documents.push(item);
    say(`added a document: ${title}`);
    if (item.shareWithHelper) notify({ to: who('helper'), category: 'updates', title: `Document shared with you: ${title}`, tab: 'docs', itemId: item.id });
    return item;
  });
  res.status(201).json(d);
}));

app.patch('/api/circles/:circleId/documents/:id', wrap(async (req, res) => {
  const d = await inCircle(req, 'editDocuments', ({ state, circle , notify, who }) => {
    const item = find(state.documents, req.params.id, circle.id, 'Document');
    if (typeof req.body.shareWithHelper === 'boolean') item.shareWithHelper = req.body.shareWithHelper;
    if (req.body.title !== undefined) item.title = text(req.body.title, 80) || item.title;
    return item;
  });
  res.json(d);
}));

app.delete('/api/circles/:circleId/documents/:id', wrap(async (req, res) => {
  await inCircle(req, 'editDocuments', ({ state, circle, say , notify, who }) => {
    const item = find(state.documents, req.params.id, circle.id, 'Document');
    state.documents = state.documents.filter((x) => x !== item);
    say(`deleted the document: ${item.title}`);
  });
  res.status(204).end();
}));

// ---------- medicines ----------

function readMedication(body, into) {
  if (body.name !== undefined) { into.name = text(body.name, 60); if (!into.name) fail(400, 'Enter the medicine name as written on the label.'); }
  if (body.dose !== undefined) into.dose = text(body.dose, 60);
  if (body.instructions !== undefined) into.instructions = text(body.instructions, 120);
  if (body.times !== undefined) {
    const times = (Array.isArray(body.times) ? body.times : String(body.times).split(',')).map((t) => String(t).trim()).filter(Boolean);
    if (!times.length || !times.every(isTime)) fail(400, 'Enter times like 08:00, 20:00.');
    into.times = [...new Set(times)].sort();
  }
  if (typeof body.active === 'boolean') into.active = body.active;
  if (body.supply !== undefined) {
    const v = body.supply === '' || body.supply === null ? null : Number(body.supply);
    if (v !== null && !(v >= 0 && v < 10000)) fail(400, 'Supply must be a number of tablets or doses left.');
    into.supply = v === null ? null : Math.round(v * 10) / 10;
  }
  if (body.perDose !== undefined) into.perDose = Math.max(0, Number(body.perDose) || 0);
  if (body.refillAt !== undefined) into.refillAt = Math.max(0, Number(body.refillAt) || 0);
  if (body.refilled === true) into.refilledAt = new Date().toISOString();
  if (body.repeat !== undefined || body.startDate !== undefined) {
    // Which days the medicine is taken (none = every day).
    into.startDate = isDay(body.startDate) ? body.startDate : (into.startDate || L.todaySG());
    const rule = R.clean(body.repeat !== undefined ? body.repeat : into.repeat, into.startDate, { openEnded: true });
    into.repeat = rule; into.repeatText = rule ? R.describe(rule) : '';
  }
  return into;
}

app.post('/api/circles/:circleId/medications', wrap(async (req, res) => {
  const m = await inCircle(req, 'editMedications', ({ state, circle, userId, say , notify, who }) => {
    const item = readMedication(req.body, { id: randomUUID(), circleId: circle.id, name: '', dose: '', times: [], instructions: '', active: true, supply: null, perDose: 1, refillAt: 7, createdBy: userId, createdAt: new Date().toISOString() });
    if (!item.name || !item.times.length) fail(400, 'Enter the medicine name and at least one time.');
    item.fileIds = photoIds(state, circle.id, req.body.fileIds);
    state.medications.push(item);
    say(`added a medicine to the schedule: ${item.name}`);
    return item;
  });
  res.status(201).json(m);
}));

app.patch('/api/circles/:circleId/medications/:id', wrap(async (req, res) => {
  const m = await inCircle(req, 'editMedications', ({ state, circle, say , notify, who }) => {
    const item = readMedication(req.body, find(state.medications, req.params.id, circle.id, 'Medicine'));
    if (req.body.fileIds !== undefined) item.fileIds = photoIds(state, circle.id, req.body.fileIds);
    say(`updated the medicine schedule: ${item.name}${item.active ? '' : ' (stopped)'}`);
    return item;
  });
  res.json(m);
}));

app.delete('/api/circles/:circleId/medications/:id', wrap(async (req, res) => {
  await inCircle(req, 'editMedications', ({ state, circle, say , notify, who }) => {
    const item = find(state.medications, req.params.id, circle.id, 'Medicine');
    state.medications = state.medications.filter((x) => x !== item);
    say(`removed ${item.name} from the schedule`);
  });
  res.status(204).end();
}));

app.post('/api/circles/:circleId/doses', wrap(async (req, res) => {
  const r = await inCircle(req, 'logDoses', ({ state, circle, userId, say , notify, who }) => {
    const med = find(state.medications, req.body.medicationId, circle.id, 'Medicine');
    const time = req.body.time;
    if (!med.times.includes(time)) fail(400, 'That time is not in the schedule.');
    const date = L.todaySG();
    const existing = state.doseLogs.find((l) => l.medicationId === med.id && l.date === date && l.time === time);
    if (req.body.taken === false) {
      if (existing && med.supply !== null && med.supply !== undefined) med.supply += med.perDose || 0;
      state.doseLogs = state.doseLogs.filter((l) => l !== existing);
      say(`unticked ${med.name} at ${time}`);
      return { taken: false };
    }
    if (!existing) {
      if (L.doseLocked(time)) fail(400, `Not yet. You can tick this from ${time}.`);
      state.doseLogs.push({ id: randomUUID(), circleId: circle.id, medicationId: med.id, date, time, takenAt: new Date().toISOString(), recordedBy: userId });
      if (med.supply !== null && med.supply !== undefined) med.supply = Math.max(0, med.supply - (med.perDose || 0));
      // The reminder for this dose is no longer needed.
      for (const n of state.notifications.filter((x) => x.circleId === circle.id && x.itemId === `${med.id}|${time}` && !x.readAt && x.createdAt.slice(0, 10) >= new Date(Date.now() - 86400e3).toISOString().slice(0, 10))) n.readAt = new Date().toISOString();
    }
    say(`ticked ${med.name} at ${time} as taken`);
    return { taken: true };
  });
  res.json(r);
}));

// ---------- renewals ----------

app.post('/api/circles/:circleId/renewals', wrap(async (req, res) => {
  const r = await inCircle(req, 'editRenewals', ({ state, circle, userId, say , notify, who }) => {
    const title = text(req.body.title, 80);
    if (!title || !isDay(req.body.dueDate)) fail(400, 'Enter what needs renewing and the due date.');
    const item = { id: randomUUID(), circleId: circle.id, title, dueDate: req.body.dueDate, notes: text(req.body.notes, 300), fileIds: photoIds(state, circle.id, req.body.fileIds), createdBy: userId, doneAt: '' };
    state.renewals.push(item);
    say(`added a renewal reminder: ${title}`);
    return item;
  });
  res.status(201).json(r);
}));

app.patch('/api/circles/:circleId/renewals/:id', wrap(async (req, res) => {
  const r = await inCircle(req, 'editRenewals', ({ state, circle, say , notify, who }) => {
    const item = find(state.renewals, req.params.id, circle.id, 'Renewal');
    if (req.body.done === true) { item.doneAt = new Date().toISOString(); say(`marked ${item.title} as renewed`); }
    if (req.body.done === false) item.doneAt = '';
    if (isDay(req.body.dueDate)) { item.dueDate = req.body.dueDate; item.doneAt = ''; say(`set the next due date for ${item.title}`); }
    if (req.body.notes !== undefined) item.notes = text(req.body.notes, 300);
    if (req.body.fileIds !== undefined) item.fileIds = photoIds(state, circle.id, req.body.fileIds);
    return item;
  });
  res.json(r);
}));

app.delete('/api/circles/:circleId/renewals/:id', wrap(async (req, res) => {
  await inCircle(req, 'editRenewals', ({ state, circle , notify, who }) => {
    const item = find(state.renewals, req.params.id, circle.id, 'Renewal');
    state.renewals = state.renewals.filter((x) => x !== item);
  });
  res.status(204).end();
}));

// ---------- check-ins and help ----------

app.post('/api/circles/:circleId/checkins', wrap(async (req, res) => {
  const c = await inCircle(req, 'checkIn', ({ state, circle, userId, name, say , notify, who }) => {
    const kind = req.body.kind === 'help' ? 'help' : 'ok';
    const item = { id: randomUUID(), circleId: circle.id, recordedBy: userId, kind, createdAt: new Date().toISOString(), resolvedAt: '', resolvedBy: '' };
    state.checkins.push(item);
    if (kind === 'help') {
      state.notes.push({ id: randomUUID(), circleId: circle.id, authorUserId: userId, text: `${circle.parentName} pressed "I need help".`, fileId: '', urgent: true, createdAt: item.createdAt, reactions: {}, comments: [] });
      say(`pressed I need help for ${circle.parentName}`);
      notify({ to: who('owner', 'family', 'helper'), category: 'emergency', priority: 'urgent', title: `${circle.parentName} needs help`,
        body: `${circle.parentPhone ? `Call ${circle.parentPhone} now. ` : ''}Tap "I'm handling it" so the others know.`, tab: 'home', itemId: item.id, actions: [{ id: 'help-handle', label: "I'm handling it" }, { id: 'help-cancel', label: 'False alarm' }] });
    } else {
      say(`checked in: ${circle.parentName} is OK`);
      for (const n of state.notifications.filter((x) => x.circleId === circle.id && !x.readAt && /^checkin-(late|escalate):/.test(x.key))) n.readAt = new Date().toISOString();
    }
    return item;
  });
  res.status(201).json(c);
}));

app.post('/api/circles/:circleId/checkins/:id/resolve', wrap(async (req, res) => {
  const c = await inCircle(req, null, ({ state, circle, role, userId, say , notify, who }) => {
    if (role === 'parent') fail(403, 'Family or the helper will respond.');
    const item = find(state.checkins, req.params.id, circle.id, 'Help request');
    if (item.resolvedAt) return item;
    item.resolvedAt = new Date().toISOString(); item.resolvedBy = userId;
    say(`is handling ${circle.parentName}'s help request`);
    for (const n of state.notifications.filter((x) => x.circleId === circle.id && x.itemId === item.id && !x.readAt)) n.readAt = new Date().toISOString();
    notify({ to: who('owner', 'family', 'helper', 'parent'), category: 'emergency', priority: 'important', title: `${L.userName(state, userId)} is handling it`, body: `${circle.parentName}'s help request has been picked up.`, tab: 'home', itemId: item.id });
    return item;
  });
  res.json(c);
}));

// "I need help" pressed by mistake: the parent (or anyone in the circle) cancels it as a false alarm.
// Everyone is told, the flashing alerts and repeat alerts stop, and a parent's cancel also counts as "I'm OK".
app.post('/api/circles/:circleId/checkins/:id/cancel', wrap(async (req, res) => {
  const c = await inCircle(req, null, ({ state, circle, role, userId, say, notify, who }) => {
    const item = find(state.checkins, req.params.id, circle.id, 'Help request');
    if (item.kind !== 'help') fail(400, 'Only a help request can be cancelled.');
    if (item.cancelledAt) return item;
    const now = new Date().toISOString();
    item.cancelledAt = now; item.cancelledBy = userId;
    if (!item.resolvedAt) { item.resolvedAt = now; item.resolvedBy = userId; }
    const byParent = role === 'parent';
    const who2 = byParent ? circle.parentName : L.userName(state, userId);
    for (const n of state.notifications.filter((x) => x.circleId === circle.id && !x.readAt && (x.itemId === item.id || x.category === 'emergency' && /needs help/.test(x.title)))) n.readAt = now;
    const note = state.notes.find((n) => n.circleId === circle.id && n.urgent && n.createdAt === item.createdAt);
    if (note) { note.urgent = false; note.text = `${note.text} Cancelled: pressed by mistake (${who2}).`; }
    if (byParent) {
      state.checkins.push({ id: randomUUID(), circleId: circle.id, recordedBy: userId, kind: 'ok', createdAt: now, resolvedAt: '', resolvedBy: '' });
      for (const n of state.notifications.filter((x) => x.circleId === circle.id && !x.readAt && /^checkin-(late|escalate):/.test(x.key))) n.readAt = now;
    }
    say(byParent ? `cancelled the help call: pressed by mistake, ${circle.parentName} is OK` : `cancelled ${circle.parentName}'s help call as a false alarm`);
    notify({ to: who('owner', 'family', 'helper', 'parent'), except: userId, category: 'emergency', priority: 'important', title: `False alarm: ${circle.parentName} is OK`,
      body: byParent ? `${circle.parentName} pressed "I need help" by mistake and cancelled it.` : `${who2} cancelled the help call (pressed by mistake).`, tab: 'home', itemId: item.id });
    return item;
  });
  res.json(c);
}));

// ---------- care updates: thanks and comments ----------

app.post('/api/circles/:circleId/notes/:id/react', wrap(async (req, res) => {
  const n = await inCircle(req, 'postNotes', ({ state, circle, userId, notify }) => {
    const item = find(state.notes, req.params.id, circle.id, 'Update');
    item.reactions = item.reactions || {};
    if (item.reactions[userId]) delete item.reactions[userId];
    else {
      item.reactions[userId] = 'thanks';
      notify({ to: [item.authorUserId], category: 'updates', title: `${L.userName(state, userId)} said thanks`, body: (item.text || 'Your photo').slice(0, 100), tab: 'updates', itemId: item.id, key: `thanks:${item.id}:${userId}` });
    }
    return item;
  });
  res.json(n);
}));

app.post('/api/circles/:circleId/notes/:id/comments', wrap(async (req, res) => {
  const n = await inCircle(req, 'postNotes', ({ state, circle, userId, notify }) => {
    const item = find(state.notes, req.params.id, circle.id, 'Update');
    const body = text(req.body.text, 1000);
    if (!body) fail(400, 'Write a comment first.');
    item.comments = item.comments || [];
    item.comments.push({ id: randomUUID(), userId, text: body, createdAt: new Date().toISOString() });
    notify({ to: [item.authorUserId, ...item.comments.map((x) => x.userId)], category: 'updates', title: `${L.userName(state, userId)} commented`, body: body.slice(0, 140), tab: 'updates', itemId: item.id });
    return item;
  });
  res.status(201).json(n);
}));

// ---------- notifications: inbox, preferences, device push ----------

app.get('/api/notifications', wrap(async (req, res) => {
  const user = me(req);
  const state = await store.read();
  const list = state.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const circleNames = Object.fromEntries(state.circles.map((c) => [c.id, c.name]));
  res.json({
    unread: list.filter((n) => !n.readAt && !n.digest).length,
    urgentUnread: list.filter((n) => !n.readAt && n.priority === 'urgent').length,
    items: list.slice(0, 150).map((n) => ({ ...n, circleName: circleNames[n.circleId] || '' })),
  });
}));

app.post('/api/notifications/read', wrap(async (req, res) => {
  const user = me(req);
  const ids = Array.isArray(req.body.ids) ? req.body.ids : null;
  await store.update((state) => {
    const now = new Date().toISOString();
    for (const n of state.notifications) if (n.userId === user.id && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = now;
  });
  res.status(204).end();
}));

app.get('/api/prefs', wrap(async (req, res) => {
  const user = me(req);
  const state = await store.read();
  const m = state.members.find((x) => x.userId === user.id);
  const p = N.prefsFor(state, user.id, m ? m.role : 'family');
  if (!p.email.address && user.email) p.email.address = user.email;
  res.json({ ...p, catalogue: N.CATEGORIES, modes: N.MODES, devices: state.pushSubs.filter((s) => s.userId === user.id).length, emailSetup: Email.mode(), whatsappSetup: WhatsApp.mode() });
}));

// Sends a test email to the address in the person's settings.
app.post('/api/email/test', wrap(async (req, res) => {
  const user = me(req);
  const state = await store.read();
  const m = state.members.find((x) => x.userId === user.id);
  const p = N.prefsFor(state, user.id, m ? m.role : 'family');
  const to = text(req.body.address, 120) || p.email.address;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) fail(400, 'Enter a valid email address first.');
  const r = await Email.send(to, { id: 'test', title: 'Famhub test email', body: 'Email alerts are working. You will get alerts like this when something needs attention.', priority: 'normal' }, '');
  res.json(r);
}));

// Sends a test WhatsApp message to the number in the person's settings.
app.post('/api/whatsapp/test', wrap(async (req, res) => {
  const user = me(req);
  const state = await store.read();
  const m = state.members.find((x) => x.userId === user.id);
  const p = N.prefsFor(state, user.id, m ? m.role : 'family');
  const to = WhatsApp.normalise(text(req.body.number, 30) || p.whatsapp.number);
  if (!to) fail(400, 'Enter your mobile number first.');
  res.json(await WhatsApp.send(to, { id: 'test', title: 'Famhub test message', body: 'WhatsApp alerts are working. You will get alerts like this when something needs attention.', priority: 'normal' }));
}));

// Test mode: the last 200 emails and WhatsApp messages the app tried to send.
app.get('/api/test/outbox', wrap(async (req, res) => {
  testOnly(req);
  res.json({ email: Email.mode(), whatsapp: WhatsApp.mode(), messages: Outbox.list() });
}));

app.put('/api/prefs', wrap(async (req, res) => {
  const user = me(req);
  const b = req.body || {};
  const p = await store.update((state) => {
    const cur = state.prefs[user.id] || {};
    const categories = { ...(cur.categories || {}) };
    for (const [k, v] of Object.entries(b.categories || {})) if (N.CATEGORIES[k] && !N.CATEGORIES[k].locked && N.MODES.includes(v)) categories[k] = v;
    for (const k of ['quietStart', 'quietEnd', 'digestTime']) if (b[k] !== undefined && !isTime(b[k])) fail(400, 'Times must look like 22:00.');
    let email = cur.email;
    if (b.email) {
      const address = text(b.email.address, 120);
      if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) fail(400, 'Enter a valid email address.');
      if (b.email.on && !address) fail(400, 'Enter your email address to turn on email alerts.');
      const cats = Array.isArray(b.email.categories) ? b.email.categories.filter((k) => N.CATEGORIES[k]) : undefined;
      email = { address, on: !!b.email.on && !!address, categories: cats || (cur.email && cur.email.categories) || N.EMAIL_DEFAULT };
    }
    let whatsapp = cur.whatsapp;
    if (b.whatsapp) {
      const raw = text(b.whatsapp.number, 30);
      const number = raw ? WhatsApp.normalise(raw) : '';
      if (raw && !number) fail(400, 'Enter a mobile number such as 9123 4567, or +60 12 345 6789 for other countries.');
      if (b.whatsapp.on && !number) fail(400, 'Enter your mobile number to turn on WhatsApp alerts.');
      const cats = Array.isArray(b.whatsapp.categories) ? b.whatsapp.categories.filter((k) => N.CATEGORIES[k]) : undefined;
      whatsapp = { number, on: !!b.whatsapp.on && !!number, categories: cats || (cur.whatsapp && cur.whatsapp.categories) || N.EMAIL_DEFAULT };
    }
    state.prefs[user.id] = { categories, quietStart: b.quietStart || cur.quietStart, quietEnd: b.quietEnd || cur.quietEnd, digestTime: b.digestTime || cur.digestTime, email, whatsapp };
    const m = state.members.find((x) => x.userId === user.id);
    return N.prefsFor(state, user.id, m ? m.role : 'family');
  });
  res.json(p);
}));

app.get('/api/push/key', (req, res) => res.json({ publicKey: VAPID_PUBLIC_KEY }));

app.post('/api/push/subscribe', wrap(async (req, res) => {
  const user = me(req);
  const sub = req.body && req.body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys || !sub.keys.p256dh || !sub.keys.auth || !/^https:\/\//.test(sub.endpoint)) fail(400, 'Invalid push subscription.');
  await store.update((state) => {
    state.pushSubs = state.pushSubs.filter((x) => x.subscription.endpoint !== sub.endpoint);
    state.pushSubs.push({ userId: user.id, subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, device: text(req.body.device, 80), createdAt: new Date().toISOString() });
  });
  res.status(201).json({ ok: true });
}));

app.post('/api/push/unsubscribe', wrap(async (req, res) => {
  const user = me(req);
  await store.update((state) => { state.pushSubs = state.pushSubs.filter((x) => !(x.userId === user.id && x.subscription.endpoint === req.body.endpoint)); });
  res.status(204).end();
}));

app.post('/api/push/test', wrap(async (req, res) => {
  const user = me(req);
  const count = await store.update((state) => {
    const m = state.members.find((x) => x.userId === user.id);
    if (!m) fail(400, 'Join a circle first.');
    const n = { id: randomUUID(), userId: user.id, circleId: m.circleId, category: 'updates', priority: 'normal', title: 'Famhub test notification', body: 'Notifications are working on this device.', tab: 'inbox', itemId: '', actions: [], key: '', createdAt: new Date().toISOString(), readAt: '', digest: false, pushAt: '', pushedAt: '' };
    state.notifications.push(n);
    N.queuePush(state, n);
    return state.pushSubs.filter((s) => s.userId === user.id).length;
  });
  res.json({ devices: count });
}));

// Test mode: run the reminder checks now instead of waiting for the next minute.
app.post('/api/test/run-checks', wrap(async (req, res) => {
  if (!testModeAllowed(req)) fail(403, 'Test mode is off.');
  await store.update((state) => N.runSchedule(state));
  res.json({ ok: true });
}));

// ---------- web app and errors ----------

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { maxAge: '1h' }));
app.use((req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large (8 MB maximum).' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Check the Log stream in the Azure portal.' });
});

// Reminders and escalations run every minute.
setInterval(() => { store.update((state) => { PAY.runPlans(state, planNotify(state)); return N.runSchedule(state); }).catch((e) => console.error('schedule', e)); }, 60000);
setTimeout(() => { store.update((state) => N.runSchedule(state)).catch((e) => console.error('schedule', e)); }, 3000);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Famhub ${APP_VERSION} running on http://localhost:${port} (storage: ${store.kind}; ${A.isLive() ? 'LIVE mode: real accounts, no test tools' : 'TEST mode'})`));
