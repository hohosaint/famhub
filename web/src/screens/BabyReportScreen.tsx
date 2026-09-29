import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api, BabyLog, BabyReportData, Macros } from '../api';
import { colors } from '../theme';
import { Button, Card, ErrorText, Gradient, Icon, Muted, Overline, Row, Segmented, s } from '../ui';
import { ScreenProps } from './shared';
import { effectiveTargets } from '../babyTargets';

// Infant reports: one day, a week, a month, or any dates ticked on a calendar.
// For each baby: feeds, milk, breastfeeding, pumping, solids, energy, protein, fat and carbs (totals,
// daily averages, share of energy, per kg), sleep, diapers, growth, daily targets, what was fed,
// feeding times, and a day-by-day table. Export as CSV or print (save as PDF) for the doctor.

const SG = 8 * 3600e3;
const DAY = 86400e3;
const sgDay = (t: number | string) => new Date(new Date(t).getTime() + SG).toISOString().slice(0, 10);
const todaySG = () => sgDay(Date.now());
const dayStart = (d: string) => new Date(`${d}T00:00:00+08:00`).getTime();
const addDays = (d: string, n: number) => sgDay(dayStart(d) + n * DAY + 12 * 3600e3);
const r1 = (n: number) => Math.round(n * 10) / 10;
const int = (n: number) => Math.round(n).toLocaleString('en-SG');
const hmin = (min: number) => `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;
const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', ...opts });
const MC = { kcal: '#C2410C', protein: '#7C3AED', fat: '#B45309', carbs: '#0E7490', milk: '#2563EB', food: '#EA580C' };

type Row = {
  day: string; feeds: number; bottles: number; ml: number; formulaMl: number; breastMilkMl: number; breastSessions: number; breastMin: number; pumpMl: number;
  meals: number; foodG: number; kcal: number; protein: number; fat: number; carbs: number; milkKcal: number; foodKcal: number;
  sleepMin: number; sleeps: number; wet: number; dirty: number; kg: number | null; any: boolean;
};

function macrosOf(l: BabyLog, breastMilk: Macros): Macros | null {
  if (l.kind === 'solids') return l.macros || null;
  if (l.kind !== 'bottle' || !l.ml) return null;
  const per = l.source === 'breastmilk' ? breastMilk : l.per100ml;
  if (!per) return null;
  const f = l.ml / 100;
  return { kcal: per.kcal * f, protein: per.protein * f, fat: per.fat * f, carbs: per.carbs * f };
}

function computeRows(logs: BabyLog[], days: string[], breastMilk: Macros): Row[] {
  const weights = logs.filter((l) => l.kind === 'weight' && l.kg).sort((a, b) => a.at.localeCompare(b.at));
  return days.map((day) => {
    const a = dayStart(day); const b = a + DAY;
    const r: Row = { day, feeds: 0, bottles: 0, ml: 0, formulaMl: 0, breastMilkMl: 0, breastSessions: 0, breastMin: 0, pumpMl: 0, meals: 0, foodG: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, milkKcal: 0, foodKcal: 0, sleepMin: 0, sleeps: 0, wet: 0, dirty: 0, kg: null, any: false };
    for (const l of logs) {
      const t = new Date(l.at).getTime();
      if (l.kind === 'sleep') {
        const end = l.endAt ? new Date(l.endAt).getTime() : Math.min(Date.now(), t + 12 * 3600e3);
        const overlap = Math.min(end, b) - Math.max(t, a);
        if (overlap > 0) { r.sleepMin += overlap / 60000; r.any = true; }
        if (t >= a && t < b) r.sleeps += 1;
        continue;
      }
      if (t < a || t >= b) continue;
      if (!['weight', 'height', 'head'].includes(l.kind)) r.any = true;
      const m = macrosOf(l, breastMilk);
      if (m) { r.kcal += m.kcal; r.protein += m.protein; r.fat += m.fat; r.carbs += m.carbs; if (l.kind === 'solids') r.foodKcal += m.kcal; else r.milkKcal += m.kcal; }
      if (l.kind === 'bottle') { r.feeds += 1; r.bottles += 1; r.ml += l.ml || 0; if (l.source === 'breastmilk') r.breastMilkMl += l.ml || 0; else r.formulaMl += l.ml || 0; }
      if (l.kind === 'breast') { r.feeds += 1; r.breastSessions += 1; r.breastMin += l.minutes || 0; }
      if (l.kind === 'pump') r.pumpMl += l.ml || 0;
      if (l.kind === 'solids') { r.meals += 1; r.foodG += l.grams || 0; }
      if (l.kind === 'diaper') { if (l.diaper !== 'dirty') r.wet += 1; if (l.diaper !== 'wet') r.dirty += 1; }
    }
    const w = weights.filter((x) => new Date(x.at).getTime() < b).pop();
    r.kg = w ? w.kg || null : null;
    return r;
  });
}

type Summary = ReturnType<typeof summarise>;
function summarise(rows: Row[], logs: BabyLog[], range: { from: string; to: string }, targets: BabyReportData['babies'][number]['targets']) {
  const n = rows.length || 1;
  const withData = rows.filter((r) => r.any);
  const d = withData.length || 1;
  const sum = (k: keyof Row) => rows.reduce((a, r) => a + ((r[k] as number) || 0), 0);
  const kcal = sum('kcal'); const protein = sum('protein'); const fat = sum('fat'); const carbs = sum('carbs');
  const energyFrom = kcal > 0 ? { protein: (protein * 4) / (protein * 4 + fat * 9 + carbs * 4), fat: (fat * 9) / (protein * 4 + fat * 9 + carbs * 4), carbs: (carbs * 4) / (protein * 4 + fat * 9 + carbs * 4) } : null;
  const perKg = withData.filter((r) => r.kg);
  const kcalPerKg = perKg.length ? perKg.reduce((a, r) => a + r.kcal / (r.kg as number), 0) / perKg.length : null;
  const mlPerKg = perKg.length ? perKg.reduce((a, r) => a + r.ml / (r.kg as number), 0) / perKg.length : null;
  const weights = logs.filter((l) => l.kind === 'weight' && l.kg).sort((a, b) => a.at.localeCompare(b.at));
  const inRange = weights.filter((w) => sgDay(w.at) >= range.from && sgDay(w.at) <= range.to);
  const before = weights.filter((w) => sgDay(w.at) < range.from).pop();
  const wStart = before || inRange[0]; const wEnd = inRange[inRange.length - 1] || before;
  const wDays = wStart && wEnd ? Math.max(1, (new Date(wEnd.at).getTime() - new Date(wStart.at).getTime()) / DAY) : 0;
  const gain = wStart && wEnd && wStart !== wEnd ? Math.round(((wEnd.kg || 0) - (wStart.kg || 0)) * 1000) : null;
  const latest = (k: string) => logs.filter((l) => l.kind === k).sort((a, b) => b.at.localeCompare(a.at))[0];
  const t = targets || null;
  const met = (k: 'kcal' | 'protein' | 'fat' | 'carbs' | 'ml') => {
    const target = t ? t[k] : null;
    if (!target) return null;
    const days = withData.map((r) => r[k] as number);
    return { target, reached: days.filter((v) => v >= target).length, of: withData.length, avgPct: days.length ? Math.round((days.reduce((a, v) => a + v, 0) / days.length / target) * 100) : 0 };
  };
  return {
    days: rows.length, daysWithData: withData.length, n, d,
    feeds: sum('feeds'), bottles: sum('bottles'), ml: sum('ml'), formulaMl: sum('formulaMl'), breastMilkMl: sum('breastMilkMl'), breastSessions: sum('breastSessions'), breastMin: sum('breastMin'), pumpMl: sum('pumpMl'),
    meals: sum('meals'), foodG: sum('foodG'), kcal, protein, fat, carbs, milkKcal: sum('milkKcal'), foodKcal: sum('foodKcal'),
    sleepMin: sum('sleepMin'), sleeps: sum('sleeps'), wet: sum('wet'), dirty: sum('dirty'),
    energyFrom, kcalPerKg, mlPerKg,
    weight: wEnd ? { start: wStart?.kg || null, end: wEnd.kg || null, gain, perDay: gain !== null && wDays ? gain / wDays : null, startAt: wStart?.at, endAt: wEnd.at } : null,
    length: latest('height')?.cm || null, head: latest('head')?.cm || null,
    targets: t ? { kcal: met('kcal'), protein: met('protein'), fat: met('fat'), carbs: met('carbs'), ml: met('ml') } : null,
    avgFeedGapMin: (() => {
      const feeds = logs.filter((l) => (l.kind === 'bottle' || l.kind === 'breast') && sgDay(l.at) >= range.from && sgDay(l.at) <= range.to).map((l) => new Date(l.at).getTime()).sort((a, b) => a - b);
      const gaps = feeds.slice(1).map((x, i) => (x - feeds[i]) / 60000).filter((g) => g < 12 * 60);
      return gaps.length ? gaps.reduce((a, g) => a + g, 0) / gaps.length : null;
    })(),
  };
}

// ---------- charts ----------
function StackedBars({ labels, stacks, unit, height = 150 }: { labels: string[]; stacks: { name: string; color: string; values: number[] }[]; unit: string; height?: number }) {
  const W = 340; const H = height; const L = 30; const B = 18;
  const totals = labels.map((_, i) => stacks.reduce((a, st) => a + (st.values[i] || 0), 0));
  const max = Math.max(1, ...totals);
  const bw = (W - L - 4) / Math.max(1, labels.length);
  const every = labels.length > 14 ? Math.ceil(labels.length / 10) : 1;
  const aria = labels.map((l, i) => `${l}: ${stacks.map((st) => `${st.name} ${int(st.values[i] || 0)}`).join(', ')} ${unit}`).join('. ');
  return createElement('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': aria },
    createElement('text', { x: 2, y: 10, fontSize: 9, style: { fill: colors.faint } }, `${int(max)} ${unit}`),
    createElement('line', { x1: L, y1: 12, x2: W, y2: 12, strokeDasharray: '3 3', style: { stroke: colors.border } }),
    ...labels.flatMap((lab, i) => {
      let y = H - B;
      const parts = stacks.map((st, si) => {
        const h = ((st.values[i] || 0) / max) * (H - B - 14);
        y -= h;
        return createElement('rect', { key: `r${i}-${si}`, x: L + i * bw + 1, y, width: Math.max(1.5, bw - 2), height: Math.max(0, h), rx: 2, fill: st.color });
      });
      return [...parts, i % every === 0 ? createElement('text', { key: `t${i}`, x: L + i * bw + bw / 2, y: H - 4, textAnchor: 'middle', fontSize: 9, style: { fill: colors.muted } }, lab) : null];
    }));
}

function HourBars({ counts }: { counts: number[] }) {
  const W = 340; const H = 90; const max = Math.max(1, ...counts); const bw = (W - 4) / 24;
  return createElement('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': `Feeds by hour: ${counts.map((c, h) => `${h}:00 ${c}`).join(', ')}` },
    ...counts.flatMap((c, h) => {
      const bh = (c / max) * (H - 22);
      return [createElement('rect', { key: `b${h}`, x: 2 + h * bw + 1, y: H - 16 - bh, width: bw - 2, height: Math.max(1, bh), rx: 2, fill: MC.milk, opacity: 0.35 + 0.65 * (c / max) }),
        h % 3 === 0 ? createElement('text', { key: `l${h}`, x: 2 + h * bw + bw / 2, y: H - 4, textAnchor: 'middle', fontSize: 9, style: { fill: colors.muted } }, `${h}`) : null];
    }));
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return <Row style={{ gap: 12 }}>{items.map((i) => <Row key={i.name} style={{ gap: 5 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.color }} /><Text style={{ fontSize: 12, color: colors.muted }}>{i.name}</Text></Row>)}</Row>;
}

// ---------- the date picker with tick boxes ----------
function DateTicks({ picked, setPicked, marks }: { picked: string[]; setPicked: (d: string[]) => void; marks: Set<string> }) {
  const [month, setMonth] = useState((picked[0] || todaySG()).slice(0, 7));
  const first = `${month}-01`;
  const startDow = (new Date(`${first}T12:00:00+08:00`).getUTCDay() + 6) % 7; // Monday first
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells: (string | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const set = new Set(picked);
  const toggle = (d: string) => setPicked(set.has(d) ? picked.filter((x) => x !== d) : [...picked, d].sort());
  const monthDays = cells.filter(Boolean) as string[];
  const shift = (n: number) => { const d = new Date(`${first}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 7)); };
  const today = todaySG();
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={{ padding: 6 }}><Icon name="chevron-back" size={20} color={colors.primary} /></Pressable>
        <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>{fmtDay(first, { month: 'long', year: 'numeric' })}</Text>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" style={{ padding: 6 }}><Icon name="chevron-forward" size={20} color={colors.primary} /></Pressable>
      </Row>
      <View style={{ flexDirection: 'row' }}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: colors.muted }}>{w}</Text>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 48 }} />;
          const on = set.has(d); const future = d > today;
          return (
            <Pressable key={d} disabled={future} onPress={() => toggle(d)} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: future }} aria-checked={on} accessibilityLabel={fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}
              style={{ width: `${100 / 7}%`, height: 48, padding: 2 }}>
              <View style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: on ? colors.primary : 'transparent', borderWidth: 1.5, borderColor: on ? colors.primary : d === today ? colors.primary : colors.border, opacity: future ? 0.3 : 1 }}>
                <Icon name={on ? 'checkbox' : 'square-outline'} size={13} color={on ? '#fff' : colors.faint} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: on ? '#fff' : colors.text }}>{Number(d.slice(8))}</Text>
              </View>
              {marks.has(d) && <View style={{ position: 'absolute', top: 5, right: 7, width: 5, height: 5, borderRadius: 3, backgroundColor: on ? '#fff' : colors.accent }} />}
            </Pressable>
          );
        })}
      </View>
      <Row>
        <Button small kind="secondary" icon="checkbox-outline" label="Tick this month" onPress={() => setPicked([...new Set([...picked, ...monthDays.filter((d) => d <= today)])].sort())} />
        <Button small kind="ghost" icon="close" label="Clear" onPress={() => setPicked([])} />
        <Muted>{picked.length} day{picked.length === 1 ? '' : 's'} ticked · dots show days with entries</Muted>
      </Row>
    </View>
  );
}

