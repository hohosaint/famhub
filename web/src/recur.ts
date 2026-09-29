// Repeat rules for the app: the same logic as server/lib/recur.js (see recurCore.js).
export type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RepeatRule = { freq: Freq; every: number; weekdays: number[]; monthDays: number[]; months: number[]; until: string };
// @ts-ignore plain JavaScript module
import * as core from './recurCore';
export const cleanRule = (rule: Partial<RepeatRule> | null, start: string, openEnded = false): RepeatRule | null => (core as any).clean(rule, start, { openEnded });
export const expandRule = (start: string, rule: RepeatRule): string[] => (core as any).expand(start, rule);
export const describeRule = (rule: RepeatRule | null): string => (core as any).describe(rule);
export const DAY_NAMES: string[] = (core as any).DAY_NAMES;
export const MONTH_NAMES: string[] = (core as any).MONTH_NAMES;
