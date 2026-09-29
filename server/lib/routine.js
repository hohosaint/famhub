// Infants (4.9): a simple daily routine the helper or family ticks off, and the standard check-ups.
//
// The routine is shared by all babies in the circle (twins usually follow one routine).
// Item kinds: milk, meal, nap, bath, medicine, play, other. Ticking a milk item also saves a bottle in the
// baby log (so reports and nutrition keep working); ticking a meal saves a solids entry.

const { randomUUID } = require('crypto');

const KINDS = ['milk', 'meal', 'nap', 'bath', 'medicine', 'play', 'other'];

const ageMonths = (birthDate, at = Date.now()) => (birthDate ? (at - new Date(`${birthDate}T00:00:00+08:00`).getTime()) / (30.44 * 86400e3) : 3);

// A starting routine for the baby's age. Families change the times and amounts to suit their baby.
function suggested(months) {
  const I = (time, kind, title, detail = '', ml = 0) => ({ time, kind, title, detail, ml });
  if (months < 1) {
    return [I('00:00', 'milk', 'Milk', '', 80), I('03:00', 'milk', 'Milk', '', 80), I('06:00', 'milk', 'Milk', '', 80), I('09:00', 'milk', 'Milk', '', 80),
      I('10:00', 'bath', 'Bath', 'Sponge or tub bath, clean the cord area'), I('12:00', 'milk', 'Milk', '', 80), I('15:00', 'milk', 'Milk', '', 80),
      I('18:00', 'milk', 'Milk', '', 80), I('21:00', 'milk', 'Milk', '', 80)];
  }
  if (months < 3) {
    return [I('03:00', 'milk', 'Milk', '', 120), I('06:30', 'milk', 'Milk', '', 120), I('08:00', 'nap', 'Morning nap'), I('10:00', 'milk', 'Milk', '', 120),
      I('10:30', 'bath', 'Bath'), I('13:30', 'milk', 'Milk', '', 120), I('14:00', 'nap', 'Afternoon nap'), I('17:00', 'milk', 'Milk', '', 120),
      I('17:30', 'play', 'Tummy time', 'A few minutes, awake and watched'), I('20:30', 'milk', 'Milk', '', 120), I('23:30', 'milk', 'Milk', '', 120)];
  }
  if (months < 6) {
    return [I('07:00', 'milk', 'Milk', '', 150), I('09:00', 'nap', 'Morning nap'), I('11:00', 'milk', 'Milk', '', 150), I('13:00', 'nap', 'Afternoon nap'),
      I('15:00', 'milk', 'Milk', '', 150), I('16:00', 'play', 'Tummy time and play'), I('18:30', 'bath', 'Bath'), I('19:00', 'milk', 'Milk', '', 180),
      I('23:00', 'milk', 'Dream feed', '', 150)];
  }
  if (months < 12) {
    return [I('07:00', 'milk', 'Milk', '', 180), I('08:30', 'meal', 'Breakfast', 'Baby cereal with fruit puree'), I('09:30', 'nap', 'Morning nap'),
      I('11:30', 'meal', 'Lunch', 'Porridge with fish and vegetables'), I('12:30', 'milk', 'Milk', '', 150), I('14:00', 'nap', 'Afternoon nap'),
      I('16:00', 'meal', 'Snack', 'Soft fruit'), I('17:30', 'meal', 'Dinner', 'Porridge with chicken and pumpkin'), I('18:30', 'bath', 'Bath'),
      I('19:30', 'milk', 'Milk', '', 180)];
  }
  return [I('07:00', 'milk', 'Milk', '', 180), I('08:00', 'meal', 'Breakfast', 'Oats or bread with egg'), I('10:00', 'meal', 'Snack', 'Fruit'),
    I('12:00', 'meal', 'Lunch', 'Rice with fish and vegetables'), I('13:00', 'nap', 'Nap'), I('15:30', 'meal', 'Snack', 'Yoghurt or fruit'),
    I('16:30', 'play', 'Outdoor play'), I('18:00', 'meal', 'Dinner', 'Soft rice or noodles with meat and vegetables'), I('19:00', 'bath', 'Bath'),
    I('20:00', 'milk', 'Milk', '', 180)];
}

function make(items, who) {
  return items.map((x) => ({ id: randomUUID(), time: x.time, kind: x.kind, title: x.title, detail: x.detail || '', ml: x.ml || 0, who: who || '' }));
}

// Singapore check-ups and National Childhood Immunisation Schedule (NCIS, updated 1 April 2026) for under-2s.
// Dates are suggestions from the birth date; the family changes each one to the booked date and time.
const CHECKUPS = [
  { key: 'd3', days: 3, title: 'Newborn check (jaundice)', notes: 'Usually 2 to 3 days after going home: jaundice and feeding check at the polyclinic or GP.' },
  { key: 'm1', months: 1, title: '1-month check-up', notes: 'Weight, feeding and development check. Hepatitis B dose 2 only if the doctor advised it.' },
  { key: 'm2', months: 2, title: '2-month check-up and vaccination', notes: 'Vaccine: 6-in-1 (DTaP-IPV-Hib-HepB) dose 1. Bring the Health Booklet.' },
  { key: 'm4', months: 4, title: '4-month check-up and vaccination', notes: 'Vaccines: 5-in-1 (DTaP-IPV-Hib) dose 2 and pneumococcal (PCV) dose 1. Bring the Health Booklet.' },
  { key: 'm6', months: 6, title: '6-month check-up and vaccination', notes: 'Vaccines: 6-in-1 dose 3 and pneumococcal (PCV) dose 2. Ask about the flu vaccine (6 months to 5 years). Bring the Health Booklet.' },
  { key: 'm12', months: 12, title: '12-month check-up and vaccination', notes: 'Vaccines: pneumococcal (PCV) booster, MMR dose 1 and chickenpox (varicella) dose 1. Bring the Health Booklet.' },
  { key: 'm15', months: 15, title: '15-month vaccination', notes: 'Vaccine: MMRV (measles, mumps, rubella and chickenpox) dose 2. Bring the Health Booklet.' },
  { key: 'm18', months: 18, title: '18-month check-up and vaccination', notes: 'Vaccine: 5-in-1 booster. Development check. Bring the Health Booklet.' },
];

function checkupDate(birthDate, c) {
  const d = new Date(`${birthDate}T09:00:00+08:00`);
  if (c.days) d.setUTCDate(d.getUTCDate() + c.days);
  if (c.months) d.setUTCMonth(d.getUTCMonth() + c.months);
  return d;
}

module.exports = { KINDS, ageMonths, suggested, make, CHECKUPS, checkupDate };
