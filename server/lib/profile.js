// Care profile ("persona") of the parent: stage of life, living situation and extra needs.
// Picking a profile tailors Famhub: the daily check-in time, a starter plan of requests, and tips.

const STAGES = [
  { id: 'active', label: 'Active and independent', icon: 'walk-outline', desc: 'Manages daily life. The family wants a light touch and to know all is well.' },
  { id: 'someHelp', label: 'Needs some help', icon: 'hand-left-outline', desc: 'Help with errands, appointments, bills or getting around.' },
  { id: 'dailyCare', label: 'Needs daily care', icon: 'heart-outline', desc: 'Help every day with meals, bathing, moving or medicines.' },
  { id: 'recovering', label: 'Recovering after hospital', icon: 'bandage-outline', desc: 'Just home from hospital; follow-ups, new medicines and extra help for a while.' },
  { id: 'dementia', label: 'Living with dementia', icon: 'extension-puzzle-outline', desc: 'Memory loss or confusion; routine, safety and patience matter most.' },
  { id: 'endOfLife', label: 'Last stage of life', icon: 'flower-outline', desc: 'Palliative or end-of-life care: comfort, wishes and time together.' },
];

// Babies and young children.
const BABY_STAGES = [
  { id: 'newborn', label: 'Newborn (0-3 months)', icon: 'happy-outline', desc: 'Feeds every 2 to 3 hours, lots of sleep, first checks and jabs.' },
  { id: 'baby', label: 'Baby (3-12 months)', icon: 'balloon-outline', desc: 'Longer sleeps, starting solids around 6 months, crawling.' },
  { id: 'infant', label: 'Infant and toddler (1-3 years)', icon: 'footsteps-outline', desc: 'Walking and talking, growing-up milk and family meals.' },
];
const BABY_LIVING = [
  { id: 'parents', label: 'At home with parents', icon: 'home-outline', desc: 'Parents look after the baby at home.' },
  { id: 'grandparents', label: 'With grandparents in the day', icon: 'people-outline', desc: 'Grandparents help while parents work.' },
  { id: 'nanny', label: 'With a helper or nanny', icon: 'person-add-outline', desc: 'A helper or nanny cares for the baby.' },
  { id: 'infantCare', label: 'At infant care or childcare', icon: 'business-outline', desc: 'Goes to an infant care or childcare centre.' },
];
const BABY_NEEDS = [
  { id: 'formula', label: 'Formula fed', icon: 'water-outline' },
  { id: 'breastfed', label: 'Breastfed', icon: 'heart-outline' },
  { id: 'pumping', label: 'Pumping breast milk', icon: 'flask-outline' },
  { id: 'premature', label: 'Born early (premature)', icon: 'time-outline' },
  { id: 'reflux', label: 'Reflux or spit-up', icon: 'refresh-outline' },
  { id: 'allergy', label: 'Milk or food allergy', icon: 'alert-circle-outline' },
  { id: 'jaundice', label: 'Jaundice', icon: 'sunny-outline' },
  { id: 'solids', label: 'Starting solids', icon: 'restaurant-outline' },
];

