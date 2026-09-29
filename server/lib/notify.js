// Famhub notifications: who gets told what, when, and how.
//
// Design (from Medisafe Medfriend, Cozi, Lotsa Helping Hands and CaringBridge):
// - Every notification goes to specific people and lands in their own inbox with read state.
// - Each person chooses per category: push to this device, inbox only, daily summary, or off.
// - Emergencies always push, even in quiet hours, and repeat until someone responds.
// - Reminders fire on a schedule; missed doses and missed check-ins escalate to family
//   only when nobody has confirmed them (instead of pinging everyone every time).
// - Quiet hours hold ordinary pushes until the morning.

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const webpush = require('web-push');
const L = require('./logic');
const Email = require('./email');
const WhatsApp = require('./whatsapp');

const CATEGORIES = {
  emergency: { label: 'Emergencies', help: '"I need help", urgent notes, no check-in after an hour. Always pushed.', locked: true },
  checkin: { label: 'Daily check-in', help: 'When the parent has not checked in by the expected time' },
  medicine: { label: 'Medicines', help: 'Doses due, doses not ticked, running low' },
  baby: { label: 'Baby', help: 'Feed due reminders from the baby log' },
  appointments: { label: 'Appointments', help: 'Reminders the evening before and an hour before, escort needed, changes' },
  tasks: { label: 'Requests and tasks', help: 'Assigned to you, taken, done, overdue' },
  updates: { label: 'Updates', help: 'New care notes, comments and thanks' },
  money: { label: 'Money', help: 'Expenses you share, payments to you' },
  renewals: { label: 'Renewals', help: '30, 7 and 1 day before something is due' },
};
const MODES = ['push', 'inbox', 'digest', 'off'];
// Categories emailed by default once a person turns email alerts on. Emergencies are always emailed.
const EMAIL_DEFAULT = ['emergency', 'checkin', 'medicine', 'appointments', 'tasks'];

const DEFAULTS = {
  owner: { baby: 'push', checkin: 'push', medicine: 'push', appointments: 'push', tasks: 'push', updates: 'digest', money: 'inbox', renewals: 'inbox' },
  family: { baby: 'push', checkin: 'push', medicine: 'push', appointments: 'push', tasks: 'push', updates: 'digest', money: 'inbox', renewals: 'inbox' },
  helper: { baby: 'push', checkin: 'push', medicine: 'push', appointments: 'push', tasks: 'push', updates: 'inbox', money: 'off', renewals: 'off' },
  parent: { baby: 'push', checkin: 'off', medicine: 'push', appointments: 'push', tasks: 'off', updates: 'inbox', money: 'off', renewals: 'off' },
};

function prefsFor(state, userId, role) {
  const saved = state.prefs[userId] || {};
  return {
    categories: { ...(DEFAULTS[role] || DEFAULTS.family), ...(saved.categories || {}), emergency: 'push' },
    quietStart: saved.quietStart || '22:00',
    quietEnd: saved.quietEnd || '07:00',
    digestTime: saved.digestTime || '20:00',
    email: {
      address: (saved.email && saved.email.address) || '',
      on: !!(saved.email && saved.email.on),
      categories: (saved.email && Array.isArray(saved.email.categories)) ? saved.email.categories : EMAIL_DEFAULT,
    },
    whatsapp: {
      number: (saved.whatsapp && saved.whatsapp.number) || '',
      on: !!(saved.whatsapp && saved.whatsapp.on),
      categories: (saved.whatsapp && Array.isArray(saved.whatsapp.categories)) ? saved.whatsapp.categories : EMAIL_DEFAULT,
    },
  };
}

