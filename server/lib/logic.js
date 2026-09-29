// Roles, permissions and the calculations the app shows.

const ROLES = ['owner', 'family', 'helper', 'parent'];

// What each role may do. The server checks these on every change.
const CAN = {
  seeMoney: ['owner', 'family'],
  editMoney: ['owner', 'family'],
  editAppointments: ['owner', 'family'],
  addTasks: ['owner', 'family', 'helper'],
  editMedications: ['owner', 'family'],
  logDoses: ['owner', 'family', 'helper', 'parent'],
  seeAllDocuments: ['owner', 'family'],
  editDocuments: ['owner', 'family'],
  editRenewals: ['owner', 'family'],
  seeRenewals: ['owner', 'family'],
  invite: ['owner', 'family'],
  manageMembers: ['owner'],
  editCircle: ['owner'],
  checkIn: ['owner', 'family', 'helper', 'parent'],
  postNotes: ['owner', 'family', 'helper', 'parent'],
  seeVisits: ['owner', 'family', 'helper'],
  editVisits: ['owner', 'family', 'helper'],
  seePayNow: ['owner', 'family'],
};
const can = (role, action) => (CAN[action] || []).includes(role);

const todaySG = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const nowSGTime = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16);

function userName(state, userId) {
  const u = state.users.find((x) => x.id === userId);
  return u ? u.name : '';
}

// Each person's share of an expense, in cents, adding up exactly to the total.
function sharesOf(e) {
  const total = Math.round(e.amount * 100);
  const entries = Object.entries(e.shares || {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return { [e.paidByUserId]: total };
  if (e.splitMode === 'fixed') {
    return Object.fromEntries(entries.map(([u, v]) => [u, Math.round(Number(v) * 100)]));
  }
  const weights = e.splitMode === 'ratio' ? entries.map(([, v]) => Number(v)) : entries.map(() => 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = {};
  let given = 0;
  entries.forEach(([u], i) => {
    const cents = i === entries.length - 1 ? total - given : Math.floor((total * weights[i]) / sum);
    out[u] = cents;
    given += cents;
  });
  return out;
}

function netByPerson(expenses) {
  const net = {};
  for (const e of expenses) {
    const shares = sharesOf(e);
    net[e.paidByUserId] = (net[e.paidByUserId] || 0) + Math.round(e.amount * 100);
    for (const [u, cents] of Object.entries(shares)) net[u] = (net[u] || 0) - cents;
  }
  return net;
}

// Fewest payments to settle everyone up.
function balances(state, circleId) {
  const net = netByPerson(state.expenses.filter((x) => x.circleId === circleId));
  const debtors = [], creditors = [];
  for (const [userId, cents] of Object.entries(net)) {
    if (cents < 0) debtors.push({ userId, cents: -cents });
    if (cents > 0) creditors.push({ userId, cents });
  }
  debtors.sort((a, b) => b.cents - a.cents);
  creditors.sort((a, b) => b.cents - a.cents);
  const out = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].cents, creditors[j].cents);
    const to = state.users.find((u) => u.id === creditors[j].userId);
    out.push({
      fromUserId: debtors[i].userId, toUserId: creditors[j].userId, amount: pay / 100,
      fromName: userName(state, debtors[i].userId), toName: userName(state, creditors[j].userId), toHasPayNow: Boolean(to && to.paynow),
    });
    debtors[i].cents -= pay;
    creditors[j].cents -= pay;
    if (!debtors[i].cents) i++;
    if (!creditors[j].cents) j++;
  }
  return out;
}

// Monthly statement: what each person paid, their share, and the difference.
function statement(state, circleId, month) {
  const list = state.expenses.filter((x) => x.circleId === circleId && x.spentOn.startsWith(month) && !x.settlement);
  const people = {};
  for (const e of list) {
    const shares = sharesOf(e);
    const p = (people[e.paidByUserId] ||= { paid: 0, share: 0 });
    p.paid += Math.round(e.amount * 100);
    for (const [u, cents] of Object.entries(shares)) (people[u] ||= { paid: 0, share: 0 }).share += cents;
  }
  const byCategory = {};
  for (const e of list) byCategory[e.category || 'other'] = (byCategory[e.category || 'other'] || 0) + Math.round(e.amount * 100);
  return {
    month,
    total: list.reduce((s, e) => s + Math.round(e.amount * 100), 0) / 100,
    people: Object.entries(people).map(([userId, p]) => ({ userId, name: userName(state, userId), paid: p.paid / 100, share: p.share / 100, difference: (p.paid - p.share) / 100 })),
    byCategory: Object.entries(byCategory).map(([category, cents]) => ({ category, amount: cents / 100 })),
    expenses: list.sort((a, b) => a.spentOn.localeCompare(b.spentOn)),
  };
}