// Kids (preschool and primary school) and teenagers (secondary and post-secondary), Singapore context.
const KID_STAGES = [
  { id: 'preschool', label: 'Preschool (3-6 years)', icon: 'color-palette-outline', desc: 'Playgroup to K2: drop-offs, naps, developmental checks.' },
  { id: 'primary', label: 'Primary school (7-12 years)', icon: 'school-outline', desc: 'School runs, homework, CCAs, enrichment and PSLE.' },
];
const KID_LIVING = [
  { id: 'parents', label: 'At home with parents', icon: 'home-outline', desc: 'Parents do most drop-offs and pick-ups.' },
  { id: 'grandparents', label: 'Grandparents help after school', icon: 'people-outline', desc: 'Grandparents fetch and mind them after school.' },
  { id: 'helper', label: 'With a helper', icon: 'person-add-outline', desc: 'A helper does school runs and meals.' },
  { id: 'studentCare', label: 'Student care after school', icon: 'business-outline', desc: 'Goes to a student care centre after school.' },
  { id: 'twoHomes', label: 'Two homes (shared care)', icon: 'swap-horizontal-outline', desc: 'Time split between two households.' },
];
const KID_NEEDS = [
  { id: 'allergy', label: 'Food allergy', icon: 'alert-circle-outline' },
  { id: 'asthma', label: 'Asthma', icon: 'fitness-outline' },
  { id: 'eczema', label: 'Eczema or sensitive skin', icon: 'bandage-outline' },
  { id: 'learning', label: 'Learning support', icon: 'book-outline' },
  { id: 'glasses', label: 'Glasses or eye checks', icon: 'glasses-outline' },
  { id: 'enrichment', label: 'CCA and enrichment classes', icon: 'musical-notes-outline' },
  { id: 'schoolBus', label: 'Takes the school bus', icon: 'bus-outline' },
  { id: 'medicine', label: 'Daily medicine', icon: 'medkit-outline' },
];
const TEEN_STAGES = [
  { id: 'secondary', label: 'Secondary school (13-16 years)', icon: 'school-outline', desc: 'More independence, CCAs, O-Level or N-Level years.' },
  { id: 'postSecondary', label: 'JC, Poly or ITE (17-19 years)', icon: 'library-outline', desc: 'A-Levels or diploma, part-time work, planning ahead.' },
];
const TEEN_LIVING = [
  { id: 'parents', label: 'At home with parents', icon: 'home-outline', desc: 'Lives at home and travels on their own.' },
  { id: 'grandparents', label: 'With grandparents', icon: 'people-outline', desc: 'Grandparents are the adults at home.' },
  { id: 'hostel', label: 'Boarding or hostel', icon: 'bed-outline', desc: 'Stays in a school hostel on weekdays.' },
  { id: 'twoHomes', label: 'Two homes (shared care)', icon: 'swap-horizontal-outline', desc: 'Time split between two households.' },
];
const TEEN_NEEDS = [
  { id: 'exams', label: 'Major exams this year', icon: 'document-text-outline' },
  { id: 'cca', label: 'CCA or sports training', icon: 'football-outline' },
  { id: 'travelAlone', label: 'Travels alone (MRT and bus)', icon: 'train-outline' },
  { id: 'wellbeing', label: 'Wants regular check-ins', icon: 'chatbubble-ellipses-outline' },
  { id: 'allergy', label: 'Allergy or asthma', icon: 'alert-circle-outline' },
  { id: 'partTime', label: 'Part-time job', icon: 'briefcase-outline' },
  { id: 'ns', label: 'National Service coming up', icon: 'shield-outline' },
  { id: 'medicine', label: 'Daily medicine', icon: 'medkit-outline' },
];

const LIVING = [
  { id: 'alone', label: 'Lives alone', icon: 'person-outline', desc: 'A daily check-in and quick help matter most.' },
  { id: 'spouse', label: 'With spouse', icon: 'people-outline', desc: 'Lives with husband or wife.' },
  { id: 'family', label: 'With family', icon: 'home-outline', desc: 'Lives with children or relatives.' },
  { id: 'helper', label: 'With a live-in helper', icon: 'person-add-outline', desc: 'A domestic or care helper lives in.' },
  { id: 'nursingHome', label: 'In a nursing home', icon: 'business-outline', desc: 'Lives in a nursing home or care facility.' },
];

const NEEDS = [
  { id: 'falls', label: 'Falls risk or frail', icon: 'warning-outline' },
  { id: 'diabetes', label: 'Diabetes', icon: 'water-outline' },
  { id: 'heart', label: 'Heart or blood pressure', icon: 'pulse-outline' },
  { id: 'hearingSight', label: 'Hearing or sight loss', icon: 'ear-outline' },
  { id: 'wheelchair', label: 'Uses a wheelchair', icon: 'accessibility-outline' },
  { id: 'manyMeds', label: 'Takes many medicines', icon: 'medkit-outline' },
  { id: 'dialysis', label: 'Needs dialysis', icon: 'fitness-outline' },
  { id: 'lonely', label: 'Often lonely', icon: 'chatbubbles-outline' },
  { id: 'swallowing', label: 'Trouble swallowing', icon: 'restaurant-outline' },
];

