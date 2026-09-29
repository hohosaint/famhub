// Demo data for testing. Made-up names only.
const { randomUUID } = require('crypto');

const STATE_VERSION = 3;

// Demo people you can "test as" (see lib/auth.js).
const DEMO_USERS = [
  { id: 'demo-thomas', username: 'thomas', name: 'Thomas', paynow: '+6591110001', role: 'owner', label: 'Thomas (owner, son)' },
  { id: 'demo-meiling', username: 'meiling', name: 'Mei Ling', paynow: '+6591110002', role: 'family', label: 'Mei Ling (family, daughter)' },
  { id: 'demo-weijie', username: 'weijie', name: 'Wei Jie', paynow: '+6591110003', role: 'family', label: 'Wei Jie (family, son)' },
  { id: 'demo-siti', username: 'siti', name: 'Siti', paynow: '', role: 'helper', label: 'Siti (helper)' },
  { id: 'demo-mum', username: 'mum', name: 'Mum', paynow: '', role: 'parent', label: 'Mum (parent)' },
];

function sgNow() { return new Date(Date.now() + 8 * 3600 * 1000); }
function sgIso(daysFromNow, hour, minute = 0) {
  const sg = sgNow();
  return new Date(Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), sg.getUTCDate() + daysFromNow, hour - 8, minute)).toISOString();
}
function sgDay(daysFromNow) { return sgIso(daysFromNow, 12).slice(0, 10); }

function emptyState() {
  return {
    version: STATE_VERSION,
    users: [], circles: [], members: [], invites: [],
    appointments: [], tasks: [], notes: [], expenses: [], documents: [], files: [],
    medications: [], doseLogs: [], renewals: [], checkins: [], activity: [], reads: {}, visits: [], babyLogs: [],
    notifications: [], prefs: {}, pushSubs: [], sentKeys: {},
  };
}

