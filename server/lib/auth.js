// Who is making the request, and signing in and out.
//
// Two ways to be signed in:
//  1. Microsoft sign-in on Azure: App Service Authentication adds the person's ID and name as headers.
//  2. Test mode (always on your PC; on Azure only when the app setting TEST_MODE is "true"):
//     sign in to a test account with a username and password. The app then keeps a signed
//     session cookie ("famhub_session") until you sign out or 30 days pass.
// In test mode everyone must sign in on the Famhub sign-in page (a Microsoft user can pick
// "Continue as <name>"), so "Sign out" always returns to that page.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEMO_USERS } = require('./seed');
const { isLive } = require('./mode');

const SESSION_COOKIE = 'famhub_session';
const OLD_COOKIE = 'ecare_test_user';
const SESSION_DAYS = 30;
const DEFAULT_TEST_PASSWORD = 'Famhub2026!';
const testPassword = () => process.env.TEST_PASSWORD || DEFAULT_TEST_PASSWORD;

let secret = null;
function sessionSecret() {
  if (secret) return secret;
  if (process.env.SESSION_SECRET) return (secret = process.env.SESSION_SECRET);
  const store = require('./store');
  const file = path.join(store.dataDir, 'session-secret');
  try { secret = fs.readFileSync(file, 'utf8').trim(); } catch { /* first run */ }
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(store.dataDir, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
  }
  return secret;
}

function readCookie(req, name) {
  const raw = req.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

function signedIn(req) {
  const id = req.get('X-MS-CLIENT-PRINCIPAL-ID');
  if (!id) return null;
  const name = req.get('X-MS-CLIENT-PRINCIPAL-NAME') || id;
  return { id, name: name.includes('@') ? name.split('@')[0] : name, email: name.includes('@') ? name : '', source: 'Microsoft sign-in' };
}

function testModeAllowed(req) {
  if (isLive()) return false;
  return !signedIn(req) || process.env.TEST_MODE === 'true';
}
// Real accounts (email and password) have ids like "u-1a2b3c4d5e6f".
const ACCOUNT_ID = /^u-[a-f0-9]{12}$/;

const sign = (body) => crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');

function makeSession(userId, kind) {
  const body = Buffer.from(JSON.stringify({ u: userId, k: kind, e: Date.now() + SESSION_DAYS * 86400000 })).toString('base64url');
  return `${body}.${sign(body)}`;
}

// A window can carry its own session (header, or ?t= for live streams and pictures), so two windows
// in the same browser can be two different people. Otherwise the browser-wide cookie is used.
function sessionToken(req) {
  return req.get('x-famhub-session') || (typeof req.query?.t === 'string' ? req.query.t : '') || readCookie(req, SESSION_COOKIE);
}

function readSession(req) {
  const raw = sessionToken(req);
  const [body, mac] = raw.split('.');
  if (!body || !mac) return null;
  const good = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString());
    return s.e > Date.now() ? s : null;
  } catch { return null; }
}

function cookieFlags(req, maxAgeSeconds) {
  return `Path=/; SameSite=Lax; HttpOnly${req.secure || req.get('x-forwarded-proto') === 'https' ? '; Secure' : ''}; Max-Age=${maxAgeSeconds}`;
}

function setSession(req, res, userId, kind) {
  const token = makeSession(userId, kind);
  res.append('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieFlags(req, SESSION_DAYS * 86400)}`);
  return token;
}

function clearSession(req, res) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieFlags(req, 0)}`);
  res.append('Set-Cookie', `${OLD_COOKIE}=; ${cookieFlags(req, 0)}`);
}

// Returns the person making the request, or null when nobody is signed in.
function currentUser(req) {
  const real = signedIn(req);
  const s = readSession(req);
  // Email-and-password accounts work in both modes.
  if (s && s.k === 'account' && ACCOUNT_ID.test(s.u)) return { id: s.u, name: '', email: '', source: 'account' };
  if (!testModeAllowed(req)) return real;
  if (!s) return null;
  if (s.k === 'microsoft') return real && real.id === s.u ? real : null;
  const demo = DEMO_USERS.find((u) => u.id === s.u);
  if (demo) return { id: demo.id, name: demo.name, email: '', source: 'test mode' };
  if (/^test-[a-z0-9]{6,12}$/.test(s.u)) return { id: s.u, name: 'Test profile', email: '', source: 'test mode' };
  return null;
}

// ---------- test account usernames and passwords ----------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}

function checkPassword(user, password) {
  if (typeof password !== 'string' || !password) return false;
  if (!user.passwordHash) {
    const a = Buffer.from(password); const b = Buffer.from(testPassword());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const [salt, hash] = user.passwordHash.split(':');
  const got = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

function usernameFrom(name, taken) {
  const base = (name || 'user').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
  let u = base; let i = 2;
  while (taken.has(u)) u = `${base}${i++}`;
  return u;
}

// Gives every demo and test person a username (older data did not have one).
function ensureUsernames(state) {
  const taken = new Set(state.users.map((u) => u.username).filter(Boolean));
  for (const u of state.users) {
    if (!(u.demo || u.test) || u.username) continue;
    const d = DEMO_USERS.find((x) => x.id === u.id);
    u.username = d && !taken.has(d.username) ? d.username : usernameFrom(u.name, taken);
    taken.add(u.username);
  }
}

// Simple protection against password guessing: 10 failed tries per address per 10 minutes.
const failures = new Map();
function tooManyFailures(ip) {
  const now = Date.now();
  const list = (failures.get(ip) || []).filter((t) => now - t < 600000);
  failures.set(ip, list);
  return list.length >= 10;
}
function noteFailure(ip) { failures.set(ip, [...(failures.get(ip) || []), Date.now()]); }

// Signed, short-lived token for a password reset link. It stops working once the password changes.
function resetToken(user) {
  const body = Buffer.from(JSON.stringify({ u: user.id, h: (user.passwordHash || '').slice(0, 12), e: Date.now() + 3600e3 })).toString('base64url');
  return `${body}.${sign(`reset.${body}`)}`;
}
function readResetToken(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const good = Buffer.from(sign(`reset.${body}`)); const given = Buffer.from(mac);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try { const t = JSON.parse(Buffer.from(body, 'base64url').toString()); return t.e > Date.now() ? t : null; } catch { return null; }
}

module.exports = {
  resetToken, readResetToken, ACCOUNT_ID, isLive,
  currentUser, testModeAllowed, signedIn, setSession, clearSession, checkPassword, hashPassword,
  usernameFrom, ensureUsernames, tooManyFailures, noteFailure, DEMO_USERS, DEFAULT_TEST_PASSWORD,
  usingDefaultPassword: () => !process.env.TEST_PASSWORD,
};
