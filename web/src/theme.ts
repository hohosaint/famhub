// Famhub design tokens (4.2): colour themes plus light and dark mode.
//
// Every colour below is a CSS variable, so switching theme or dark mode is instant and needs no reload.
// Themes follow the most common app palettes (2026 research): trusted blue (the most used colour in
// health and finance apps), calm green (healing), warm neutral "sand" with terracotta (the 2026
// elevated-neutrals trend), bold indigo, and the original teal. Dark mode uses charcoal, not pure black,
// with lighter accent shades so text keeps WCAG AA contrast.

type Tone = { primary: string; primaryDark: string; accent: string; grad1: string; grad2: string };
export type Palette = { id: string; name: string; desc: string; light: Tone; dark: Tone; warmBg?: boolean };

export const PALETTES: Palette[] = [
  { id: 'ocean', name: 'Ocean blue', desc: 'Trusted blue, the most popular app colour',
    light: { primary: '#1D5FD8', primaryDark: '#154AAE', accent: '#0E9384', grad1: '#1D5FD8', grad2: '#0EA5E9' },
    dark: { primary: '#6EA0FF', primaryDark: '#8DB4FF', accent: '#3CCBB8', grad1: '#2563EB', grad2: '#0891B2' } },
  { id: 'sage', name: 'Sage green', desc: 'Calm, natural and healing',
    light: { primary: '#2E7D5B', primaryDark: '#1F5E43', accent: '#B45309', grad1: '#2E7D5B', grad2: '#65A30D' },
    dark: { primary: '#5CC495', primaryDark: '#7FD4AD', accent: '#F59E0B', grad1: '#23694B', grad2: '#4D7C0F' } },
  { id: 'sand', name: 'Warm sand', desc: 'Soft neutrals with terracotta, easy on the eyes', warmBg: true,
    light: { primary: '#B4532A', primaryDark: '#8C3F1F', accent: '#3F6F5F', grad1: '#C2593C', grad2: '#D98E4A' },
    dark: { primary: '#F08C5E', primaryDark: '#F5A47E', accent: '#7FBFA9', grad1: '#A8482A', grad2: '#B7702F' } },
  { id: 'indigo', name: 'Indigo', desc: 'Bold and modern',
    light: { primary: '#4F46E5', primaryDark: '#3730A3', accent: '#DB2777', grad1: '#4F46E5', grad2: '#9333EA' },
    dark: { primary: '#8B85FF', primaryDark: '#A5A0FF', accent: '#F472B6', grad1: '#4338CA', grad2: '#7E22CE' } },
  { id: 'teal', name: 'Teal (4.0)', desc: 'The previous Famhub look',
    light: { primary: '#0C7C80', primaryDark: '#095F63', accent: '#5B4BE8', grad1: '#0C7C80', grad2: '#5B4BE8' },
    dark: { primary: '#3CC3C7', primaryDark: '#6AD5D8', accent: '#9B8FFF', grad1: '#0B6F73', grad2: '#4B3CCF' } },
];

const LIGHT = {
  bg: '#F5F7FA', card: '#FFFFFF', surfaceAlt: '#F2F4F7', surfaceAlt2: '#E9ECF1', border: '#E4E7EC', borderStrong: '#CDD3DC',
  text: '#101828', muted: '#475467', faint: '#7A8497', primaryText: '#FFFFFF',
  danger: '#D92D20', dangerSoft: '#FEECEB', dangerBorder: '#F6B8B2',
  warn: '#B54708', warnSoft: '#FFF4E0', warnBorder: '#F5CB86', warnText: '#7A3E00',
  ok: '#067647', okSoft: '#E6F6EC', okBorder: '#A6DDBB', okText: '#05603A',
  info: '#1D5FD8', infoSoft: '#EAF1FE',
  overlay: 'rgba(16,24,40,0.45)', shadow: '#101828',
};
const WARM = { bg: '#F6F1EA', surfaceAlt: '#F1EBE2', surfaceAlt2: '#E8E0D5', border: '#E5DDD2', borderStrong: '#D3C8BA' };
const DARK = {
  bg: '#0E1116', card: '#171B22', surfaceAlt: '#1E232C', surfaceAlt2: '#262C36', border: '#2B313C', borderStrong: '#3A4250',
  text: '#F2F4F7', muted: '#B4BCC8', faint: '#808A9A', primaryText: '#FFFFFF',
  danger: '#FF6B61', dangerSoft: 'rgba(255,107,97,0.14)', dangerBorder: 'rgba(255,107,97,0.40)',
  warn: '#FDB022', warnSoft: 'rgba(253,176,34,0.13)', warnBorder: 'rgba(253,176,34,0.38)', warnText: '#FEC84B',
  ok: '#47CD89', okSoft: 'rgba(71,205,137,0.13)', okBorder: 'rgba(71,205,137,0.38)', okText: '#75E0A7',
  info: '#6EA0FF', infoSoft: 'rgba(110,160,255,0.14)',
  overlay: 'rgba(0,0,0,0.6)', shadow: '#000000',
};