// Adds a complete demo circle. ownerId lets a real signed-in person own it.
function addDemoCircle(state, ownerId, ownerName) {
  const c = randomUUID();
  const now = new Date().toISOString();
  const ids = {
    owner: ownerId || 'demo-thomas', meiling: 'demo-meiling', weijie: 'demo-weijie', siti: 'demo-siti', mum: 'demo-mum',
  };
  for (const u of DEMO_USERS) {
    if (!state.users.find((x) => x.id === u.id)) state.users.push({ id: u.id, username: u.username, name: u.name, paynow: u.paynow, demo: true });
  }
  if (ownerId && !state.users.find((x) => x.id === ownerId)) state.users.push({ id: ownerId, name: ownerName || 'You', paynow: '' });

  state.circles.push({
    id: c, name: "Mum's care circle", parentName: 'Mum', parentPhone: '+6561234567', checkinBy: '10:00',
    emergencyContacts: [{ name: 'Mei Ling', phone: '+6591110002', relation: 'Daughter' }, { name: 'Neighbour Auntie Lim', phone: '+6567654321', relation: 'Neighbour' }],
    createdAt: now, demo: true, profile: { careFor: 'elder', stage: 'dailyCare', living: 'helper', needs: ['heart', 'falls', 'manyMeds'], relation: 'Mum' },
  });
  const member = (userId, role) => state.members.push({ circleId: c, userId, role, joinedAt: now });
  member(ids.owner, 'owner');
  if (ownerId) member('demo-thomas', 'family');
  member(ids.meiling, 'family');
  member(ids.weijie, 'family');
  member(ids.siti, 'helper');
  member(ids.mum, 'parent');

  const A = (d, h, m, title, location, escort, notes = '') => ({ id: randomUUID(), circleId: c, title, startsAt: sgIso(d, h, m), location, notes, escortUserId: escort, outcome: '', createdBy: ids.meiling, updatedAt: now });
  state.appointments.push(
    A(0, 16, 30, 'Physiotherapy', 'Community hospital, level 2', ids.siti, 'Wear comfortable shoes'),
    A(3, 9, 30, 'Polyclinic review', 'Neighbourhood polyclinic', ids.meiling, 'Bring blood pressure log'),
    A(10, 14, 0, 'Eye check', 'Eye centre', '', ''),
    { ...A(-7, 10, 0, 'Dental check', 'Dental clinic', ids.weijie), outcome: 'Cleaning done. Next check in 6 months.' },
  );

  const T = (title, category, due, assignee, status, by = ids.meiling, dueTime = '') => ({ id: randomUUID(), circleId: c, title, category, dueDate: due, dueTime, assigneeUserId: assignee, status, createdBy: by, createdAt: now, doneBy: status === 'done' ? assignee : '', doneAt: status === 'done' ? now : '' });
  state.tasks.push(
    T('Collect medicine refill', 'refill', sgDay(-1), ids.weijie, 'open'),
    T('Pay town council bill', 'bill', sgDay(4), ids.meiling, 'accepted'),
    T('Buy adult diapers', 'errand', sgDay(1), ids.siti, 'open', ids.owner),
    T('Book taxi for polyclinic', 'errand', sgDay(2), '', 'open', ids.owner),
    T('Renew bus concession card', 'errand', sgDay(-3), ids.owner, 'done'),
    T('Change bed sheets', 'care', sgDay(0), ids.siti, 'accepted', ids.meiling, '16:00'),
  );

  state.notes.push(
    { id: randomUUID(), circleId: c, authorUserId: ids.siti, text: 'Mum ate well at lunch and walked 15 minutes in the corridor.', fileId: '', urgent: false, createdAt: sgIso(0, 13, 10), reactions: { [ids.meiling]: 'thanks' }, comments: [{ id: randomUUID(), userId: ids.meiling, text: 'Thank you Siti!', createdAt: sgIso(0, 13, 40) }] },
    { id: randomUUID(), circleId: c, authorUserId: ids.meiling, text: 'Doctor said to keep the same dose until the review.', fileId: '', urgent: false, createdAt: sgIso(-2, 19, 45), reactions: {}, comments: [] },
  );

  const E = (item, category, amount, paidBy, day, splitMode, shares) => ({ id: randomUUID(), circleId: c, item, category, amount, paidByUserId: paidBy, spentOn: sgDay(day), splitMode, shares, receiptFileId: '', settlement: false, createdBy: paidBy, createdAt: now });
  const fam = [ids.owner, ids.meiling, ids.weijie];
  const equal = Object.fromEntries(fam.map((u) => [u, 1]));
  state.expenses.push(
    E('Taxi to clinic', 'transport', 18.5, ids.meiling, -6, 'equal', equal),
    E('Adult diapers', 'supplies', 42.9, ids.weijie, -3, 'equal', equal),
    E("Helper's salary (September)", 'helper', 750, ids.owner, -2, 'ratio', { [ids.owner]: 2, [ids.meiling]: 1, [ids.weijie]: 1 }),
    E('Groceries', 'food', 65.2, ids.meiling, -1, 'fixed', { [ids.owner]: 20, [ids.meiling]: 25.2, [ids.weijie]: 20 }),
  );

  const M = (name, dose, times, instructions, supply, perDose, refillAt) => ({ id: randomUUID(), circleId: c, name, dose, times, instructions, active: true, supply, perDose, refillAt, createdBy: ids.meiling, createdAt: now });
  const m1 = M('Blood pressure tablet', '1 tablet', ['08:00'], 'After breakfast', 24, 1, 7);
  const m2 = M('Cholesterol tablet', '1 tablet', ['20:00'], 'After dinner', 5, 1, 7);
  const m3 = M('Eye drops', '1 drop each eye', ['09:00', '21:00'], '', null, 0, 0);
  state.medications.push(m1, m2, m3);
  state.doseLogs.push({ id: randomUUID(), circleId: c, medicationId: m1.id, date: sgDay(0), time: '08:00', takenAt: sgIso(0, 8, 10), recordedBy: ids.siti });

  state.renewals.push(
    { id: randomUUID(), circleId: c, title: "Helper's work permit", dueDate: sgDay(25), notes: 'Renew online with MOM', createdBy: ids.owner, doneAt: '' },
    { id: randomUUID(), circleId: c, title: 'CHAS card', dueDate: sgDay(80), notes: '', createdBy: ids.meiling, doneAt: '' },
    { id: randomUUID(), circleId: c, title: 'Integrated Shield plan premium', dueDate: sgDay(12), notes: 'Paid from Medisave plus cash top-up', createdBy: ids.owner, doneAt: '' },
  );

  state.visits = state.visits || [];
  state.visits.push({
    id: randomUUID(), circleId: c, type: 'doctor', provider: 'Dr Tan, Bukit Merah Polyclinic', date: sgDay(-6), time: '10:30', appointmentId: '',
    summary: 'Blood pressure a little high (148/90). Heart and lungs fine. Keep walking 15 minutes a day.',
    instructions: 'Check blood pressure every morning for 2 weeks and write it down. Less salt.',
    medChanges: 'Amlodipine increased from 5 mg to 10 mg, once in the morning.',
    followUpDate: sgDay(24), fileIds: [], createdBy: ids.meiling, createdAt: sgIso(-6, 13, 0), updatedAt: sgIso(-6, 13, 0),
    comments: [{ id: randomUUID(), userId: ids.owner, text: 'Thanks Mei Ling. I will buy a blood pressure monitor this weekend.', createdAt: sgIso(-6, 19, 0) }],
  });
  state.activity.push({ id: randomUUID(), circleId: c, userId: ids.siti, text: 'Siti posted a care note', createdAt: sgIso(0, 13, 10) });
  return c;
}