// Today's medicine doses with whether each was taken, due or missed.
function dosesToday(state, circleId) {
  const today = todaySG();
  const now = nowSGTime();
  const out = [];
  const R = require('./recur');
  for (const m of state.medications.filter((x) => x.circleId === circleId && x.active)) {
    // Medicines on a repeat pattern only appear on their days.
    if (m.repeat && !R.matches(today, m.startDate || today, m.repeat)) continue;
    for (const time of m.times) {
      const log = state.doseLogs.find((l) => l.medicationId === m.id && l.date === today && l.time === time);
      const [h, min] = time.split(':').map(Number);
      const lateBy = (Number(now.slice(0, 2)) * 60 + Number(now.slice(3))) - (h * 60 + min);
      out.push({
        medicationId: m.id, name: m.name, dose: m.dose, instructions: m.instructions, time,
        // A dose can only be ticked from its time ("later" = not yet).
        status: log ? 'taken' : lateBy >= 30 ? 'missed' : lateBy >= 0 ? 'due' : 'later',
        takenAt: log ? log.takenAt : '', recordedBy: log ? userName(state, log.recordedBy) : '',
      });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

// When a task can be ticked as done: from its date and time (00:00 if no time). '' = any time.
function taskOpensAt(t) {
  if (!t.dueDate) return '';
  return new Date(`${t.dueDate}T${t.dueTime || '00:00'}:00+08:00`).toISOString();
}
const taskLocked = (t) => !!taskOpensAt(t) && Date.now() < new Date(taskOpensAt(t)).getTime();
// A dose time (HH:MM) today that has not come yet.
const doseLocked = (time) => time > nowSGTime();

// Alerts for this person in this circle.
function alerts(state, circleId, userId, role) {
  const out = [];
  const now = Date.now();
  const today = todaySG();
  const circle = state.circles.find((c) => c.id === circleId);
  for (const a of state.appointments.filter((x) => x.circleId === circleId)) {
    const t = new Date(a.startsAt).getTime();
    if (t > now && t - now <= 24 * 3600e3) {
      out.push({ kind: 'appointment', level: t - now <= 3600e3 ? 'high' : 'info', text: `${a.title} ${t - now <= 3600e3 ? 'within the hour' : 'in the next 24 hours'}${a.escortUserId ? '' : ' (no escort yet)'}`, tab: 'calendar' });
    }
  }
  for (const t of state.tasks.filter((x) => x.circleId === circleId && x.status !== 'done')) {
    if (t.assigneeUserId === userId && t.status === 'open') out.push({ kind: 'task', level: 'info', text: `New task for you: ${t.title}`, tab: 'tasks' });
    if (t.dueDate && t.dueDate < today && (t.assigneeUserId === userId || (!t.assigneeUserId && role !== 'parent'))) out.push({ kind: 'task', level: 'high', text: `Overdue: ${t.title}`, tab: 'tasks' });
    if (!t.assigneeUserId && role !== 'parent' && role !== 'helper') out.push({ kind: 'task', level: 'info', text: `Nobody has taken: ${t.title}`, tab: 'tasks' });
  }
  for (const d of dosesToday(state, circleId).filter((x) => x.status === 'missed')) {
    out.push({ kind: 'medication', level: 'high', text: `Not ticked: ${d.name} at ${d.time}`, tab: 'meds' });
  }
  const todayChecks = state.checkins.filter((x) => x.circleId === circleId && new Date(new Date(x.createdAt).getTime() + 8 * 3600e3).toISOString().slice(0, 10) === today);
  if (role !== 'parent' && circle && !(circle.profile && ['baby', 'kid'].includes(circle.profile.careFor)) && !!circle.checkinBy && !todayChecks.some((x) => x.kind === 'ok') && nowSGTime() > (circle.checkinBy || '10:00')) {
    out.push({ kind: 'checkin', level: 'high', text: `${circle.parentName} has not checked in today (expected by ${circle.checkinBy})`, tab: 'home' });
  }
  for (const h of state.checkins.filter((x) => x.circleId === circleId && x.kind === 'help' && !x.resolvedAt)) {
    out.push({ kind: 'help', level: 'urgent', text: `${circle ? circle.parentName : 'Parent'} asked for help (${userName(state, h.recordedBy)} pressed the button)`, tab: 'home', checkinId: h.id });
  }
  if (can(role, 'seeRenewals')) {
    for (const r of state.renewals.filter((x) => x.circleId === circleId && !x.doneAt)) {
      const days = Math.round((new Date(`${r.dueDate}T12:00:00+08:00`) - now) / 86400e3);
      if (days <= 30) out.push({ kind: 'renewal', level: days < 0 ? 'high' : 'info', text: days < 0 ? `${r.title} was due ${-days} days ago` : `${r.title} due in ${days} days`, tab: 'renewals' });
    }
  }
  if (can(role, 'seeMoney')) {
    for (const b of balances(state, circleId).filter((x) => x.fromUserId === userId)) {
      out.push({ kind: 'money', level: 'info', text: `You owe ${b.toName} S$${b.amount.toFixed(2)}`, tab: 'costs' });
    }
  }
  const order = { urgent: 0, high: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

module.exports = { taskOpensAt, taskLocked, doseLocked, ROLES, CAN, can, balances, statement, dosesToday, alerts, sharesOf, userName, todaySG, nowSGTime };