// ---------- the screen ----------
type Period = 'day' | 'week' | 'month' | 'pick';

export default function BabyReportScreen({ data, cid, go }: ScreenProps) {
  const babies = data.baby?.babies || [];
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(todaySG());
  const [picked, setPicked] = useState<string[]>(() => Array.from({ length: 7 }, (_, i) => addDays(todaySG(), -6 + i)));
  const [who, setWho] = useState<string>(babies.length > 1 ? 'all' : babies[0]?.id || 'all');
  const [report, setReport] = useState<BabyReportData | null>(null);
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const days = useMemo(() => {
    if (period === 'day') return [anchor];
    if (period === 'week') { const dow = (new Date(`${anchor}T12:00:00+08:00`).getUTCDay() + 6) % 7; const mon = addDays(anchor, -dow); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }
    if (period === 'month') { const m = anchor.slice(0, 7); const n = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(); return Array.from({ length: n }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`); }
    return [...picked].sort();
  }, [period, anchor, picked]);
  const shown = days.filter((d) => d <= todaySG());
  const from = shown[0]; const to = shown[shown.length - 1];

  useEffect(() => {
    if (!from || !to) { setReport(null); return; }
    setLoading(true); setError(null);
    api.babyReport(cid, from, to).then((r) => { setReport(r); setLoading(false); }).catch((e) => { setError(e.message); setLoading(false); });
  }, [cid, from, to, data]); // eslint-disable-line react-hooks/exhaustive-deps
  // Dots on the date picker: days with entries in the last 13 months.
  useEffect(() => {
    if (period !== 'pick' || marks.size) return;
    api.babyReport(cid, addDays(todaySG(), -395), todaySG()).then((r) => setMarks(new Set(r.logs.filter((l) => !['weight', 'height', 'head'].includes(l.kind)).map((l) => sgDay(l.at))))).catch(() => undefined);
  }, [period, cid, marks.size]);

  const selected = report ? report.babies.filter((b) => who === 'all' || b.id === who) : [];
  const per = useMemo(() => (report ? selected.map((b) => {
    const logs = report.logs.filter((l) => l.babyId === b.id);
    const rows = computeRows(logs, shown, report.breastMilk);
    const inRange = logs.filter((l) => sgDay(l.at) >= (from || '') && sgDay(l.at) <= (to || '') && shown.includes(sgDay(l.at)));
    const et = effectiveTargets(b, logs, new Date(`${to}T23:59:00+08:00`));
    const sum = summarise(rows, logs, { from: from || '', to: to || '' }, et.targets);
    const milks = new Map<string, { ml: number; kcal: number; n: number }>();
    const foods = new Map<string, { g: number; kcal: number; n: number; p: number; f: number; c: number }>();
    const hours = Array(24).fill(0);
    for (const l of inRange) {
      const m = macrosOf(l, report.breastMilk);
      if (l.kind === 'bottle') { const k = l.source === 'breastmilk' ? 'Expressed breast milk' : l.formula || 'Formula'; const x = milks.get(k) || { ml: 0, kcal: 0, n: 0 }; x.ml += l.ml || 0; x.kcal += m ? m.kcal : 0; x.n += 1; milks.set(k, x); }
      if (l.kind === 'solids') { const k = l.food || 'Food'; const x = foods.get(k) || { g: 0, kcal: 0, n: 0, p: 0, f: 0, c: 0 }; x.g += l.grams || 0; x.kcal += m ? m.kcal : 0; x.p += m ? m.protein : 0; x.f += m ? m.fat : 0; x.c += m ? m.carbs : 0; x.n += 1; foods.set(k, x); }
      if (l.kind === 'bottle' || l.kind === 'breast') hours[Number(new Date(new Date(l.at).getTime() + SG).toISOString().slice(11, 13))] += 1;
    }
    return { b, rows, sum, milks: [...milks.entries()].sort((a, z) => z[1].ml - a[1].ml), foods: [...foods.entries()].sort((a, z) => z[1].kcal - a[1].kcal), hours };
  }) : []), [report, who, shown.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = period === 'day' ? fmtDay(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : period === 'week' ? `${fmtDay(days[0], { day: 'numeric', month: 'short' })} to ${fmtDay(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
    : period === 'month' ? fmtDay(`${anchor.slice(0, 7)}-15`, { month: 'long', year: 'numeric' })
    : `${picked.length} chosen day${picked.length === 1 ? '' : 's'}`;
  const step = (n: number) => setAnchor(period === 'day' ? addDays(anchor, n) : period === 'week' ? addDays(anchor, 7 * n) : (() => { const d = new Date(`${anchor.slice(0, 7)}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); })());
  const canNext = days[days.length - 1] < todaySG();

  const exportCsv = () => {
    const head = ['Baby', 'Date', 'Feeds', 'Bottles', 'Milk ml', 'Formula ml', 'Breast milk ml', 'Breastfeeds', 'Breastfeed min', 'Pumped ml', 'Solid items', 'Food g', 'Energy kcal', 'Milk kcal', 'Food kcal', 'Protein g', 'Fat g', 'Carbs g', 'Sleep min', 'Sleeps', 'Wet diapers', 'Dirty diapers', 'Weight kg'];
    const lines = [head.join(',')];
    for (const p of per) for (const r of p.rows) lines.push([p.b.name, r.day, r.feeds, r.bottles, r.ml, r.formulaMl, r.breastMilkMl, r.breastSessions, r.breastMin, r.pumpMl, r.meals, r1(r.foodG), r1(r.kcal), r1(r.milkKcal), r1(r.foodKcal), r1(r.protein), r1(r.fat), r1(r.carbs), Math.round(r.sleepMin), r.sleeps, r.wet, r.dirty, r.kg ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `famhub-baby-report-${from}-to-${to}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };

  const stat = (k: string, v: string, sub?: string, color: string = colors.text) => (
    <View key={k} style={{ flexGrow: 1, minWidth: 100, padding: 10, borderRadius: 14, backgroundColor: colors.surfaceAlt, gap: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{k}</Text>
      <Text style={{ fontSize: 19, fontWeight: '900', color }}>{v}</Text>
      {!!sub && <Text style={{ fontSize: 11, color: colors.muted }}>{sub}</Text>}
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={() => go('care')} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="chevron-back" size={20} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Routine</Text></Pressable>
      <Gradient colors="linear-gradient(135deg, #FF8A5B 0%, #F45B8D 50%, #7C5CFF 100%)" fallback="#F45B8D" style={{ borderRadius: 24, padding: 18, gap: 6 }}>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Reports</Text>
        <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{data.circle.parentName}</Text>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{label}</Text>
      </Gradient>

      <Card style={{ gap: 10 }}>
        <Segmented value={period} onChange={(v) => setPeriod(v as Period)} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'pick', label: 'Pick dates' }]} />
        {period !== 'pick' ? (
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={`Previous ${period}`} style={{ padding: 8 }}><Icon name="chevron-back" size={22} color={colors.primary} /></Pressable>
            <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15, textAlign: 'center', flex: 1 }}>{label}</Text>
            <Pressable disabled={!canNext} onPress={() => step(1)} accessibilityRole="button" accessibilityLabel={`Next ${period}`} style={{ padding: 8, opacity: canNext ? 1 : 0.3 }}><Icon name="chevron-forward" size={22} color={colors.primary} /></Pressable>
            {anchor !== todaySG() && <Button small kind="ghost" label="Today" onPress={() => setAnchor(todaySG())} />}
          </Row>
        ) : <DateTicks picked={picked} setPicked={setPicked} marks={marks} />}
        {babies.length > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[{ id: 'all', name: `All ${babies.length}`, color: colors.accent }, ...babies].map((b) => {
              const on = who === b.id;
              return <Pressable key={b.id} onPress={() => setWho(b.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={b.id === 'all' ? 'All babies' : b.name}
                style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: on ? b.color : colors.border, backgroundColor: on ? b.color : colors.card }}>
                <Text style={{ fontWeight: '800', color: on ? '#fff' : colors.text }}>{b.name}</Text>
              </Pressable>;
            })}
          </View>
        )}
        <Row>
          <Button small kind="secondary" icon="download-outline" label="Download CSV (Excel)" disabled={!per.length} onPress={exportCsv} />
          <Button small kind="secondary" icon="print-outline" label="Print or save as PDF" disabled={!per.length} onPress={() => Platform.OS === 'web' && window.print()} />
        </Row>
      </Card>

      <ErrorText message={error} />
      {loading && <Muted>Loading the report…</Muted>}
      {!shown.length && <Card><Muted>Tick at least one date (today or earlier) to see a report.</Muted></Card>}

      {per.map(({ b, rows, sum, milks, foods, hours }) => (
        <View key={b.id} style={{ gap: 14 }}>
          {per.length > 1 && <Row style={{ gap: 8 }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: b.color }} /><Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{b.name}</Text></Row>}

          <Card style={{ gap: 10 }}>
            <Overline>Summary · {sum.days} day{sum.days === 1 ? '' : 's'}{sum.daysWithData < sum.days ? ` (${sum.daysWithData} with entries)` : ''}</Overline>
            {!sum.daysWithData && <Muted>No entries on these days.</Muted>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {stat('Energy', `${int(sum.kcal)} kcal`, `${int(sum.kcal / sum.d)} a day${sum.kcalPerKg ? ` · ${int(sum.kcalPerKg)} per kg` : ''}`, MC.kcal)}
              {stat('Protein', `${r1(sum.protein)} g`, `${r1(sum.protein / sum.d)} g a day`, MC.protein)}
              {stat('Fat', `${r1(sum.fat)} g`, `${r1(sum.fat / sum.d)} g a day`, MC.fat)}
              {stat('Carbs', `${r1(sum.carbs)} g`, `${r1(sum.carbs / sum.d)} g a day`, MC.carbs)}
            </View>
            {sum.energyFrom && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Where the energy came from</Text>
                <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' }} accessibilityLabel={`Energy from protein ${Math.round(sum.energyFrom.protein * 100)}%, fat ${Math.round(sum.energyFrom.fat * 100)}%, carbs ${Math.round(sum.energyFrom.carbs * 100)}%`}>
                  <View style={{ flex: sum.energyFrom.protein, backgroundColor: MC.protein }} /><View style={{ flex: sum.energyFrom.fat, backgroundColor: MC.fat }} /><View style={{ flex: sum.energyFrom.carbs, backgroundColor: MC.carbs }} />
                </View>
                <Legend items={[{ name: `Protein ${Math.round(sum.energyFrom.protein * 100)}%`, color: MC.protein }, { name: `Fat ${Math.round(sum.energyFrom.fat * 100)}%`, color: MC.fat }, { name: `Carbs ${Math.round(sum.energyFrom.carbs * 100)}%`, color: MC.carbs }]} />
                {sum.foodKcal > 0 && <Muted>Milk {Math.round((sum.milkKcal / sum.kcal) * 100)}% and food {Math.round((sum.foodKcal / sum.kcal) * 100)}% of the energy.</Muted>}
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {stat('Feeds', `${sum.feeds}`, `${r1(sum.feeds / sum.d)} a day${sum.avgFeedGapMin ? ` · every ${hmin(sum.avgFeedGapMin)}` : ''}`)}
              {stat('Milk (bottles)', `${int(sum.ml)} ml`, `${int(sum.ml / sum.d)} ml a day${sum.mlPerKg ? ` · ${int(sum.mlPerKg)} ml/kg` : ''}`, MC.milk)}
              {sum.breastMilkMl > 0 && stat('Breast milk', `${int(sum.breastMilkMl)} ml`, `formula ${int(sum.formulaMl)} ml`)}
              {sum.breastSessions > 0 && stat('Breastfeeds', `${sum.breastSessions}`, `${int(sum.breastMin)} min in total`)}
              {sum.pumpMl > 0 && stat('Pumped', `${int(sum.pumpMl)} ml`, `${int(sum.pumpMl / sum.d)} ml a day`)}
              {sum.meals > 0 && stat('Solids', `${int(sum.foodG)} g`, `${sum.meals} items · ${int(sum.foodKcal)} kcal`, MC.food)}
              {stat('Sleep', hmin(sum.sleepMin / sum.d), `a day on average · ${sum.sleeps} sleeps`, '#4338CA')}
              {stat('Diapers', `${r1(sum.wet / sum.d)} wet · ${r1(sum.dirty / sum.d)} dirty`, 'a day on average', '#0F8A45')}
            </View>
            {sum.weight && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {stat('Weight', `${sum.weight.end} kg`, sum.weight.endAt ? `on ${fmtDay(sgDay(sum.weight.endAt))}` : '', '#0C7C80')}
                {sum.weight.gain !== null && stat('Weight change', `${sum.weight.gain >= 0 ? '+' : ''}${int(sum.weight.gain)} g`, sum.weight.perDay !== null ? `about ${int(sum.weight.perDay)} g a day (${int(sum.weight.perDay * 7)} g a week)` : '', '#0C7C80')}
                {!!sum.length && stat('Length', `${sum.length} cm`, 'latest')}
                {!!sum.head && stat('Head', `${sum.head} cm`, 'latest')}
              </View>
            )}
          </Card>

          {sum.daysWithData > 0 && sum.targets && Object.values(sum.targets).some(Boolean) && (
            <Card style={{ gap: 8 }}>
              <Overline>Daily targets{b.targetsMode === 'auto' ? ' (automatic, from weight, length, sex and age)' : ''}</Overline>
              {(['ml', 'kcal', 'protein', 'fat', 'carbs'] as const).map((k) => {
                const t = sum.targets![k];
                if (!t) return null;
                const name = { ml: 'Milk', kcal: 'Energy', protein: 'Protein', fat: 'Fat', carbs: 'Carbs' }[k];
                const unit = k === 'ml' ? 'ml' : k === 'kcal' ? 'kcal' : 'g';
                return (
                  <View key={k} style={{ gap: 4 }}>
                    <Row style={{ justifyContent: 'space-between' }}><Text style={{ fontWeight: '700', color: colors.text }}>{name} ({t.target} {unit} a day)</Text><Text style={{ fontWeight: '800', color: t.reached === t.of ? colors.ok : colors.text }}>Reached on {t.reached} of {t.of} days</Text></Row>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt2, overflow: 'hidden' }}><View style={{ width: `${Math.min(100, t.avgPct)}%`, height: 8, backgroundColor: k === 'ml' ? MC.milk : (MC as any)[k] }} /></View>
                    <Muted>On average {t.avgPct}% of the target.</Muted>
                  </View>
                );
              })}
            </Card>
          )}

          {rows.length > 1 && sum.daysWithData > 0 && (
            <Card style={{ gap: 8 }}>
              <Overline>Energy per day (kcal)</Overline>
              <StackedBars labels={rows.map((r) => (rows.length > 10 ? String(Number(r.day.slice(8))) : fmtDay(r.day, { weekday: 'short' })))} unit="kcal"
                stacks={[{ name: 'Milk', color: MC.milk, values: rows.map((r) => r.milkKcal) }, { name: 'Food', color: MC.food, values: rows.map((r) => r.foodKcal) }]} />
              <Legend items={[{ name: 'Milk', color: MC.milk }, { name: 'Food', color: MC.food }]} />
              <Overline>Protein, fat and carbs per day (g)</Overline>
              <StackedBars labels={rows.map((r) => (rows.length > 10 ? String(Number(r.day.slice(8))) : fmtDay(r.day, { weekday: 'short' })))} unit="g"
                stacks={[{ name: 'Protein', color: MC.protein, values: rows.map((r) => r.protein) }, { name: 'Fat', color: MC.fat, values: rows.map((r) => r.fat) }, { name: 'Carbs', color: MC.carbs, values: rows.map((r) => r.carbs) }]} />
              <Legend items={[{ name: 'Protein', color: MC.protein }, { name: 'Fat', color: MC.fat }, { name: 'Carbs', color: MC.carbs }]} />
              <Overline>Milk per day (ml)</Overline>
              <StackedBars height={120} labels={rows.map((r) => (rows.length > 10 ? String(Number(r.day.slice(8))) : fmtDay(r.day, { weekday: 'short' })))} unit="ml"
                stacks={[{ name: 'Formula', color: MC.milk, values: rows.map((r) => r.formulaMl) }, { name: 'Breast milk', color: '#DB2777', values: rows.map((r) => r.breastMilkMl) }]} />
              <Legend items={[{ name: 'Formula', color: MC.milk }, { name: 'Breast milk', color: '#DB2777' }]} />
            </Card>
          )}

          {sum.feeds > 0 && <Card style={{ gap: 8 }}>
            <Overline>When feeds happened (by hour)</Overline>
            <HourBars counts={hours} />
            <Muted>Taller, darker bars are the busiest feeding hours (0 = midnight, 12 = noon).</Muted>
          </Card>}

          {(milks.length > 0 || foods.length > 0) && (
            <Card style={{ gap: 6 }}>
              <Overline>What was fed</Overline>
              {milks.map(([name, x]) => (
                <Row key={name} style={{ justifyContent: 'space-between', flexWrap: 'nowrap', paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ flex: 1, fontWeight: '700', color: colors.text }}>{name}</Text>
                  <Text style={{ color: colors.muted }}>{x.n} bottles · {int(x.ml)} ml · {int(x.kcal)} kcal</Text>
                </Row>
              ))}
              {foods.map(([name, x]) => (
                <View key={name} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><Text style={{ flex: 1, fontWeight: '700', color: colors.text }}>{name}</Text><Text style={{ color: colors.muted }}>{x.n}× · {int(x.g)} g · {int(x.kcal)} kcal</Text></Row>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Protein {r1(x.p)} g · fat {r1(x.f)} g · carbs {r1(x.c)} g</Text>
                </View>
              ))}
            </Card>
          )}

          {sum.daysWithData > 0 && <Card style={{ gap: 6 }}>
            <Overline>Day by day</Overline>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: colors.borderStrong }}>
                  {([['Date', 96], ['Feeds', 52], ['Milk ml', 64], ['Food g', 58], ['kcal', 58], ['Protein g', 66], ['Fat g', 54], ['Carbs g', 60], ['Sleep', 84], ['Wet', 40], ['Dirty', 44], ['kg', 44]] as [string, number][]).map(([h, w]) => <Text key={h} style={{ width: w, paddingVertical: 6, paddingHorizontal: 4, fontSize: 12, fontWeight: '900', color: colors.muted, textAlign: h === 'Date' ? 'left' : 'right' }}>{h}</Text>)}
                </View>
                {rows.map((r, i) => (
                  <View key={r.day} style={{ flexDirection: 'row', backgroundColor: i % 2 ? colors.surfaceAlt : 'transparent', opacity: r.any ? 1 : 0.5 }}>
                    {([[fmtDay(r.day), 96], [r.feeds, 52], [int(r.ml), 64], [int(r.foodG), 58], [int(r.kcal), 58], [r1(r.protein), 66], [r1(r.fat), 54], [r1(r.carbs), 60], [r.sleepMin ? hmin(r.sleepMin) : '-', 84], [r.wet, 40], [r.dirty, 44], [r.kg ?? '-', 44]] as [string | number, number][]).map(([v, w], j) => (
                      <Text key={j} style={{ width: w, paddingVertical: 6, paddingHorizontal: 4, fontSize: 13, color: colors.text, fontWeight: j === 0 ? '700' : '400', textAlign: j === 0 ? 'left' : 'right' }}>{String(v)}</Text>
                    ))}
                  </View>
                ))}
                {rows.length > 1 && (
                  <View style={{ flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
                    {([['Average', 96], [r1(sum.feeds / sum.d), 52], [int(sum.ml / sum.d), 64], [int(sum.foodG / sum.d), 58], [int(sum.kcal / sum.d), 58], [r1(sum.protein / sum.d), 66], [r1(sum.fat / sum.d), 54], [r1(sum.carbs / sum.d), 60], [hmin(sum.sleepMin / sum.d), 84], [r1(sum.wet / sum.d), 40], [r1(sum.dirty / sum.d), 44], ['', 44]] as [string | number, number][]).map(([v, w], j) => (
                      <Text key={j} style={{ width: w, paddingVertical: 6, paddingHorizontal: 4, fontSize: 13, color: colors.text, fontWeight: '900', textAlign: j === 0 ? 'left' : 'right' }}>{String(v)}</Text>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
            <Muted>Averages count only days with entries. Scroll sideways to see every column.</Muted>
          </Card>}
        </View>
      ))}

      {per.length > 0 && <Muted>Energy and nutrients come from the milk's values per 100 ml and each food's values per 100 g (typical values unless the family entered their own). Famhub does not give feeding advice; share this report with your doctor, nurse or dietitian.</Muted>}
    </View>
  );
}