// ---------- time helpers (Singapore) ----------
const sgNow = () => new Date(Date.now() + 8 * 3600e3);
const sgDate = (d = sgNow()) => d.toISOString().slice(0, 10);
const sgHM = (d = sgNow()) => d.toISOString().slice(11, 16);
const minutesOf = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
function inQuiet(p, hm = sgHM()) {
  const n = minutesOf(hm), a = minutesOf(p.quietStart), b = minutesOf(p.quietEnd);
  return a <= b ? n >= a && n < b : n >= a || n < b;
}
// The next time (ISO) the quiet hours end.
function quietEndsAt(p) {
  const now = sgNow();
  const [h, m] = p.quietEnd.split(':').map(Number);
  let end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
  if (end <= now) end = new Date(end.getTime() + 86400e3);
  return new Date(end.getTime() - 8 * 3600e3).toISOString();
}

// ---------- push delivery ----------
let vapid = null;
const outbox = [];

function initPush(dataDir) {
  const file = path.join(dataDir, 'vapid.json');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else if (fs.existsSync(file)) {
    vapid = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    vapid = webpush.generateVAPIDKeys();
    fs.writeFileSync(file, JSON.stringify(vapid));
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@famhub.example.com', vapid.publicKey, vapid.privateKey);
  return vapid.publicKey;
}

// Emails are queued the same way and sent after the data is saved.
const emailQueue = [];
const appUrl = () => process.env.APP_URL || (process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : '');
function queueEmail(p, n) {
  const e = p.email;
  if (!e.on || !e.address) return;
  if (n.category !== 'emergency' && !e.categories.includes(n.category)) return;
  emailQueue.push({ to: e.address, n: { id: n.id, title: n.title, body: n.body, priority: n.priority } });
  n.emailedAt = new Date().toISOString();
}
const waQueue = [];
function queueWhatsApp(p, n) {
  const w = p.whatsapp;
  if (!w.on || !w.number) return;
  if (n.category !== 'emergency' && !w.categories.includes(n.category)) return;
  waQueue.push({ to: w.number, n: { id: n.id, title: n.title, body: n.body, priority: n.priority } });
  n.whatsappAt = new Date().toISOString();
}

// Queues a push; sent after the data is saved (see flush).
function queuePush(state, n) {
  for (const sub of state.pushSubs.filter((s) => s.userId === n.userId)) {
    outbox.push({ sub, notificationId: n.id, payload: JSON.stringify({ title: n.title, body: n.body, tag: n.key || n.id, urgent: n.priority === 'urgent', url: `/?open=${n.id}` }) });
  }
  n.pushedAt = new Date().toISOString();
}

// Sends queued pushes; returns subscriptions that are gone so they can be removed.
async function flush() {
  const mails = emailQueue.splice(0);
  for (const m of mails) Email.send(m.to, m.n, appUrl()).catch(() => {});
  for (const m of waQueue.splice(0)) WhatsApp.send(m.to, m.n).catch(() => {});
  const jobs = outbox.splice(0);
  const gone = [];
  await Promise.all(jobs.map(async (j) => {
    try {
      await webpush.sendNotification(j.sub.subscription, j.payload, { TTL: 3600, urgency: JSON.parse(j.payload).urgent ? 'high' : 'normal' });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) gone.push(j.sub.subscription.endpoint);
      else console.error('push failed', err.statusCode || err.message);
    }
  }));
  return gone;
}

// ---------- creating notifications ----------
function roleOf(state, circleId, userId) {
  const m = state.members.find((x) => x.circleId === circleId && x.userId === userId);
  return m ? m.role : null;
}
const people = (state, circleId, roles) =>
  state.members.filter((m) => m.circleId === circleId && roles.includes(m.role)).map((m) => m.userId)
    .filter((id) => !(state.users.find((u) => u.id === id) || {}).placeholder);

/**
 * spec: { circleId, to: [userIds], except?, category, priority: 'urgent'|'important'|'normal',
 *         title, body, tab, itemId, actions: [{ id, label }], key? (sent once per person) }
 */
