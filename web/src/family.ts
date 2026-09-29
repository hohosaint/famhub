import type { CareFor } from './api';
import type { IconName } from './ui';

// The four kinds of care circle, shown as tabs at the top so a family can flip between
// parents, infants, kids and teenagers. Each has its own colour and wording.
export type Kind = { id: CareFor; tab: string; one: string; icon: IconName; iconOn: IconName; gradient: string; color: string; careTab: string; careIcon: IconName; careIconOn: IconName; blurb: string; setup: string };

export const KINDS: Kind[] = [
  { id: 'elder', tab: 'Parents', one: 'parent', icon: 'heart-outline', iconOn: 'heart', gradient: 'linear-gradient(135deg, #0E9384 0%, #1D5FD8 100%)', color: '#0E9384',
    careTab: 'Care', careIcon: 'medkit-outline', careIconOn: 'medkit', blurb: 'Daily check-ins, medicines, appointments, helpers and shared costs for an older parent or relative.', setup: 'Set up a parent' },
  { id: 'baby', tab: 'Infants', one: 'baby', icon: 'happy-outline', iconOn: 'happy', gradient: 'linear-gradient(135deg, #FF8A5B 0%, #F45B8D 55%, #7C5CFF 100%)', color: '#F45B8D',
    careTab: 'Baby', careIcon: 'happy-outline', careIconOn: 'happy', blurb: 'Feeds with formula nutrients, sleep, diapers and growth for a newborn, baby, twins or triplets.', setup: 'Set up a baby' },
  { id: 'kid', tab: 'Kids', one: 'child', icon: 'balloon-outline', iconOn: 'balloon', gradient: 'linear-gradient(135deg, #F59E0B 0%, #F97316 55%, #EF4444 100%)', color: '#F97316',
    careTab: 'Health', careIcon: 'bandage-outline', careIconOn: 'bandage', blurb: 'School runs, CCAs and classes, pick-up rota, allergies, medicine and check-ups for a preschool or primary-school child.', setup: 'Set up a child' },
  { id: 'teen', tab: 'Teens', one: 'teenager', icon: 'school-outline', iconOn: 'school', gradient: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 55%, #0EA5E9 100%)', color: '#7C3AED',
    careTab: 'Health', careIcon: 'fitness-outline', careIconOn: 'fitness', blurb: 'A "home safe" check-in, exams, CCA, transport and appointments for a secondary, JC, Poly or ITE student.', setup: 'Set up a teenager' },
];
export const kindOf = (id?: string) => KINDS.find((k) => k.id === id) || KINDS[0];