// Starter requests: [key, title, type, days from now]
const TASKS = {
  active: [['screening', 'Book a yearly health screening', 'care', 30]],
  someHelp: [['errands', 'Agree who does groceries and errands each week', 'errand', 3]],
  dailyCare: [['dailyRota', 'Plan who helps with meals and bathing each day', 'care', 2], ['grants', 'Check caregiver grants and subsidies', 'bill', 14]],
  recovering: [['dischargeMeds', 'Collect the discharge medicines and memo', 'refill', 1], ['followUp', 'Book the follow-up appointment on the discharge memo', 'care', 3], ['homeHelp', 'Arrange extra help at home for the first 2 weeks', 'care', 2]],
  dementia: [['idCard', 'Put a card with a family phone number in the wallet', 'care', 2], ['memoryClinic', 'Ask the doctor about a memory clinic referral', 'care', 14], ['routine', 'Make a simple daily routine chart for the wall', 'care', 7]],
  endOfLife: [['wishes', 'Talk about care wishes and preferred place of care (Advance Care Planning)', 'care', 7], ['palliativeTeam', 'Arrange a home palliative care team', 'care', 3], ['comfortMeds', 'List comfort medicines and when to give them', 'refill', 3], ['visitRota', 'Set up a visiting rota for family and friends', 'care', 5], ['papers', 'Gather important papers (LPA, will, insurance)', 'bill', 14]],
  alone: [['spareKey', 'Leave a spare key with a trusted neighbour', 'errand', 7], ['fridgeNumbers', 'Put emergency numbers on the fridge', 'care', 3], ['alarm', 'Set up a personal alert alarm', 'care', 14]],
  helper: [['helperRoutine', 'Share the daily care routine with the helper', 'care', 3]],
  nursingHome: [['homeContact', 'Save the nursing home phone number and visiting hours', 'care', 2], ['homeVisits', 'Plan a family visiting rota', 'care', 5]],
  falls: [['tripHazards', 'Check the home for trip hazards (rugs, cables, lighting)', 'care', 7], ['grabBars', 'Install grab bars in the toilet and shower', 'errand', 14], ['fallsCheck', 'Ask about a falls assessment at the next doctor visit', 'care', 21]],
  diabetes: [['eyeFoot', 'Book the yearly diabetic eye and foot screening', 'care', 30], ['sugarLog', 'Keep a blood sugar log for the next doctor visit', 'care', 7]],
  heart: [['bpMonitor', 'Buy a home blood pressure monitor', 'errand', 7], ['bpLog', 'Record blood pressure every morning for 2 weeks', 'care', 8]],
  hearingSight: [['hearEye', 'Book a hearing and eye check', 'care', 30]],
  wheelchair: [['transport', 'Check wheelchair-friendly transport for appointments', 'errand', 7]],
  manyMeds: [['medReview', 'Ask the pharmacist for a medicine review', 'refill', 14], ['pillBox', 'Set up a weekly pill organiser', 'refill', 3]],
  dialysis: [['dialysisTransport', 'Plan transport to and from dialysis', 'errand', 3]],
  lonely: [['callRota', 'Plan a weekly visit or video-call rota', 'care', 5], ['activityCentre', 'Look for an activity centre nearby', 'care', 21]],
  swallowing: [['swallowCheck', 'Ask about a swallowing assessment', 'care', 14]],
};