function notify(state, spec) {
  const made = [];
  const to = [...new Set(spec.to)].filter((u) => u && u !== spec.except);
  for (const userId of to) {
    const role = roleOf(state, spec.circleId, userId);
    if (!role) continue;
    if (spec.key) {
      const k = `${spec.key}|${userId}`;
      if (state.sentKeys[k]) continue;
      state.sentKeys[k] = new Date().toISOString();
    }
    const p = prefsFor(state, userId, role);
    const urgent = spec.priority === 'urgent' || spec.category === 'emergency';
    const mode = urgent ? 'push' : p.categories[spec.category] || 'inbox';
    if (mode === 'off') continue;
    const n = {
      id: randomUUID(), userId, circleId: spec.circleId, category: spec.category, priority: spec.priority || 'normal',
      title: spec.title, body: spec.body || '', tab: spec.tab || 'home', itemId: spec.itemId || '', actions: spec.actions || [],
      key: spec.key || '', ...(spec.babyId ? { babyId: spec.babyId } : {}), createdAt: new Date().toISOString(), readAt: '', digest: mode === 'digest', pushAt: '', pushedAt: '',
    };
    if (mode === 'push') {
      if (!urgent && inQuiet(p)) n.pushAt = quietEndsAt(p);
      else queuePush(state, n);
    }
    queueEmail(p, n);
    queueWhatsApp(p, n);
    state.notifications.push(n);
    made.push(n);
  }
  if (state.notifications.length > 5000) state.notifications = state.notifications.slice(-5000);
  return made;
}