// Brings saved data from an older prototype version up to date, keeping it.
function migrate(state) {
  if (!Array.isArray(state.visits)) state.visits = [];   // visit notes (added in 3.10)
  if (!Array.isArray(state.babyLogs)) state.babyLogs = []; // baby log (added in 4.0)
  if (state.version === 2) {
    Object.assign(state, { notifications: [], prefs: {}, pushSubs: [], sentKeys: {} }, {
      notifications: state.notifications || [], prefs: state.prefs || {}, pushSubs: state.pushSubs || [], sentKeys: state.sentKeys || {},
    });
    for (const n of state.notes) { n.reactions = n.reactions || {}; n.comments = n.comments || []; }
    for (const m of state.medications) { if (m.supply === undefined) { m.supply = null; m.perDose = 0; m.refillAt = 0; } }
    state.version = 3;
  }
  return state;
}

// A second demo circle for newborn twins, with a few days of feeds, sleep, diapers and weights for each.
function addDemoBabyCircle(state) {
  const c = randomUUID();
  const now = new Date().toISOString();
  const ethan = randomUUID(); const emma = randomUUID();
  state.circles.push({
    id: c, name: "Ethan and Emma's circle", parentName: 'Ethan and Emma', parentPhone: '', checkinBy: '', emergencyContacts: [{ name: 'Mei Ling', phone: '+6591110002', relation: 'Mother' }],
    createdAt: now, demo: true, profile: { careFor: 'baby', stage: 'newborn', living: 'grandparents', needs: ['formula', 'premature'], relation: 'Twins', count: 2 },
    baby: { feedEvery: 3 },
    babies: [
      { id: ethan, name: 'Ethan', sex: 'boy', birthDate: sgDay(-40), formulaId: 'similac-5mo-1', per100ml: null, customName: '', color: '#2563EB' },
      { id: emma, name: 'Emma', sex: 'girl', birthDate: sgDay(-40), formulaId: 'similac-5mo-1', per100ml: null, customName: '', color: '#DB2777' },
    ],
  });
  const m = (userId, role) => state.members.push({ circleId: c, userId, role, joinedAt: now });
  m('demo-meiling', 'owner'); m('demo-thomas', 'family'); m('demo-weijie', 'family'); m('demo-siti', 'helper');
  const log = (babyId, daysAgo, h, min, kind, extra, by = 'demo-meiling') => state.babyLogs.push({ id: randomUUID(), circleId: c, babyId, kind, at: sgIso(-daysAgo, h, min), by, note: '', ...extra });
  const hourNow = Number(new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 13));
  for (let d = 2; d >= 0; d--) {
    for (const [h, ml] of [[1, 90], [4, 100], [7, 90], [10, 110], [13, 100], [16, 90], [19, 110], [22, 100]]) {
      if (d === 0 && h > hourNow - 1) continue;
      log(ethan, d, h, 10, 'bottle', { ml, source: 'formula' }, h % 2 ? 'demo-meiling' : 'demo-siti');
      log(emma, d, h, 25, 'bottle', { ml: ml - 20, source: h % 4 === 1 ? 'breastmilk' : 'formula' }, h % 2 ? 'demo-siti' : 'demo-meiling');
      log(ethan, d, h, 40, 'diaper', { diaper: h % 3 ? 'wet' : 'both' });
      log(emma, d, h, 45, 'diaper', { diaper: h % 3 ? 'wet' : 'dirty' });
    }
    log(ethan, d, 13, 30, 'sleep', { endAt: sgIso(-d, 15, 0) });
    log(emma, d, 13, 45, 'sleep', { endAt: sgIso(-d, 15, 40) });
  }
  for (const [daysAgo, kg] of [[40, 2.6], [30, 3.0], [20, 3.4], [10, 3.8], [1, 4.1]]) log(ethan, daysAgo, 11, 0, 'weight', { kg });
  for (const [daysAgo, kg] of [[40, 2.3], [30, 2.6], [20, 2.9], [10, 3.3], [1, 3.6]]) log(emma, daysAgo, 11, 5, 'weight', { kg });
  return c;
}