const BABY_TASKS = {
  newborn: [['registerBirth', 'Register the birth (within 42 days)', 'bill', 14], ['babyBonus', 'Apply for the Baby Bonus', 'bill', 21], ['firstCheck', 'Book the first baby check at the polyclinic or GP', 'care', 7], ['jabs', 'Note the vaccination dates in the health booklet', 'care', 7]],
  baby: [['jabsBaby', 'Check the next vaccinations are booked', 'care', 14], ['solidsPlan', 'Plan first solid foods around 6 months', 'care', 30], ['babyProof', 'Baby-proof the home (gates, socket covers)', 'errand', 21]],
  infant: [['devCheck', 'Book the developmental check-up', 'care', 30], ['growingMilk', 'Review milk and meals with the doctor', 'care', 30]],
  grandparents: [['gpBrief', 'Share the feeding and nap routine with the grandparents', 'care', 3]],
  nanny: [['nannyBrief', 'Share the feeding and nap routine with the helper', 'care', 3]],
  infantCare: [['centreBag', 'Pack the infant care bag (milk, diapers, clothes)', 'errand', 2], ['centreContact', 'Save the centre phone number and pick-up list', 'care', 3]],
  formula: [['formulaStock', 'Keep a spare tin of formula at home', 'errand', 7], ['sterilise', 'Set up bottle washing and sterilising', 'errand', 2]],
  breastfed: [['lactation', 'Find a lactation consultant contact if needed', 'care', 7]],
  pumping: [['milkStore', 'Label stored breast milk with the date', 'care', 2]],
  premature: [['nicuFollow', 'Keep the follow-up dates from the hospital', 'care', 7]],
  reflux: [['refluxNote', 'Note spit-ups to show the doctor', 'care', 7]],
  allergy: [['allergyPlan', 'Write down the allergy plan from the doctor', 'care', 7]],
  jaundice: [['jaundiceCheck', 'Go for the jaundice check the hospital asked for', 'care', 2]],
  solids: [['firstFoods', 'Plan first foods and watch for reactions', 'care', 7]],
  multiples: [['bottleColours', 'Give each baby a bottle colour so feeds are not mixed up', 'errand', 2], ['syncFeeds', 'Agree on a feeding and nap routine for the babies with every carer', 'care', 3], ['extraHands', 'Plan extra hands for the night feeds (a rota)', 'care', 3], ['multiplesSupport', 'Find a support group for parents of twins and triplets', 'care', 14]],
};
const BABY_FOCUS = {
  newborn: { title: 'Feeds, sleep and settling in', tips: ['Log each feed so whoever is on duty knows when the next one is due.', 'Count wet and dirty diapers: the doctor may ask.', 'Weigh at each check and add it under Growth.'] },
  baby: { title: 'Routines and first foods', tips: ['Keep nap and feed times in Famhub so carers follow one routine.', 'Log new foods to spot any reaction.'] },
  infant: { title: 'Growing, walking and talking', tips: ['Share milestones and photos in Updates.', 'Keep jabs and check-ups in the calendar.'] },
};