// ---------- scheduled rules (run every minute) ----------
function runSchedule(state) {
  const now = Date.now();
  const today = sgDate();
  const hm = sgHM();
  const nowMin = minutesOf(hm);

  for (const circle of state.circles) {
    const c = circle.id;
    const family = people(state, c, ['owner', 'family']);
    const helpers = people(state, c, ['helper']);
    const parents = people(state, c, ['parent']);
    const base = { circleId: c };

    // Medicines: remind at the dose time; escalate to family if not ticked 30 minutes later.
    for (const d of L.dosesToday(state, c)) {
      if (d.status === 'taken') continue;
      const late = nowMin - minutesOf(d.time);
      const doseKey = `${d.medicationId}:${today}:${d.time}`;
      if (late >= 0 && late < 30) {
        notify(state, { ...base, to: [...helpers, ...parents], category: 'medicine', priority: 'important', key: `dose-due:${doseKey}`,
          title: `${d.time} ${d.name}`, body: `${d.dose}${d.instructions ? `, ${d.instructions}` : ''}. Tap Taken once ${circle.parentName} has had it.`,
          tab: 'care', itemId: `${d.medicationId}|${d.time}`, actions: [{ id: 'dose-taken', label: 'Taken' }] });
      }
      if (late >= 30 && late < 240) {
        notify(state, { ...base, to: [...family, ...helpers], category: 'medicine', priority: 'important', key: `dose-missed:${doseKey}`,
          title: `Not ticked: ${d.name} (${d.time})`, body: `Nobody has confirmed ${circle.parentName}'s ${d.time} dose. Please check.`,
          tab: 'care', itemId: `${d.medicationId}|${d.time}`, actions: [{ id: 'dose-taken', label: 'Mark taken' }] });
      }
    }
    // Running low on supply.
    for (const m of state.medications.filter((x) => x.circleId === c && x.active && x.supply !== null && x.supply !== undefined)) {
      if (m.supply <= m.refillAt) {
        notify(state, { ...base, to: family, category: 'medicine', priority: 'normal', key: `refill:${m.id}:${m.refilledAt || m.createdAt}`,
          title: `Running low: ${m.name}`, body: `About ${m.supply} left. Time to arrange a refill.`, tab: 'care', itemId: m.id });
      }
    }

    // Daily check-in: family and helper after the expected time; urgent if still nothing an hour later.
    // Baby: remind when a feed is due (the time since the last feed passes the chosen gap).
    const isBaby = circle.profile && circle.profile.careFor === 'baby';
    if (isBaby && circle.baby && circle.baby.feedEvery > 0) {
      // Each baby (twins and triplets too) gets its own reminder.
      const babies = Array.isArray(circle.babies) && circle.babies.length ? circle.babies : [{ id: null, name: circle.parentName }];
      const firstId = babies[0].id;
      for (const baby of babies) {
        const feeds = (state.babyLogs || []).filter((x) => x.circleId === c && (x.kind === 'bottle' || x.kind === 'breast') && (baby.id === null || (x.babyId || firstId) === baby.id)).sort((a, b) => b.at.localeCompare(a.at));
        if (!feeds[0]) continue;
        const since = (now - new Date(feeds[0].at).getTime()) / 3600e3;
        if (since >= circle.baby.feedEvery && since < circle.baby.feedEvery + 3) {
          notify(state, { ...base, to: [...family, ...helpers, ...parents], category: 'baby', priority: 'important', key: `feed-due:${feeds[0].id}`, babyId: baby.id || undefined,
            title: `Feed due for ${baby.name}`, body: `Last feed was ${Math.floor(since)} h ${Math.round((since % 1) * 60)} min ago.`, tab: 'care' });
        }
      }
    }

    // Baby routine (4.9): remind the person responsible at the time; tell the family if not ticked 45 minutes later.
    if (isBaby && Array.isArray(circle.routine)) {
      for (const r of circle.routine) {
        const late = nowMin - minutesOf(r.time);
        if (late < 0 || late >= 180) continue;
        const ticked = (state.routineDone || []).some((x) => x.circleId === c && x.itemId === r.id && x.day === today);
        if (ticked) continue;
        const who = r.who ? [r.who] : [...helpers, ...family];
        const what = `${r.title}${r.kind === 'milk' && r.ml ? ` ${r.ml} ml` : ''}${r.detail ? `: ${r.detail}` : ''}`;
        if (late < 15) notify(state, { ...base, to: who, category: 'baby', priority: 'important', key: `routine-due:${r.id}:${today}`,
          title: `${r.time} ${what}`, body: `Tick it in Routine when done.`, tab: 'care' });
        if (late >= 45 && late < 60) notify(state, { ...base, to: family, category: 'baby', priority: 'normal', key: `routine-late:${r.id}:${today}`,
          title: `Not ticked yet: ${r.time} ${r.title}`, body: `Nobody has ticked ${r.title} for ${circle.parentName}.`, tab: 'care' });
      }
    }

    const checks = state.checkins.filter((x) => x.circleId === c && x.kind === 'ok' && sgDate(new Date(new Date(x.createdAt).getTime() + 8 * 3600e3)) === today);
    const noCheckin = isBaby || (circle.profile && circle.profile.careFor === 'kid') || !circle.checkinBy;
    if (!checks.length && !noCheckin) {
      const late = nowMin - minutesOf(circle.checkinBy || '10:00');
      if (late >= 0 && late < 60) {
        notify(state, { ...base, to: [...family, ...helpers], category: 'checkin', priority: 'important', key: `checkin-late:${today}`,
          title: `${circle.parentName} has not checked in yet`, body: `Expected by ${circle.checkinBy}. A quick call may help.`, tab: 'home', actions: [{ id: 'checkin-ok', label: `${circle.parentName} is OK` }] });
      }
      if (late >= 60 && late < 600) {
        notify(state, { ...base, to: family, category: 'emergency', priority: 'urgent', key: `checkin-escalate:${today}`,
          title: `Still no check-in from ${circle.parentName}`, body: `Over an hour past ${circle.checkinBy}. Please call ${circle.parentName} or someone nearby.`, tab: 'home', actions: [{ id: 'checkin-ok', label: `${circle.parentName} is OK` }] });
      }
    }

    // Help requests: repeat every 5 minutes (up to 6 times) until someone responds.
    for (const h of state.checkins.filter((x) => x.circleId === c && x.kind === 'help' && !x.resolvedAt)) {
      const round = Math.floor((now - new Date(h.createdAt).getTime()) / 300000);
      if (round >= 1 && round <= 6) {
        notify(state, { ...base, to: [...family, ...helpers], category: 'emergency', priority: 'urgent', key: `help:${h.id}:${round}`,
          title: `${circle.parentName} still needs help`, body: 'Nobody has said they are handling it yet.', tab: 'home', itemId: h.id, actions: [{ id: 'help-handle', label: "I'm handling it" }, { id: 'help-cancel', label: 'False alarm' }] });
      }
    }

    // Appointments: the evening before (from 8 pm), escort needed within 48 hours, one hour before.
    for (const a of state.appointments.filter((x) => x.circleId === c)) {
      const t = new Date(a.startsAt).getTime();
      // At the appointment time.
      if (t <= now && now - t < 30 * 60e3) {
        notify(state, { ...base, to: a.escortUserId ? [a.escortUserId, ...parents] : [...parents, ...family], category: 'appointments', priority: 'important', key: `appt-now:${a.id}:${a.startsAt}`,
          title: `Now: ${a.title}`, body: `${a.location || ''}`.trim() || 'The appointment time has come.', tab: 'calendar', itemId: a.id });
      }
      if (t <= now) continue;
      const hours = (t - now) / 3600e3;
      const apptDaySG = sgDate(new Date(t + 8 * 3600e3));
      const tomorrow = sgDate(new Date(sgNow().getTime() + 86400e3));
      const who = a.escortUserId ? [a.escortUserId, ...parents] : [...parents];
      const when = new Date(t + 8 * 3600e3).toISOString().slice(11, 16);
      if (apptDaySG === tomorrow && nowMin >= 20 * 60) {
        notify(state, { ...base, to: who, category: 'appointments', priority: 'normal', key: `appt-eve:${a.id}:${a.startsAt}`,
          title: `Tomorrow ${when}: ${a.title}`, body: `${a.location}${a.notes ? `. ${a.notes}` : ''}`, tab: 'calendar', itemId: a.id });
      }
      if (!a.escortUserId && hours <= 48) {
        notify(state, { ...base, to: [...family, ...helpers], category: 'appointments', priority: 'important', key: `appt-escort:${a.id}:${a.startsAt}`,
          title: `Escort needed: ${a.title}`, body: `${apptDaySG} at ${when}, ${a.location}. Can you go?`, tab: 'calendar', itemId: a.id, actions: [{ id: 'appt-go', label: "I'll go" }] });
      }
      if (hours <= 1) {
        notify(state, { ...base, to: who, category: 'appointments', priority: 'important', key: `appt-1h:${a.id}:${a.startsAt}`,
          title: `In 1 hour: ${a.title}`, body: `${when} at ${a.location}`, tab: 'calendar', itemId: a.id });
      }
    }

    // Tasks: an alert when the time comes (at the set time, or 9 am on the day if no time is set).
    for (const t of state.tasks.filter((x) => x.circleId === c && x.status !== 'done' && x.dueDate)) {
      const opens = new Date(L.taskOpensAt(t)).getTime();
      const due = t.dueTime ? now >= opens && now - opens < 3 * 3600e3 : t.dueDate === today && hm >= '09:00';
      if (!due) continue;
      notify(state, { ...base, to: t.assigneeUserId ? [t.assigneeUserId] : [...family, ...helpers], category: 'tasks', priority: 'important', key: `task-due:${t.id}:${t.dueDate}:${t.dueTime || ''}`,
        title: t.dueTime ? `Time to do: ${t.title}` : `Due today: ${t.title}`, body: `${t.dueTime ? `It is ${t.dueTime}. ` : ''}${t.assigneeUserId ? 'Tick Done once it is finished.' : 'Nobody has taken this yet. Can you do it?'}`,
        tab: 'requests', itemId: t.id, actions: t.assigneeUserId ? [{ id: 'task-done', label: 'Done' }] : [{ id: 'task-take', label: "I'll do it" }] });
    }

    // Overdue tasks: a nudge at 9 am to the person who took it (or family if nobody has).
    // (Not in the last stage of life: no "overdue" nagging then.)
    if (hm >= '09:00' && !(circle.profile && circle.profile.stage === 'endOfLife')) {
      for (const t of state.tasks.filter((x) => x.circleId === c && x.status !== 'done' && x.dueDate && x.dueDate < today)) {
        notify(state, { ...base, to: t.assigneeUserId ? [t.assigneeUserId] : family, category: 'tasks', priority: 'normal', key: `task-overdue:${t.id}:${today}`,
          title: `Overdue: ${t.title}`, body: t.assigneeUserId ? 'Still open. Mark it done, or hand it back if you cannot do it.' : 'Nobody has taken this yet.',
          tab: 'requests', itemId: t.id, actions: t.assigneeUserId ? [{ id: 'task-done', label: 'Done' }] : [{ id: 'task-take', label: "I'll do it" }] });
      }
    }

    // Renewals: 30, 7 and 1 day before.
    for (const r of state.renewals.filter((x) => x.circleId === c && !x.doneAt)) {
      const days = Math.round((new Date(`${r.dueDate}T12:00:00+08:00`).getTime() - now) / 86400e3);
      for (const mark of [30, 7, 1]) {
        if (days <= mark && days > (mark === 30 ? 7 : mark === 7 ? 1 : -1)) {
          notify(state, { ...base, to: family, category: 'renewals', priority: mark === 1 ? 'important' : 'normal', key: `renew:${r.id}:${r.dueDate}:${mark}`,
            title: `${r.title} due ${days <= 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`, body: r.notes || 'Tap to see details.', tab: 'renewals', itemId: r.id });
        }
      }
    }
  }

  // Daily summaries for categories set to "daily summary".
  for (const userId of Object.keys(state.users.reduce((acc, u) => ({ ...acc, [u.id]: 1 }), {}))) {
    const memberships = state.members.filter((m) => m.userId === userId);
    if (!memberships.length) continue;
    const p = prefsFor(state, userId, memberships[0].role);
    if (hm < p.digestTime) continue;
    const pending = state.notifications.filter((n) => n.userId === userId && n.digest && !n.digestedAt);
    if (!pending.length) continue;
    const key = `digest:${userId}:${today}`;
    if (state.sentKeys[key]) continue;
    state.sentKeys[key] = new Date().toISOString();
    pending.forEach((n) => { n.digestedAt = new Date().toISOString(); });
    const byCat = pending.reduce((acc, n) => ({ ...acc, [n.category]: (acc[n.category] || 0) + 1 }), {});
    const n = {
      id: randomUUID(), userId, circleId: memberships[0].circleId, category: 'digest', priority: 'normal',
      title: `Today's summary: ${pending.length} update${pending.length === 1 ? '' : 's'}`,
      body: Object.entries(byCat).map(([k, v]) => `${v} ${(CATEGORIES[k] || { label: k }).label.toLowerCase()}`).join(', '),
      tab: 'inbox', itemId: '', actions: [], key, createdAt: new Date().toISOString(), readAt: '', digest: false, pushAt: '', pushedAt: '',
    };
    state.notifications.push(n);
    queuePush(state, n);
  }

  // Pushes held during quiet hours.
  for (const n of state.notifications.filter((x) => x.pushAt && !x.pushedAt && x.pushAt <= new Date().toISOString())) {
    if (!n.readAt) queuePush(state, n);
    else n.pushedAt = n.pushAt;
  }

  // Keep the dedupe list small.
  const cutoff = new Date(now - 14 * 86400e3).toISOString();
  for (const [k, v] of Object.entries(state.sentKeys)) if (v < cutoff) delete state.sentKeys[k];
}

module.exports = { EMAIL_DEFAULT, CATEGORIES, MODES, DEFAULTS, prefsFor, notify, runSchedule, initPush, flush, people, roleOf, queuePush };
