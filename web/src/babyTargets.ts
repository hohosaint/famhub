import type { BabyLog, Targets } from './api';

// Suggested daily energy, protein, fat, carbs and milk for a baby, from published expert formulas.
//
// Energy (Estimated Energy Requirement, kcal/day):
//   National Academies of Sciences, Engineering, and Medicine (NASEM), Dietary Reference Intakes for Energy (2023),
//   as published by Health Canada. Age in years, length in cm, weight in kg, plus the energy cost of growth:
//     Boys:  -716.45 - 1.00 x age + 17.82 x length + 15.06 x weight + growth (200 to 3 months, 50 to 6 months, 20 after)
//     Girls:  -69.15 + 80.0 x age +  2.65 x length + 54.15 x weight + growth (180 to 3 months, 60 to 6 months, 20 to 12 months, 15 after)
//   Without a length, or without the sex: Institute of Medicine (2005) EER = 89 x weight - 100 + growth
//     (175 to 3 months, 56 to 6 months, 22 to 12 months, 20 after).
// Protein: IOM Dietary Reference Intakes: 1.52 g/kg/day (0-6 months), 1.2 g/kg/day (7-12 months), 1.05 g/kg/day (1-3 years).
// Fat and carbohydrate: the share of energy in the IOM Adequate Intakes (0-6 months 31 g fat and 60 g carbs,
//   7-12 months 30 g and 95 g) applied to this baby's energy; 1-3 years 35% of energy from fat and 50% from carbs
//   (middle of the acceptable ranges, 30-40% and 45-65%).
// Milk: up to 6 months, the energy target divided by 67 kcal per 100 ml (breast milk and standard formula).
//   From 6 months, milk and food share the energy, so no milk amount is suggested.
// These are estimates for healthy babies born at term. Premature babies or medical conditions need the doctor's or
// dietitian's targets, which the family can enter instead.

export type Suggestion = {
  targets: Targets;
  basis: { ageDays: number; ageText: string; kg: number; cm: number | null; sex: string; method: 'NASEM 2023' | 'IOM 2005' };
};
export type SuggestResult = { ok: true; s: Suggestion } | { ok: false; missing: string[] };

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export function suggestTargets(baby: { sex?: string; birthDate?: string }, logs: BabyLog[], asOf: Date = new Date()): SuggestResult {
  const missing: string[] = [];
  if (!baby.birthDate) missing.push('birth date');
  const at = asOf.getTime();
  const weight = logs.filter((l) => l.kind === 'weight' && l.kg && new Date(l.at).getTime() <= at).sort((a, b) => b.at.localeCompare(a.at))[0];
  const length = logs.filter((l) => l.kind === 'height' && l.cm && new Date(l.at).getTime() <= at).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!weight) missing.push('weight');
  if (missing.length) return { ok: false, missing };
  const ageDays = Math.max(0, (at - new Date(`${baby.birthDate}T00:00:00+08:00`).getTime()) / 86400e3);
  const ageY = ageDays / 365.25;
  const ageM = ageDays / 30.44;
  if (ageM >= 36) return { ok: false, missing: ['an age under 3 years'] };
  const kg = weight!.kg as number;
  const cm = length ? (length.cm as number) : null;
  const boy = baby.sex === 'boy'; const girl = baby.sex === 'girl';

  let kcal: number; let method: 'NASEM 2023' | 'IOM 2005';
  if (cm && (boy || girl)) {
    method = 'NASEM 2023';
    const growth = boy ? (ageM < 3 ? 200 : ageM < 6 ? 50 : 20) : (ageM < 3 ? 180 : ageM < 6 ? 60 : ageM < 12 ? 20 : 15);
    kcal = boy ? -716.45 - 1.0 * ageY + 17.82 * cm + 15.06 * kg + growth : -69.15 + 80.0 * ageY + 2.65 * cm + 54.15 * kg + growth;
  } else {
    method = 'IOM 2005';
    const growth = ageM < 3 ? 175 : ageM < 6 ? 56 : ageM < 12 ? 22 : 20;
    kcal = 89 * kg - 100 + growth;
  }
  kcal = Math.max(150, kcal);

  let protein: number; let fatShare: number; let carbShare: number;
  if (ageM < 6) { protein = 1.52 * kg; fatShare = (31 * 9) / (31 * 9 + 60 * 4 + 9.1 * 4); carbShare = (60 * 4) / (31 * 9 + 60 * 4 + 9.1 * 4); }
  else if (ageM < 12) { protein = 1.2 * kg; fatShare = (30 * 9) / (30 * 9 + 95 * 4 + 11 * 4); carbShare = (95 * 4) / (30 * 9 + 95 * 4 + 11 * 4); }
  else { protein = 1.05 * kg; fatShare = 0.35; carbShare = 0.5; }
  const fat = (kcal * fatShare) / 9;
  const carbs = (kcal * carbShare) / 4;
  const ml = ageM < 6 ? Math.round(kcal / 0.67 / 10) * 10 : null;

  const ageText = ageDays < 14 ? `${Math.floor(ageDays)} days` : ageM < 3 ? `${Math.floor(ageDays / 7)} weeks` : ageM < 24 ? `${Math.floor(ageM)} months` : `${Math.floor(ageM / 12)} years ${Math.floor(ageM % 12)} months`;
  return {
    ok: true,
    s: {
      targets: { kcal: round(kcal), protein: round(protein, 1), fat: round(fat, 1), carbs: round(carbs, 1), ml },
      basis: { ageDays, ageText, kg, cm, sex: boy ? 'boy' : girl ? 'girl' : '', method },
    },
  };
}

// The targets in use: automatic (worked out again as the baby grows) or the family's own.
export function effectiveTargets(baby: { sex?: string; birthDate?: string; targets?: Targets | null; targetsMode?: string }, logs: BabyLog[], asOf?: Date): { targets: Targets | null; auto: boolean } {
  if (baby.targetsMode === 'auto') {
    const r = suggestTargets(baby, logs, asOf);
    return { targets: r.ok ? r.s.targets : null, auto: true };
  }
  return { targets: baby.targets || null, auto: false };
}