const KID_TASKS = {
  preschool: [['devCheckKid', 'Book the developmental check and jabs at the polyclinic', 'care', 21], ['p1Reg', 'Note the Primary 1 registration dates (the year before P1)', 'care', 30], ['preschoolContacts', 'Save the preschool phone number and pick-up list', 'care', 3]],
  primary: [['schoolRota', 'Set up the school drop-off and pick-up rota', 'care', 3], ['schoolHealth', 'Check the school health screening and jabs letter', 'care', 14], ['labelItems', 'Label the school bag, bottle and uniform', 'errand', 5], ['ptm', 'Add the parent-teacher meeting to the calendar', 'care', 30]],
  grandparents: [['gpBriefKid', 'Share the after-school routine with the grandparents', 'care', 3]],
  helper: [['helperBriefKid', 'Share the school timetable and routine with the helper', 'care', 3]],
  studentCare: [['studentCareContacts', 'Save the student care centre contacts and pick-up time', 'care', 3]],
  twoHomes: [['handover', 'Agree on the handover days and share them in the calendar', 'care', 5]],
  allergy: [['allergyPlanKid', 'Give the school the allergy action plan', 'care', 7], ['epipen', 'Check the EpiPen expiry date', 'refill', 14]],
  asthma: [['inhalerSchool', 'Keep a spare inhaler at school', 'refill', 7]],
  eczema: [['skinCare', 'Stock up on moisturiser and note the skin routine', 'errand', 7]],
  learning: [['learningPlan', 'Share the learning support plan with everyone who helps', 'care', 7]],
  glasses: [['eyeCheckKid', 'Book the yearly eye check', 'care', 30]],
  enrichment: [['enrichmentTimetable', 'Put CCA and enrichment classes in the calendar', 'care', 5]],
  schoolBus: [['busDriver', "Save the school bus driver's number", 'care', 2]],
  medicine: [['medsSchool', 'Tell the school about daily medicine', 'care', 5]],
};
const TEEN_TASKS = {
  secondary: [['examDates', 'Add the exam timetable to the calendar', 'care', 14], ['homeBy', 'Agree on a home-by time and a check-in', 'care', 3], ['concession', 'Check the student concession card for MRT and bus', 'errand', 14], ['nric15', 'Register for the NRIC within a year of turning 15 (ICA)', 'bill', 30]],
  postSecondary: [['courseApps', 'Note course application dates and deadlines', 'care', 30], ['budgetTeen', 'Agree on a monthly allowance', 'bill', 14]],
  hostel: [['hostelContacts', 'Save the hostel contacts and weekend plans', 'care', 3]],
  twoHomes: [['handoverTeen', 'Share which home they are at each week', 'care', 5]],
  exams: [['studyPlan', 'Plan a revision timetable with breaks', 'care', 7], ['examMeals', 'Plan easy meals and early nights in exam weeks', 'care', 14]],
  cca: [['ccaSchedule', 'Put CCA training and competitions in the calendar', 'care', 5]],
  travelAlone: [['travelShare', 'Agree on sharing location when out late', 'care', 3]],
  wellbeing: [['weeklyTalk', 'Set a relaxed weekly catch-up (a meal or a walk)', 'care', 7]],
  allergy: [['allergyTeen', 'Make sure they carry their allergy or asthma medicine', 'refill', 3]],
  partTime: [['shifts', 'Share work shifts in the calendar', 'care', 5]],
  ns: [['nsReg', 'Register for National Service at about 16½ (CMPB)', 'bill', 30]],
  medicine: [['medsTeen', 'Set a daily medicine reminder', 'refill', 2]],
};
const KID_FOCUS = {
  preschool: { title: 'Routines and little milestones', tips: ['Share drop-off and pick-up in Requests so nobody is caught out.', 'Post photos and funny moments in Updates for the grandparents.'] },
  primary: { title: 'School days running smoothly', tips: ['Keep school events, CCAs and tuition in the calendar with who fetches.', 'Use Requests for things like "buy art supplies by Friday".'] },
};
const TEEN_FOCUS = {
  secondary: { title: 'Independence with a safety net', tips: ['A simple daily check-in ("home safe") keeps everyone at ease without nagging.', 'Put exams and CCA in the calendar so the family can plan around them.'] },
  postSecondary: { title: 'Growing up and planning ahead', tips: ['Keep application deadlines and interviews in the calendar.', 'Talk about plans and money over a meal, not only in messages.'] },
};

const FOCUS = {
  active: { title: 'Staying well and connected', tips: ['A quick daily "I\'m OK" keeps everyone at ease.', 'Share good news in Updates, not only problems.'] },
  someHelp: { title: 'Sharing the load', tips: ['Post jobs as requests so anyone can take them.', 'Rotate appointment escorts so no one burns out.'] },
  dailyCare: { title: 'Steady daily care', tips: ['Tick medicines as they are given so nothing is doubled.', 'Use the daily update template for meals, mood and sleep.'] },
  recovering: { title: 'A safe recovery', tips: ['Watch for new pain, fever or confusion and call the clinic.', 'Add visit notes after each follow-up so everyone knows the plan.'] },
  dementia: { title: 'Routine, safety and calm', tips: ['Keep the same times for meals and medicines each day.', 'Photos of medicines help the helper give the right one.'] },
  endOfLife: { title: 'Comfort, wishes and time together', tips: ['Comfort matters most: pain, breathing, mouth care and rest.', 'Share visiting times so no one is alone and no one is overwhelmed.', 'Write down wishes early; it makes hard moments easier.'] },
};

const ids = (list) => list.map((x) => x.id);