const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const KEYS = ['bg', 'card', 'surfaceAlt', 'surfaceAlt2', 'border', 'borderStrong', 'text', 'muted', 'faint', 'primary', 'primaryDark', 'primaryText', 'primarySoft',
  'accent', 'accentSoft', 'accentBorder', 'danger', 'dangerSoft', 'dangerBorder', 'warn', 'warnSoft', 'warnBorder', 'warnText', 'ok', 'okSoft', 'okBorder', 'okText',
  'info', 'infoSoft', 'overlay', 'shadow', 'grad1', 'grad2'] as const;
type Key = typeof KEYS[number];

// Components use these: each is a CSS variable, e.g. colors.primary = "var(--fh-primary)".
export const colors = Object.fromEntries(KEYS.map((k) => [k, `var(--fh-${k})`])) as Record<Key, string>;

export const gradients = {
  brand: 'linear-gradient(135deg, var(--fh-grad1) 0%, var(--fh-grad2) 100%)',
  sunrise: 'linear-gradient(135deg, #FF8A5B 0%, #F45B8D 100%)',
  calm: 'linear-gradient(135deg, var(--fh-primarySoft) 0%, var(--fh-accentSoft) 100%)',
  danger: 'linear-gradient(135deg, #D92D20 0%, #F0663A 100%)',
  baby: 'linear-gradient(135deg, #FF8A5B 0%, #F45B8D 50%, #7C5CFF 100%)',
};
export const radius = 20;
export const shadow = { shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 };

// A stable colour for each person, as in shared family calendars (readable in light and dark).
const PEOPLE = ['#0E9384', '#2563EB', '#C2410C', '#7C3AED', '#DB2777', '#15803D', '#B45309', '#0E7490'];
export function personColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PEOPLE[h % PEOPLE.length];
}

// ---------- theme choice (per device) ----------
export type Mode = 'system' | 'light' | 'dark';
export type ThemeChoice = { palette: string; mode: Mode };
const STORE = 'famhub_theme';
const listeners = new Set<() => void>();

export function getTheme(): ThemeChoice {
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && PALETTES.some((p) => p.id === v.palette) && ['system', 'light', 'dark'].includes(v.mode)) return v; } catch { /* no storage */ }
  return { palette: 'ocean', mode: 'system' };
}
const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
export const isDark = (t: ThemeChoice = getTheme()) => t.mode === 'dark' || (t.mode === 'system' && systemDark());

function varsFor(t: ThemeChoice): Record<Key, string> {
  const p = PALETTES.find((x) => x.id === t.palette) || PALETTES[0];
  const dark = isDark(t);
  const tone = dark ? p.dark : p.light;
  const base = dark ? DARK : { ...LIGHT, ...(p.warmBg ? WARM : {}) };
  return {
    ...base, ...tone,
    primarySoft: dark ? rgba(tone.primary, 0.16) : rgba(tone.primary, 0.1),
    accentSoft: dark ? rgba(tone.accent, 0.16) : rgba(tone.accent, 0.1),
    accentBorder: rgba(tone.accent, dark ? 0.4 : 0.3),
  } as Record<Key, string>;
}

export function applyTheme(t: ThemeChoice = getTheme()) {
  if (typeof document === 'undefined') return;
  const v = varsFor(t);
  const dark = isDark(t);
  let el = document.getElementById('fh-theme') as HTMLStyleElement | null;
  if (!el) { el = document.createElement('style'); el.id = 'fh-theme'; document.head.appendChild(el); }
  el.textContent = `:root{${KEYS.map((k) => `--fh-${k}:${v[k]}`).join(';')};color-scheme:${dark ? 'dark' : 'light'}}
html,body,#root{background:${v.bg}}
input,textarea,select{color:${v.text};background:${v.card}}
input::placeholder,textarea::placeholder{color:${v.faint}}`;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = v.bg;
  listeners.forEach((f) => f());
}

export function setTheme(t: ThemeChoice) {
  try { localStorage.setItem(STORE, JSON.stringify(t)); } catch { /* no storage */ }
  applyTheme(t);
}
export function onThemeChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

// Apply at start-up (before the first paint) and follow the phone's dark mode when set to "system".
if (typeof window !== 'undefined') {
  applyTheme();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (getTheme().mode === 'system') applyTheme(); });
}