// Demo circles for a primary-school child and a teenager, so every family tab has something to show.
function addDemoKidCircles(state) {
  const now = new Date().toISOString();
  const mk = (name, parentName, profile, checkinBy, appts, tasks, note) => {
    const c = randomUUID();
    state.circles.push({ id: c, name, parentName, parentPhone: '', checkinBy, emergencyContacts: [{ name: 'Thomas', phone: '+6591110001', relation: 'Father' }], createdAt: now, demo: true, profile });
    for (const [userId, role] of [['demo-thomas', 'owner'], ['demo-meiling', 'family'], ['demo-weijie', 'family'], ['demo-siti', 'helper']]) state.members.push({ circleId: c, userId, role, joinedAt: now });
    for (const [d, h, m, title, location, escort, notes] of appts) state.appointments.push({ id: randomUUID(), circleId: c, title, startsAt: sgIso(d, h, m), location, notes: notes || '', escortUserId: escort, outcome: '', createdBy: 'demo-thomas', updatedAt: now });
    for (const [title, category, d, assignee, status, dueTime] of tasks) state.tasks.push({ id: randomUUID(), circleId: c, title, category, dueDate: sgDay(d), dueTime: dueTime || '', assigneeUserId: assignee, status, createdBy: 'demo-thomas', createdAt: now, doneBy: status === 'done' ? assignee : '', doneAt: status === 'done' ? now : '' });
    state.notes.push({ id: randomUUID(), circleId: c, authorUserId: note[0], text: note[1], fileId: '', urgent: false, createdAt: sgIso(0, 12, 30), reactions: {}, comments: [] });
    return c;
  };
  mk("Chloe's circle", 'Chloe', { careFor: 'kid', stage: 'primary', living: 'grandparents', needs: ['allergy', 'enrichment'], relation: 'Daughter' }, '',
    [[2, 15, 30, 'Swimming class', 'Community club pool', 'demo-weijie', 'Bring goggles and towel'], [5, 19, 0, 'Parent-teacher meeting', 'Primary school, level 3 classroom', 'demo-meiling'], [9, 10, 0, 'Dental check', 'School dental clinic', '']],
    [['School pick-up at 1.30 pm', 'care', 0, 'demo-siti', 'accepted', '13:30'], ['Buy art supplies for Friday', 'errand', 2, '', 'open'], ['Sign the excursion consent form', 'bill', 1, 'demo-thomas', 'open'], ['Give the school the allergy action plan', 'care', -2, 'demo-meiling', 'done']],
    ['demo-siti', 'Chloe finished her spelling homework and had rice with fish for lunch.']);
  mk("Ryan's circle", 'Ryan', { careFor: 'teen', stage: 'secondary', living: 'parents', needs: ['exams', 'cca', 'travelAlone'], relation: 'Son' }, '19:00',
    [[1, 16, 0, 'Football training', 'School field', ''], [12, 8, 0, 'Mid-year exams start', 'School hall', '', 'Maths paper 1 first'], [20, 14, 30, 'Eye check', 'Optometrist, Tampines', 'demo-meiling']],
    [['Top up the student concession card', 'errand', 1, 'demo-weijie', 'open'], ['Plan a revision timetable with breaks', 'care', 3, '', 'open'], ['Buy new football boots', 'errand', 6, 'demo-thomas', 'accepted']],
    ['demo-meiling', 'Ryan scored in the friendly match today. Home by 6.30 pm.']);
}

function seedState() {
  const state = emptyState();
  // Live mode starts with no sample data: people register and set up their own circles.
  if (require('./mode').isLive()) return state;
  addDemoCircle(state);
  addDemoBabyCircle(state);
  addDemoKidCircles(state);
  return state;
}

module.exports = { seedState, emptyState, addDemoCircle, migrate, DEMO_USERS, STATE_VERSION };