const KINDS = {
  baby: { S: BABY_STAGES, L: BABY_LIVING, N: BABY_NEEDS },
  kid: { S: KID_STAGES, L: KID_LIVING, N: KID_NEEDS },
  teen: { S: TEEN_STAGES, L: TEEN_LIVING, N: TEEN_NEEDS },
  elder: { S: STAGES, L: LIVING, N: NEEDS },
};
function clean(p) {
  const x = p && typeof p === 'object' ? p : {};
  const careFor = KINDS[x.careFor] ? x.careFor : 'elder';
  const { S, L: Lv, N } = KINDS[careFor];
  const baby = careFor === 'baby';
  return {
    careFor,
    stage: ids(S).includes(x.stage) ? x.stage : S[careFor === 'elder' ? 1 : 0].id,
    living: ids(Lv).includes(x.living) ? x.living : Lv[careFor === 'elder' ? 2 : 0].id,
    needs: [...new Set((Array.isArray(x.needs) ? x.needs : []).filter((n) => ids(N).includes(n)))],
    relation: typeof x.relation === 'string' ? x.relation.slice(0, 20) : '',
    ...(baby ? { count: Math.max(1, Math.min(4, Math.round(Number(x.count) || 1))) } : {}),
  };
}

// The plan Famhub suggests for this profile.
function plan(profileIn) {
  const p = clean(profileIn);
  if (p.careFor === 'kid' || p.careFor === 'teen') {
    const T = p.careFor === 'kid' ? KID_TASKS : TEEN_TASKS;
    const Fo = p.careFor === 'kid' ? KID_FOCUS : TEEN_FOCUS;
    const seen = new Set(); const tasks = [];
    for (const k of [p.stage, p.living, ...p.needs]) for (const [key, title, category, days] of T[k] || []) if (!seen.has(key)) { seen.add(key); tasks.push({ key, title, category, days }); }
    const f = Fo[p.stage] || Object.values(Fo)[0];
    // Teens get a daily "home safe" check-in by default; kids do not (an adult is always with them).
    return { profile: p, checkinBy: p.careFor === 'teen' ? '19:00' : '', tasks, focus: { title: f.title, tips: f.tips }, quietNags: false };
  }
  if (p.careFor === 'baby') {
    const keys = [p.stage, p.living, ...p.needs, ...(p.count > 1 ? ['multiples'] : [])];
    const seen = new Set(); const tasks = [];
    for (const k of keys) for (const [key, title, category, days] of BABY_TASKS[k] || []) if (!seen.has(key)) { seen.add(key); tasks.push({ key, title, category, days }); }
    const f = BABY_FOCUS[p.stage] || BABY_FOCUS.newborn;
    const tips = p.count > 1 ? [...f.tips, `${p.count === 2 ? 'Twins' : 'Triplets'}: tick one or all babies when you log a feed; each baby's milk and nutrients are counted on their own and shown side by side.`] : f.tips;
    return { profile: p, checkinBy: '', feedEvery: p.stage === 'newborn' ? 3 : p.stage === 'baby' ? 4 : 0, tasks, focus: { title: f.title, tips }, quietNags: false };
  }
  let checkinBy = '10:00';
  if (p.living === 'alone' || p.stage === 'dementia') checkinBy = '09:00';
  if (p.living === 'nursingHome') checkinBy = '11:00';
  const keys = [p.stage, p.living, ...p.needs];
  const seen = new Set();
  const tasks = [];
  for (const k of keys) for (const [key, title, category, days] of TASKS[k] || []) if (!seen.has(key)) { seen.add(key); tasks.push({ key, title, category, days }); }
  const focus = FOCUS[p.stage] || FOCUS.someHelp;
  const extraTips = [];
  if (p.living === 'alone') extraTips.push('Living alone: if there is no check-in by the set time, the family is alerted, then urgently an hour later.');
  if (p.needs.includes('falls')) extraTips.push('Falls risk: the "I need help" button is on Mum\'s home screen; make sure it is easy to reach.');
  return {
    profile: p, checkinBy, tasks, focus: { title: focus.title, tips: [...focus.tips, ...extraTips] },
    quietNags: p.stage === 'endOfLife',   // no "overdue" reminders in the last stage of life
  };
}

module.exports = { STAGES, LIVING, NEEDS, BABY_STAGES, BABY_LIVING, BABY_NEEDS, KID_STAGES, KID_LIVING, KID_NEEDS, TEEN_STAGES, TEEN_LIVING, TEEN_NEEDS, clean, plan };
