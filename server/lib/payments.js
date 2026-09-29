// Payments between family members with PayNow or PayLah! (4.8).
// Famhub never holds money: it shows a PayNow QR code (which PayLah! and every Singapore banking app can scan),
// then keeps a record of who paid whom, what for, and whether the person paid has confirmed it.
//
// Kinds:
//   request   - anyone asks another member for money (reimbursement, pocket money, a share of something)
//   helper    - the family pays the helper or nanny (salary, top-up, reimbursement, bonus)
//   allowance - the family gives an allowance to the person cared for (parent, kid, teen) or to a member
// "person" as the payee means the person the circle is for (circle.parentName), who may not have an account.
const { randomUUID } = require('crypto');

const KINDS = ['request', 'helper', 'allowance'];
const SUBS = {
  request: ['reimburse', 'pocket', 'share', 'other'],
  helper: ['salary', 'topup', 'reimburse', 'bonus', 'other'],
  allowance: ['monthly', 'pocket', 'transport', 'school', 'other'],
};
const SUB_LABEL = {
  reimburse: 'Reimbursement', pocket: 'Pocket money', share: 'Share of a cost', other: 'Other',
  salary: 'Salary', topup: 'Top-up', bonus: 'Bonus', monthly: 'Monthly allowance', transport: 'Transport', school: 'School',
};
const KIND_LABEL = { request: 'Money request', helper: 'Helper pay', allowance: 'Allowance' };
const METHODS = ['paynow', 'paylah', 'bank', 'cash'];
const METHOD_LABEL = { paynow: 'PayNow', paylah: 'PayLah!', bank: 'Bank transfer', cash: 'Cash' };

const sgToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const refCode = () => `FH${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;

function ensure(state) {
  if (!Array.isArray(state.payments)) state.payments = [];
  if (!Array.isArray(state.payPlans)) state.payPlans = [];
}

function nameOf(state, circle, id) {
  if (id === 'person') return circle.parentName;
  const u = state.users.find((x) => x.id === id);
  return u ? u.name : 'Someone';
}
function payNowOf(state, circle, id) {
  if (id === 'person') return circle.personPaynow || '';
  const u = state.users.find((x) => x.id === id);
  return (u && u.paynow) || '';
}
const label = (p) => `${SUB_LABEL[p.sub] || KIND_LABEL[p.kind]}${p.reason ? `: ${p.reason}` : ''}`;

// Who may see a payment: owner and family see all; others see the ones they pay or receive.
function visible(p, userId, role) {
  if (role === 'owner' || role === 'family') return true;
  return p.fromId === userId || p.toId === userId || (p.toId === 'person' && role === 'parent');
}
const isPayee = (p, userId, role) => p.toId === userId || (p.toId === 'person' && ['parent', 'owner', 'family'].includes(role));
const isPayer = (p, userId, role) => p.fromId === userId || role === 'owner' || (role === 'family' && p.kind !== 'request');

// Next date a plan is due on or after `from` (YYYY-MM-DD).
function nextDue(plan, from) {
  const d = new Date(`${from}T12:00:00Z`);
  if (plan.every === 'week') {
    while (d.getUTCDay() !== plan.day) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  // Day 29, 30 or 31 falls on the last day of shorter months.
  const want = Math.min(31, Math.max(1, plan.day));
  const at = (y, m) => new Date(Date.UTC(y, m, Math.min(want, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()), 12));
  let c = at(d.getUTCFullYear(), d.getUTCMonth());
  if (c < d) c = at(d.getUTCFullYear(), d.getUTCMonth() + 1);
  return c.toISOString().slice(0, 10);
}
// The most recent due date on or before `day` (for sample data).
function lastDue(plan, day) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 32);
  let last = '';
  for (let n = nextDue(plan, d.toISOString().slice(0, 10)); n <= day; n = nextDue(plan, dayAfter(n))) last = n;
  return last;
}
const dayAfter = (day) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

function makePayment(state, circle, b, createdBy) {
  const p = {
    id: randomUUID(), circleId: circle.id, kind: b.kind, sub: b.sub, fromId: b.fromId, toId: b.toId, amount: b.amount,
    reason: b.reason || '', dueOn: b.dueOn || sgToday(), status: 'due', method: '', paidAt: '', paidBy: '', receivedAt: '',
    planId: b.planId || '', addToCosts: !!b.addToCosts, ref: refCode(), createdBy, createdAt: new Date().toISOString(), remindedAt: '',
  };
  state.payments.push(p);
  return p;
}

// Called every minute: turns repeating plans into payments on their due day (only the latest missed one,
// so a server that was off for a while does not create a pile of old payments).
function runPlans(state, notifyFn) {
  ensure(state);
  const today = sgToday();
  for (const plan of state.payPlans.filter((x) => x.active)) {
    const circle = state.circles.find((c) => c.id === plan.circleId);
    if (!circle) continue;
    let due = nextDue(plan, plan.lastOn ? dayAfter(plan.lastOn) : plan.startOn);
    if (due > today) continue;
    for (let n = nextDue(plan, dayAfter(due)); n <= today; n = nextDue(plan, dayAfter(n))) due = n;
    plan.lastOn = due;
    const p = makePayment(state, circle, { ...plan, dueOn: due, planId: plan.id }, plan.createdBy);
    if (notifyFn) notifyFn(circle, p);
  }
}

function view(state, circle, userId, role) {
  ensure(state);
  const mine = state.payments.filter((p) => p.circleId === circle.id && visible(p, userId, role));
  const out = (p) => ({
    ...p, fromName: nameOf(state, circle, p.fromId), toName: nameOf(state, circle, p.toId), label: label(p),
    toHasPayNow: !!payNowOf(state, circle, p.toId), canPay: p.status === 'due' && isPayer(p, userId, role),
    canConfirm: p.status === 'paid' && isPayee(p, userId, role), canDecline: p.status === 'due' && p.kind === 'request' && p.fromId === userId,
    canCancel: p.status === 'due' && (p.createdBy === userId || role === 'owner'), canRemind: p.status === 'due' && p.fromId !== userId && (isPayee(p, userId, role) || p.createdBy === userId),
  });
  const plans = (role === 'owner' || role === 'family')
    ? state.payPlans.filter((x) => x.circleId === circle.id).map((x) => ({ ...x, fromName: nameOf(state, circle, x.fromId), toName: nameOf(state, circle, x.toId), label: label(x), next: x.active ? nextDue(x, x.lastOn ? dayAfter(x.lastOn) : x.startOn) : '' }))
    : [];
  const members = state.members.filter((m) => m.circleId === circle.id).map((m) => {
    const u = state.users.find((x) => x.id === m.userId) || {};
    return { id: m.userId, name: u.name || '?', role: m.role, hasPayNow: !!u.paynow, placeholder: !!u.placeholder };
  });
  return {
    payments: mine.sort((a, b) => (a.status === 'due' ? 0 : 1) - (b.status === 'due' ? 0 : 1) || b.dueOn.localeCompare(a.dueOn) || b.createdAt.localeCompare(a.createdAt)).slice(0, 300).map(out),
    plans, members,
    person: { name: circle.parentName, hasPayNow: !!circle.personPaynow, paynow: role === 'owner' || role === 'family' || role === 'parent' ? circle.personPaynow || '' : '' },
    totals: {
      toPay: mine.filter((p) => p.status === 'due' && p.fromId === userId).reduce((a, p) => a + p.amount, 0),
      toReceive: mine.filter((p) => ['due', 'paid'].includes(p.status) && isPayee(p, userId, role) && p.toId === userId).reduce((a, p) => a + p.amount, 0),
    },
  };
}

module.exports = { KINDS, SUBS, SUB_LABEL, KIND_LABEL, METHODS, METHOD_LABEL, ensure, nameOf, payNowOf, label, visible, isPayee, isPayer, nextDue, lastDue, makePayment, runPlans, view, sgToday };
