// Infant and growing-up milk formulas sold in Singapore (supermarkets and pharmacies, 2026).
// Product names come from NTUC FairPrice, Watsons and Singapore parenting guides.
// Nutrition is per 100 ml of made-up milk. These are TYPICAL values for the kind of formula
// (they vary a little by brand and change when recipes change): families should check the tin
// and correct them in Famhub (Baby > Formula > Edit values). Famhub gives no feeding advice.

const TYPICAL = {
  1: { kcal: 67, protein: 1.3, fat: 3.5, carbs: 7.4 },   // infant formula, 0-6 months
  2: { kcal: 67, protein: 1.6, fat: 3.2, carbs: 7.8 },   // follow-on formula, 6-12 months
  3: { kcal: 68, protein: 2.3, fat: 2.9, carbs: 8.3 },   // growing-up milk, 1-3 years
};
const SOY = { protein: 1.8 };

// [id, brand, product, stage, type]
const LIST = [
  ['similac-5mo-1', 'Abbott Similac', 'Similac 5MO Infant Formula', 1, 'cow'],
  ['similac-1', 'Abbott Similac', 'Similac Infant Milk Formula', 1, 'cow'],
  ['similac-tc-1', 'Abbott Similac', 'Similac Total Comfort', 1, 'cow (partly broken-down protein)'],
  ['similac-gain-2', 'Abbott Similac', 'Similac Gain 5MO Growing-up Milk', 2, 'cow'],
  ['similac-tcha-2', 'Abbott Similac', 'Similac Total Comfort H.A Follow On', 2, 'cow (hydrolysed)'],
  ['isomil-1', 'Abbott', 'Isomil Infant Formula (soy)', 1, 'soy'],
  ['growbaby-1', 'Abbott', 'Grow Baby Infant Milk Formula', 1, 'cow'],
  ['enfamil-proa-1', 'Enfamil', 'Enfamil Pro A+ Infant Formula', 1, 'cow'],
  ['enfamil-proa-2', 'Enfamil', 'Enfamil Pro A+ Follow-On Formula', 2, 'cow'],
  ['enfamil-a2-1', 'Enfamil', 'Enfamil A2 Infant Formula', 1, 'cow (A2 protein)'],
  ['enfagrow-3', 'Enfagrow', 'Enfagrow A+ Growing-up Milk', 3, 'cow'],
  ['nan-optipro-1', 'Nestle NAN', 'NAN OPTIPRO Infant Milk (5-MO)', 1, 'cow'],
  ['nan-optipro-2', 'Nestle NAN', 'NAN OPTIPRO Follow-up Milk (5-MO)', 2, 'cow'],
  ['nan-supreme-ha-1', 'Nestle NAN', 'NAN Supremepro H.A', 1, 'cow (hydrolysed)'],
  ['nan-supreme-ha-2', 'Nestle NAN', 'NAN Supremepro H.A Follow-on', 2, 'cow (hydrolysed)'],
  ['nan-ar-1', 'Nestle NAN', 'NAN A.R (anti-regurgitation)', 1, 'cow (thickened)'],
  ['nankid-3', 'Nestle NAN', 'NANKID OPTIPRO Growing-up Milk', 3, 'cow'],
  ['aptamil-profutura-1', 'Aptamil', 'Aptamil Profutura Cesarbiotik Infant', 1, 'cow'],
  ['aptamil-gold-2', 'Aptamil', 'Aptamil Gold+ Follow On', 2, 'cow'],
  ['aptamil-gold-3', 'Aptamil', 'Aptamil Gold+ Growing-up Milk', 3, 'cow'],
  ['s26-goldpro-1', 'Wyeth S-26', 'S-26 Gold Pro Infant Formula', 1, 'cow'],
  ['s26-promil-2', 'Wyeth S-26', 'S-26 Promil Gold Follow On', 2, 'cow'],
  ['s26-progress-3', 'Wyeth S-26', 'S-26 Progress Gold Growing-up Milk', 3, 'cow'],
  ['friso-gold-1', 'Friso', 'Frisolac Gold Infant', 1, 'cow'],
  ['friso-gold-2', 'Friso', 'Frisolac Gold Follow-on', 2, 'cow'],
  ['friso-gold-3', 'Friso', 'Friso Gold Growing-up Milk', 3, 'cow'],
  ['dumex-dulac-1', 'Dumex', 'Dumex Dulac Infant', 1, 'cow'],
  ['dumex-mamil-2', 'Dumex', 'Dumex Mamil Gold Follow-on', 2, 'cow'],
  ['dumex-dugro-3', 'Dumex', 'Dumex Dugro Growing-up Milk', 3, 'cow'],
  ['bellamys-1', "Bellamy's Organic", "Bellamy's Organic Infant Formula", 1, 'cow (organic)'],
  ['bellamys-2', "Bellamy's Organic", "Bellamy's Organic Follow-on Formula", 2, 'cow (organic)'],
  ['kendamil-1', 'Kendamil', 'Kendamil Classic First Infant Milk', 1, 'cow (whole milk)'],
  ['kendamil-org-1', 'Kendamil', 'Kendamil Organic First Infant Milk', 1, 'cow (organic)'],
  ['kendamil-2', 'Kendamil', 'Kendamil Classic Follow-on Milk', 2, 'cow (whole milk)'],
  ['karihome-1', 'Karihome', 'Karihome Goat Milk Infant Formula', 1, 'goat'],
  ['karihome-2', 'Karihome', 'Karihome Goat Milk Follow-on', 2, 'goat'],
  ['littleoak-1', 'LittleOak', 'LittleOak Natural Goat Milk Infant', 1, 'goat'],
  ['bubs-goat-1', 'Bubs', 'Bubs Goat Milk Infant Formula', 1, 'goat'],
  ['bubs-3', 'Bubs', 'Bubs Organic Grass Fed Toddler Milk', 3, 'cow (organic)'],
  ['a2-platinum-1', 'a2', 'a2 Platinum Premium Infant Formula', 1, 'cow (A2 protein)'],
  ['a2-platinum-2', 'a2', 'a2 Platinum Premium Follow-on', 2, 'cow (A2 protein)'],
  ['wakodo-1', 'Wakodo', 'Wakodo Lebens Infant Milk', 1, 'cow'],
  ['meiji-1', 'Meiji', 'Meiji Hohoemi Infant Formula', 1, 'cow'],
  ['morinaga-1', 'Morinaga', 'Morinaga Hagukumi Infant Formula', 1, 'cow'],
  ['fairprice-gold-1', 'FairPrice', 'FairPrice Gold Newborn Infant Formula', 1, 'cow'],
  ['fairprice-gold-2', 'FairPrice', 'FairPrice Gold Follow on Milk', 2, 'cow'],
];

const FORMULAS = LIST.map(([id, brand, product, stage, type]) => ({
  id, brand, product, stage, type,
  stageLabel: stage === 1 ? 'Stage 1 (0-6 months)' : stage === 2 ? 'Stage 2 (6-12 months)' : 'Stage 3 (1-3 years)',
  per100ml: { ...TYPICAL[stage], ...(type === 'soy' ? SOY : {}) },
  typical: true,
}));

const BREAST_MILK = { kcal: 67, protein: 1.1, fat: 4.2, carbs: 7.0 };   // average mature breast milk per 100 ml

module.exports = { FORMULAS, BREAST_MILK, TYPICAL };
