import { createElement, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, Baby, BabyData, BabyLog, fmtTime, FoodItem, Formula, Macros } from '../api';
import DatePicker from '../DatePicker';
import { colors, personColor } from '../theme';
import { TimeField } from '../TimeWheel';
import { Badge, Button, Card, Choice, Empty, ErrorText, Field, Gradient, Icon, IconName, Muted, Overline, Row, Sheet, s } from '../ui';
import { nameOf, run, ScreenProps } from './shared';
import { effectiveTargets } from '../babyTargets';
import { allFoods, FoodLibrarySheet, MacroRow, MealBuilder, MealLine, TargetBar, TargetsEditor } from './BabyFood';

// Baby log for one baby, twins or triplets: feeds (bottle, breast, pumped, solids), sleep, diapers and growth,
// shared by everyone caring for them. Each baby has its own formula; nutrients come from the formula's values
// per 100 ml (typical values until the family enters the tin's).

const SG = 8 * 3600e3;
const sgDay = (iso: string) => new Date(new Date(iso).getTime() + SG).toISOString().slice(0, 10);
const todaySG = () => new Date(Date.now() + SG).toISOString().slice(0, 10);
const hm = (ms: number) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const r1 = (n: number) => Math.round(n * 10) / 10;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });

export function ageText(birth?: string) {
  if (!birth) return '';
  const days = Math.floor((Date.now() - new Date(`${birth}T00:00:00+08:00`).getTime()) / 86400e3);
  if (days < 0) return '';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`;
  if (days < 7 * 13) return `${Math.floor(days / 7)} weeks ${days % 7} days`;
  const months = Math.floor(days / 30.44);
  return months < 24 ? `${months} months` : `${Math.floor(months / 12)} years ${months % 12} months`;
}
export const multipleWord = (n: number) => (n === 2 ? 'Twins' : n === 3 ? 'Triplets' : n === 4 ? 'Quadruplets' : 'Baby');

const KIND: Record<string, { icon: IconName; color: string; label: string }> = {
  bottle: { icon: 'water', color: '#2563EB', label: 'Bottle' },
  breast: { icon: 'heart', color: '#DB2777', label: 'Breastfeed' },
  pump: { icon: 'flask', color: '#7C3AED', label: 'Pumped' },
  solids: { icon: 'restaurant', color: '#C2410C', label: 'Solids' },
  sleep: { icon: 'moon', color: '#4338CA', label: 'Sleep' },
  diaper: { icon: 'sparkles', color: '#0F8A45', label: 'Diaper' },
  weight: { icon: 'scale', color: '#0C7C80', label: 'Weight' },
  height: { icon: 'resize', color: '#0C7C80', label: 'Length' },
  head: { icon: 'ellipse-outline', color: '#0C7C80', label: 'Head' },
};

function macrosOf(l: BabyLog, breastMilk: Macros): Macros | null {
  if (l.kind === 'solids') return l.macros || null;
  if (l.kind !== 'bottle' || !l.ml) return null;
  const per = l.source === 'breastmilk' ? breastMilk : l.per100ml;
  if (!per) return null;
  const f = l.ml / 100;
  return { kcal: per.kcal * f, protein: per.protein * f, fat: per.fat * f, carbs: per.carbs * f };
}

function describe(l: BabyLog) {
  switch (l.kind) {
    case 'bottle': return `${l.ml} ml ${l.source === 'breastmilk' ? 'breast milk' : l.formula || 'formula'}`;
    case 'breast': return `${l.minutes} min, ${l.side === 'both' ? 'both sides' : `${l.side} side`}`;
    case 'pump': return `${l.ml} ml pumped`;
    case 'solids': return `${l.food}${l.grams ? ` ${l.grams} g` : ''}${l.amount ? `, ${l.amount}` : ''}`;
    case 'sleep': return l.endAt ? `${fmtTime(l.at)} to ${fmtTime(l.endAt)} (${hm(new Date(l.endAt).getTime() - new Date(l.at).getTime())})` : `Asleep since ${fmtTime(l.at)}`;
    case 'diaper': return l.diaper === 'both' ? 'Wet and dirty' : l.diaper === 'dirty' ? 'Dirty' : 'Wet';
    case 'weight': return `${l.kg} kg`;
    default: return `${l.cm} cm`;
  }
}

type DayTotals = { feeds: number; ml: number; kcal: number; protein: number; fat: number; carbs: number; breastMin: number; sleepMs: number; wet: number; dirty: number; foodG: number; foodKcal: number; meals: number };
function totalsOf(logs: BabyLog[], breastMilk: Macros): DayTotals {
  const t = { feeds: 0, ml: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, breastMin: 0, sleepMs: 0, wet: 0, dirty: 0, foodG: 0, foodKcal: 0, meals: 0 };
  for (const l of logs) {
    if (l.kind === 'bottle' || l.kind === 'breast') t.feeds += 1;
    if (l.kind === 'bottle') { t.ml += l.ml || 0; const m = macrosOf(l, breastMilk); if (m) { t.kcal += m.kcal; t.protein += m.protein; t.fat += m.fat; t.carbs += m.carbs; } }
    if (l.kind === 'solids') { t.meals += 1; t.foodG += l.grams || 0; const m = l.macros; if (m) { t.kcal += m.kcal; t.protein += m.protein; t.fat += m.fat; t.carbs += m.carbs; t.foodKcal += m.kcal; } }
    if (l.kind === 'breast') t.breastMin += l.minutes || 0;
    if (l.kind === 'sleep') t.sleepMs += (l.endAt ? new Date(l.endAt).getTime() : Date.now()) - new Date(l.at).getTime();
    if (l.kind === 'diaper') { if (l.diaper !== 'dirty') t.wet += 1; if (l.diaper !== 'wet') t.dirty += 1; }
  }
  return t;
}

// ---------- charts (web SVG) ----------
type Series = { name: string; color: string; points: { t: number; y: number }[] };
function LineChart({ series, unit, height = 140 }: { series: Series[]; unit: string; height?: number }) {
  const all = series.flatMap((x) => x.points);
  if (all.length < 2) return <Muted>Add at least two entries to see the chart.</Muted>;
  const W = 320; const H = height; const pad = 26;
  const ts = all.map((p) => p.t); const t0 = Math.min(...ts); const t1 = Math.max(...ts); const tspan = t1 - t0 || 1;
  const ys = all.map((p) => p.y); const min = Math.min(...ys); const max = Math.max(...ys); const span = max - min || 1;
  const X = (t: number) => pad + ((t - t0) / tspan) * (W - pad * 2);
  const Y = (y: number) => H - pad - ((y - min) / span) * (H - pad * 2 - 8);
  const label = series.map((x) => `${x.name}: ${x.points.map((p) => `${p.y}${unit}`).join(', ')}`).join('. ');
  return createElement('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': `Chart. ${label}` },
    ...series.flatMap((x, si) => {
      const pts = [...x.points].sort((a, b) => a.t - b.t);
      if (!pts.length) return [];
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
      const last = pts[pts.length - 1];
      return [
        series.length === 1 ? createElement('path', { key: `a${si}`, d: `${d} L${X(last.t)},${H - pad} L${X(pts[0].t)},${H - pad} Z`, fill: x.color, opacity: 0.12 }) : null,
        createElement('path', { key: `l${si}`, d, fill: 'none', stroke: x.color, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }),
        ...pts.map((p, i) => createElement('circle', { key: `c${si}-${i}`, cx: X(p.t), cy: Y(p.y), r: 3.5, style: { fill: colors.card }, stroke: x.color, strokeWidth: 2 })),
        createElement('text', { key: `t${si}`, x: X(last.t) - 4, y: Y(last.y) - 8 - (series.length > 1 ? 0 : 0), textAnchor: 'end', fontSize: 12, fontWeight: 700, fill: x.color }, `${series.length > 1 ? `${x.name} ` : ''}${last.y}${unit}`),
      ];
    }),
    createElement('text', { key: 'x0', x: pad, y: H - 6, fontSize: 10, style: { fill: colors.faint } }, shortDate(new Date(t0).toISOString())),
    createElement('text', { key: 'x1', x: W - pad, y: H - 6, textAnchor: 'end', fontSize: 10, style: { fill: colors.faint } }, shortDate(new Date(t1).toISOString())));
}

function BarChart({ labels, series }: { labels: string[]; series: { name: string; color: string; values: number[] }[] }) {
  const W = 320; const H = 120; const max = Math.max(1, ...series.flatMap((x) => x.values)); const gw = (W - 20) / labels.length; const bw = (gw - 8) / series.length;
  const aria = series.map((x) => `${x.name}: ${labels.map((l, i) => `${l} ${x.values[i]} ml`).join(', ')}`).join('. ');
  return createElement('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': `Milk per day. ${aria}` },
    ...labels.map((lab, i) => createElement('g', { key: i },
      ...series.map((x, si) => {
        const v = x.values[i]; const h = (v / max) * (H - 36);
        return createElement('g', { key: si },
          createElement('rect', { x: 10 + i * gw + 4 + si * bw, y: H - 18 - h, width: Math.max(2, bw - 2), height: Math.max(2, h), rx: 4, fill: x.color, opacity: i === labels.length - 1 ? 1 : 0.5 }),
          series.length === 1 && v > 0 ? createElement('text', { x: 10 + i * gw + gw / 2, y: H - 22 - h, textAnchor: 'middle', fontSize: 10, fontWeight: 700, style: { fill: colors.text } }, String(v)) : null);
      }),
      createElement('text', { x: 10 + i * gw + gw / 2, y: H - 4, textAnchor: 'middle', fontSize: 10, style: { fill: colors.muted } }, lab))));
}

// ---------- small parts ----------
function BabyDot({ baby, size = 10 }: { baby: Baby; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: baby.color }} />;
}

function Stepper({ value, onChange, step, unit, presets, label }: { value: number; onChange: (n: number) => void; step: number; unit: string; presets?: number[]; label?: string }) {
  const a = label ? `${label}, ` : '';
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ gap: 12, justifyContent: 'center', flexWrap: 'nowrap' }}>
        <Pressable onPress={() => onChange(Math.max(0, r1(value - step)))} accessibilityRole="button" accessibilityLabel={`${a}less ${unit}`} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="remove" size={22} color={colors.primary} /></Pressable>
        <TextInput value={String(value)} onChangeText={(t) => onChange(Number(t.replace(/[^\d.]/g, '')) || 0)} keyboardType="decimal-pad" accessibilityLabel={`${a}amount in ${unit}`}
          style={{ fontSize: 30, fontWeight: '900', color: colors.text, textAlign: 'center', width: 110, borderBottomWidth: 2, borderBottomColor: colors.primary }} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.muted }}>{unit}</Text>
        <Pressable onPress={() => onChange(r1(value + step))} accessibilityRole="button" accessibilityLabel={`${a}more ${unit}`} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="add" size={22} color={colors.primary} /></Pressable>
      </Row>
      {presets && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>{presets.map((p) => <Pressable key={p} onPress={() => onChange(p)} accessibilityRole="button" accessibilityLabel={`${a}${p} ${unit}`} style={[s.chip, value === p && s.chipOn]}><Text style={[s.chipText, value === p && s.chipTextOn]}>{p}</Text></Pressable>)}</View>}
    </View>
  );
}

// Tick which babies the entry is for (twins are often fed or changed together).
function BabyPicker({ babies, value, onChange }: { babies: Baby[]; value: string[]; onChange: (v: string[]) => void }) {
  if (babies.length < 2) return null;
  const all = value.length === babies.length;
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>For</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {babies.map((b) => {
          const on = value.includes(b.id);
          return (
            <Pressable key={b.id} onPress={() => onChange(on ? (value.length > 1 ? value.filter((x) => x !== b.id) : value) : [...value, b.id])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={b.name}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2, borderColor: on ? b.color : colors.border, backgroundColor: on ? `${b.color}14` : colors.card }}>
              <Icon name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? b.color : colors.faint} />
              <Text style={{ fontWeight: '800', color: on ? b.color : colors.muted }}>{b.name}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => onChange(all ? [babies[0].id] : babies.map((b) => b.id))} accessibilityRole="button" style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ fontWeight: '700', color: colors.primary }}>{all ? 'Only one' : `All ${babies.length}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const atFrom = (when: string) => { const iso = new Date(`${todaySG()}T${when}:00+08:00`); return (iso.getTime() > Date.now() + 60e3 ? new Date(iso.getTime() - 86400e3) : iso).toISOString(); };
const nowHM = () => new Date(Date.now() + SG).toISOString().slice(11, 16);

function MacroChips({ per, ml }: { per: Macros; ml: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {[['Energy', `${Math.round((per.kcal * ml) / 100)} kcal`], ['Protein', `${r1((per.protein * ml) / 100)} g`], ['Fat', `${r1((per.fat * ml) / 100)} g`], ['Carbs', `${r1((per.carbs * ml) / 100)} g`]].map(([a, b]) => (
        <View key={a} style={{ alignItems: 'center', backgroundColor: colors.infoSoft, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8 }}><Text style={{ fontSize: 11, color: colors.muted }}>{a}</Text><Text style={{ fontWeight: '800', color: colors.text, fontSize: 13 }}>{b}</Text></View>
      ))}
    </View>
  );
}

function LogSheet({ kind, props, baby: bd, forIds, close, openLibrary }: { kind: string; props: ScreenProps; baby: BabyData; forIds: string[]; close: () => void; openLibrary: (k: 'milk' | 'food') => void }) {
  const { cid, refresh } = props;
  const babies = bd.babies;
  const [ids, setIds] = useState<string[]>(forIds);
  const lastOf = (id: string, k: string) => bd.logs.find((l) => l.babyId === id && l.kind === k);
  const [amounts, setAmounts] = useState<Record<string, number>>(() => Object.fromEntries(babies.map((b) => [b.id, kind === 'weight' ? lastOf(b.id, 'weight')?.kg || 3.5 : kind === 'height' ? lastOf(b.id, 'height')?.cm || 50 : kind === 'head' ? lastOf(b.id, 'head')?.cm || 35 : lastOf(b.id, 'bottle')?.ml || 90])));
  const lastBottle = bd.logs.find((l) => l.kind === 'bottle');
  const [milk, setMilk] = useState<string>(lastBottle?.source === 'breastmilk' ? 'breastmilk' : lastBottle?.milkId || 'usual');
  const source = milk === 'breastmilk' ? 'breastmilk' : 'formula';
  const myMilks = (bd.myFoods || []).filter((f) => f.kind === 'milk');
  const [meal, setMeal] = useState<MealLine[]>([]);
  const [side, setSide] = useState('both');
  const [minutes, setMinutes] = useState(15);
  const [ml, setMl] = useState(90);
  const [food, setFood] = useState('');
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(nowHM());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const k = KIND[kind];
  const chosen = babies.filter((b) => ids.includes(b.id));
  const perBaby = kind === 'bottle' || kind === 'weight' || kind === 'height' || kind === 'head';
  const unit = kind === 'weight' ? 'kg' : kind === 'bottle' ? 'ml' : 'cm';
  const step = kind === 'weight' ? 0.05 : kind === 'bottle' ? 10 : 0.5;
  const save = async () => {
    const body: Record<string, unknown> = { kind, at: atFrom(when), note, babyIds: ids };
    if (kind === 'bottle') Object.assign(body, { source, ...(milk !== 'usual' && milk !== 'breastmilk' ? { milkId: milk } : {}), amounts: Object.fromEntries(ids.map((i) => [i, amounts[i]])) });
    else if (perBaby) body.values = Object.fromEntries(ids.map((i) => [i, amounts[i]]));
    else if (kind === 'breast') Object.assign(body, { side, minutes });
    else if (kind === 'pump') body.ml = ml;
    else if (kind === 'solids') { if (meal.length) body.foods = meal.map((l) => ({ foodId: l.foodId, grams: l.grams })); else Object.assign(body, { food, amount }); }
    if (await run(() => api.addBabyLog(cid, body), refresh, setError)) close();
  };
  return (
    <Sheet visible title={`Log ${k.label.toLowerCase()}`} onClose={close}>
      {kind !== 'pump' && <BabyPicker babies={babies} value={ids} onChange={setIds} />}
      {kind === 'bottle' && <>
        <Choice label="Milk" value={milk} onChange={setMilk} options={[{ value: 'usual', label: chosen.length === 1 && chosen[0].formula ? chosen[0].formula.name : 'Usual formula' }, { value: 'breastmilk', label: 'Breast milk' }, ...myMilks.filter((m) => !(chosen.length === 1 && chosen[0].formulaId === m.id)).map((m) => ({ value: m.id, label: m.name }))]} />
        <Pressable onPress={() => openLibrary('milk')} accessibilityRole="button"><Text style={s.link}>Add or edit a milk powder</Text></Pressable>
      </>}
      {perBaby && chosen.map((b) => {
        const per = milk === 'breastmilk' ? bd.breastMilk : milk === 'usual' ? b.formula?.per100ml : myMilks.find((m) => m.id === milk)?.per100;
        return (
          <View key={b.id} style={{ gap: 8, padding: chosen.length > 1 ? 12 : 0, borderRadius: 16, borderWidth: chosen.length > 1 ? 1.5 : 0, borderColor: `${b.color}55`, backgroundColor: chosen.length > 1 ? `${b.color}08` : 'transparent' }}>
            {babies.length > 1 && <Row style={{ gap: 6 }}><BabyDot baby={b} /><Text style={{ fontWeight: '900', color: b.color }}>{b.name}</Text>{kind === 'bottle' && milk === 'usual' && !!b.formula && <Muted>{b.formula.name}</Muted>}</Row>}
            <Stepper label={babies.length > 1 ? b.name : undefined} value={amounts[b.id]} onChange={(v) => setAmounts((a) => ({ ...a, [b.id]: v }))} step={step} unit={unit} presets={kind === 'bottle' ? [30, 60, 90, 120, 150, 180] : undefined} />
            {kind === 'bottle' && (per ? <MacroChips per={per} ml={amounts[b.id]} /> : <Muted>Choose {b.name}'s formula to see energy, protein, fat and carbs.</Muted>)}
          </View>
        );
      })}
      {kind === 'breast' && <>
        <Choice label="Side" value={side} onChange={setSide} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }]} />
        <Stepper value={minutes} onChange={setMinutes} step={5} unit="min" presets={[5, 10, 15, 20, 30, 40]} />
        {ids.length > 1 && <Muted>Tandem feeding: the same minutes are logged for each baby ticked.</Muted>}
      </>}
      {kind === 'pump' && <Stepper value={ml} onChange={setMl} step={10} unit="ml" presets={[30, 60, 90, 120, 150, 200]} />}
      {kind === 'solids' && <>
        <MealBuilder bd={bd} lines={meal} setLines={setMeal} openLibrary={() => openLibrary('food')} />
        {!meal.length && <>
          <Muted>Or just describe it (no nutrients):</Muted>
          <Field label="What was eaten" value={food} onChange={setFood} placeholder="Rice porridge with pumpkin" />
          <Field label="How much (optional)" value={amount} onChange={setAmount} placeholder="3 spoons" />
        </>}
        {ids.length > 1 && meal.length > 0 && <Muted>The same amounts are logged for each baby ticked.</Muted>}
      </>}
      <TimeField label="Time" value={when} onChange={setWhen} minuteStep={5} labelStyle={s.label} />
      <Field label="Note (optional)" value={note} onChange={setNote} placeholder={kind === 'solids' ? 'Any reaction?' : 'Anything to share'} />
      <ErrorText message={error} />
      <Button icon="checkmark" label={ids.length > 1 ? `Save for ${chosen.map((b) => b.name).join(' and ')}` : 'Save'} onPress={save} />
    </Sheet>
  );
}

function FormulaSheet({ props, baby, count, close, myMilks, openLibrary }: { props: ScreenProps; baby: Baby; count: number; close: () => void; myMilks: FoodItem[]; openLibrary: () => void }) {
  const { cid, refresh } = props;
  const [list, setList] = useState<Formula[]>([]);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | '1' | '2' | '3'>('all');
  const [editing, setEditing] = useState(false);
  const [forAll, setForAll] = useState(count > 1);
  const cur = baby.formula?.per100ml || { kcal: 67, protein: 1.3, fat: 3.5, carbs: 7.4 };
  const [vals, setVals] = useState({ kcal: String(cur.kcal), protein: String(cur.protein), fat: String(cur.fat), carbs: String(cur.carbs) });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.formulas().then((r) => setList(r.formulas)).catch((e) => setError(e.message)); }, []);
  const shown = list.filter((f) => (stage === 'all' || String(f.stage) === stage) && `${f.brand} ${f.product}`.toLowerCase().includes(q.toLowerCase()));
  const upd = (body: Record<string, unknown>) => api.updateBaby(cid, { babyId: baby.id, formulaForAll: forAll, ...body });
  const choose = async (id: string) => { if (await run(() => upd({ formulaId: id }), refresh, setError)) close(); };
  return (
    <Sheet visible title={count > 1 ? `${baby.name}'s formula` : 'Formula milk'} onClose={close}>
      {count > 1 && (
        <Pressable onPress={() => setForAll(!forAll)} accessibilityRole="checkbox" accessibilityState={{ checked: forAll }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={forAll ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
          <Text style={{ fontWeight: '700', color: colors.text }}>Use the same formula for all {count} babies</Text>
        </Pressable>
      )}
      {baby.formula && (
        <Card style={{ gap: 6 }}>
          <Text style={s.itemTitle}>{baby.formula.brand} {baby.formula.name}</Text>
          {!!baby.formula.stageLabel && <Muted>{baby.formula.stageLabel}</Muted>}
          <Muted>Per 100 ml made up: {cur.kcal} kcal, protein {cur.protein} g, fat {cur.fat} g, carbs {cur.carbs} g{baby.formula.typical ? ' (typical values)' : ' (from your tin)'}</Muted>
          <Button small kind="secondary" icon="create-outline" label="Enter the values from the tin" onPress={() => setEditing(!editing)} />
          {editing && (
            <View style={{ gap: 8 }}>
              <Muted>Copy the "per 100 ml" column from the nutrition table on the tin.</Muted>
              <Row>{(['kcal', 'protein', 'fat', 'carbs'] as const).map((k2) => <View key={k2} style={{ flex: 1, minWidth: 70 }}><Field label={k2 === 'kcal' ? 'Energy (kcal)' : `${k2[0].toUpperCase()}${k2.slice(1)} (g)`} value={vals[k2]} onChange={(v) => setVals({ ...vals, [k2]: v })} keyboard="decimal-pad" /></View>)}</Row>
              <Button icon="checkmark" label="Save values" onPress={async () => { if (await run(() => upd({ per100ml: vals }), refresh, setError)) setEditing(false); }} />
            </View>
          )}
        </Card>
      )}
      <Overline>Your milk powders</Overline>
      {myMilks.map((m) => {
        const on = baby.formulaId === m.id;
        return (
          <Pressable key={m.id} onPress={() => choose(m.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.name}
            style={{ gap: 6, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.card }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><Text style={{ fontWeight: '800', fontSize: 15, color: colors.text, flex: 1 }}>{m.name}</Text>{on && <Icon name="checkmark-circle" size={22} color={colors.primary} />}</Row>
            <MacroRow m={m.per100} compact />
          </Pressable>
        );
      })}
      <Button kind="secondary" icon="add" label="Add your own milk powder (from the tin)" onPress={openLibrary} />
      <Overline>Formulas sold in Singapore</Overline>
      <Muted>Values shown are typical for each stage and can differ slightly by brand; check the tin and enter its values after choosing.</Muted>
      <Field label="Search" value={q} onChange={setQ} placeholder="Similac, NAN, Friso, Enfamil..." />
      <Choice value={stage} onChange={setStage} options={[{ value: 'all', label: 'All stages' }, { value: '1', label: 'Stage 1' }, { value: '2', label: 'Stage 2' }, { value: '3', label: 'Stage 3' }]} />
      <ErrorText message={error} />
      {shown.map((f) => {
        const on = baby.formulaId === f.id;
        return (
          <Pressable key={f.id} onPress={() => choose(f.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${f.brand} ${f.product}, ${f.stageLabel}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.card })}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: [colors.infoSoft, colors.warnSoft, colors.accentSoft][f.stage - 1], alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '900', color: colors.text }}>{f.stage}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }}>{f.product}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>{f.brand} · {f.stageLabel} · {f.type}</Text>
            </View>
            {on && <Icon name="checkmark-circle" size={24} color={colors.primary} />}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

function SleepSheet({ props, bd, close }: { props: ScreenProps; bd: BabyData; close: () => void }) {
  const { cid, refresh } = props;
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet visible title="Sleep" onClose={close}>
      {bd.babies.map((b) => {
        const open = bd.logs.find((l) => l.babyId === b.id && l.kind === 'sleep' && !l.endAt);
        return (
          <Row key={b.id} style={{ justifyContent: 'space-between', flexWrap: 'nowrap', paddingVertical: 6 }}>
            <Row style={{ gap: 8 }}><BabyDot baby={b} size={12} /><Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{b.name}</Text><Muted>{open ? `asleep since ${fmtTime(open.at)}` : 'awake'}</Muted></Row>
            <Button small kind={open ? 'primary' : 'secondary'} icon={open ? 'sunny-outline' : 'moon-outline'} label={open ? 'Woke up' : 'Asleep now'}
              onPress={() => run(() => (open ? api.updateBabyLog(cid, open.id, { endAt: new Date().toISOString() }) : api.addBabyLog(cid, { kind: 'sleep', babyId: b.id })), refresh, setError)} />
          </Row>
        );
      })}
      <ErrorText message={error} />
      <Button kind="secondary" label="Done" onPress={close} />
    </Sheet>
  );
}

// ---------- the screen ----------
export default function BabyScreen(props: ScreenProps) {
  const { data, cid, refresh } = props;
  const bd = data.baby!;
  const babies = bd.babies;
  const multi = babies.length > 1;
  const [sel, setSel] = useState<string>(multi ? 'all' : babies[0].id);
  const [sheet, setSheet] = useState<string | null>(null);
  const [formulaFor, setFormulaFor] = useState<Baby | null>(null);
  const [settings, setSettings] = useState(false);
  const [library, setLibrary] = useState<'milk' | 'food' | null>(null);
  const [sleepAll, setSleepAll] = useState(false);
  const [day, setDay] = useState(todaySG());
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>) => run(fn, refresh, setError);
  useEffect(() => { if (sel !== 'all' && !babies.some((b) => b.id === sel)) setSel(multi ? 'all' : babies[0].id); }, [babies, sel, multi]);

  const shownBabies = sel === 'all' ? babies : babies.filter((b) => b.id === sel);
  const single = shownBabies.length === 1 ? shownBabies[0] : null;
  const byId = (id: string) => babies.find((b) => b.id === id) || babies[0];
  const logsOf = (id: string) => bd.logs.filter((l) => l.babyId === id);
  const dayLogs = bd.logs.filter((l) => sgDay(l.at) === day && shownBabies.some((b) => b.id === l.babyId));
  const perBaby = useMemo(() => shownBabies.map((b) => ({ b, t: totalsOf(dayLogs.filter((l) => l.babyId === b.id), bd.breastMilk), lastFeed: logsOf(b.id).find((l) => l.kind === 'bottle' || l.kind === 'breast'), sleeping: logsOf(b.id).find((l) => l.kind === 'sleep' && !l.endAt), kg: logsOf(b.id).find((l) => l.kind === 'weight')?.kg })), [dayLogs, shownBabies, bd]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + SG - (6 - i) * 86400e3).toISOString().slice(0, 10));
  const weekLabels = week.map((d) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-SG', { weekday: 'short', timeZone: 'Asia/Singapore' }).slice(0, 2));
  const forIds = shownBabies.map((b) => b.id);
  const title = single ? single.name : data.circle.parentName;
  const age = ageText(babies[0].birthDate);

  const tile = (kind: string, onPress: () => void, label = KIND[kind].label, sub?: string) => (
    <Pressable key={kind + label} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Log ${label}${single && multi ? ` for ${single.name}` : ''}`}
      style={({ pressed }) => ({ width: '31%', minWidth: 96, flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, transform: [{ scale: pressed ? 0.96 : 1 }], shadowColor: '#1B2559', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } })}>
      <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: `${KIND[kind].color}18`, alignItems: 'center', justifyContent: 'center' }}><Icon name={KIND[kind].icon} size={24} color={KIND[kind].color} /></View>
      <Text style={{ fontWeight: '800', fontSize: 14, color: colors.text }}>{label}</Text>
      {!!sub && <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>{sub}</Text>}
    </Pressable>
  );
  const stat = (label: string, value: string, color: string) => (
    <View key={label} style={{ flexGrow: 1, minWidth: 90, backgroundColor: `${color}12`, borderRadius: 16, padding: 10 }}>
      <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color }}>{value}</Text>
    </View>
  );
  const glass = (key: string, a: string, b: string) => (
    <View key={key} style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{a}</Text>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{b}</Text>
    </View>
  );
  const nextFeed = (iso?: string) => (iso && bd.feedEvery ? fmtTime(new Date(new Date(iso).getTime() + bd.feedEvery * 3600e3).toISOString()) : '');

  const COMPARE: [string, (t: DayTotals, kg?: number) => string][] = [
    ['Feeds', (t) => String(t.feeds)], ['Milk', (t) => `${t.ml} ml`], ['Energy', (t) => `${Math.round(t.kcal)} kcal`], ['Protein', (t) => `${r1(t.protein)} g`],
    ['Fat', (t) => `${r1(t.fat)} g`], ['Carbs', (t) => `${r1(t.carbs)} g`], ['Milk per kg', (t, kg) => (kg && t.ml ? `${Math.round(t.ml / kg)} ml/kg` : '-')],
    ['Food', (t) => (t.meals ? `${Math.round(t.foodG)} g, ${Math.round(t.foodKcal)} kcal` : '-')], ['Breastfeeding', (t) => (t.breastMin ? `${t.breastMin} min` : '-')], ['Sleep', (t) => hm(t.sleepMs)], ['Diapers', (t) => `${t.wet} wet, ${t.dirty} dirty`],
  ];

  return (
    <View style={{ gap: 16 }}>
      <Gradient colors="linear-gradient(135deg, #FF8A5B 0%, #F45B8D 50%, #7C5CFF 100%)" fallback="#F45B8D" style={{ borderRadius: 26, padding: 20, gap: 10, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View style={{ flex: 1 }}>
            {multi && <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{multipleWord(babies.length)}</Text>}
            <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' }}>{age || 'Add the birth date in Settings'}</Text>
          </View>
          <Pressable onPress={() => setSettings(true)} accessibilityRole="button" accessibilityLabel="Baby settings" style={{ padding: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)' }}><Icon name="settings-outline" size={22} color="#fff" /></Pressable>
        </Row>
        {single ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {glass('last', 'Last feed', perBaby[0].lastFeed ? `${hm(Date.now() - new Date(perBaby[0].lastFeed.at).getTime())} ago` : 'Not logged yet')}
            {!!nextFeed(perBaby[0].lastFeed?.at) && glass('next', 'Next feed around', nextFeed(perBaby[0].lastFeed?.at))}
            {glass('sleep', perBaby[0].sleeping ? 'Sleeping' : 'Awake', perBaby[0].sleeping ? hm(Date.now() - new Date(perBaby[0].sleeping.at).getTime()) : perBaby[0].kg ? `${perBaby[0].kg} kg` : '-')}
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {perBaby.map(({ b, lastFeed, sleeping }) => (
              <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.card, borderWidth: 3, borderColor: b.color }} />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, minWidth: 64 }}>{b.name}</Text>
                <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>
                  {lastFeed ? `fed ${hm(Date.now() - new Date(lastFeed.at).getTime())} ago` : 'no feed yet'}{nextFeed(lastFeed?.at) ? ` · next ${nextFeed(lastFeed?.at)}` : ''}{sleeping ? ' · sleeping' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Gradient>

      {multi && (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[{ id: 'all', name: `All ${babies.length}`, color: colors.accent }, ...babies].map((b) => {
            const on = sel === b.id;
            return (
              <Pressable key={b.id} onPress={() => setSel(b.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={b.id === 'all' ? `All ${babies.length} babies side by side` : b.name}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: on ? b.color : colors.card, borderWidth: 1.5, borderColor: on ? b.color : colors.border }}>
                {b.id === 'all' ? <Icon name="people" size={16} color={on ? '#fff' : b.color} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? '#fff' : b.color }} />}
                <Text style={{ fontWeight: '800', color: on ? '#fff' : colors.text }}>{b.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <ErrorText message={error} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tile('bottle', () => setSheet('bottle'))}
        {tile('breast', () => setSheet('breast'))}
        {tile('pump', () => setSheet('pump'))}
        {tile('solids', () => setSheet('solids'))}
        {single
          ? tile('sleep', () => act(() => (perBaby[0].sleeping ? api.updateBabyLog(cid, perBaby[0].sleeping.id, { endAt: new Date().toISOString() }) : api.addBabyLog(cid, { kind: 'sleep', babyId: single.id }))), perBaby[0].sleeping ? 'Woke up' : 'Asleep now', perBaby[0].sleeping ? `since ${fmtTime(perBaby[0].sleeping.at)}` : undefined)
          : tile('sleep', () => setSleepAll(true), 'Sleep', `${perBaby.filter((x) => x.sleeping).length} of ${babies.length} asleep`)}
        {tile('weight', () => setSheet('weight'))}
      </View>
      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}><Overline>Diaper</Overline><Muted>One tap to log now</Muted></Row>
        {shownBabies.map((b) => (
          <Row key={b.id} style={{ gap: 8 }}>
            {multi && <Row style={{ gap: 6, minWidth: 70 }}><BabyDot baby={b} /><Text style={{ fontWeight: '800', color: b.color }}>{b.name}</Text></Row>}
            {(['wet', 'dirty', 'both'] as const).map((d) => <Button key={d} small kind="secondary" icon={d === 'wet' ? 'water-outline' : d === 'dirty' ? 'ellipse' : 'layers-outline'} label={d === 'both' ? 'Both' : d === 'wet' ? 'Wet' : 'Dirty'} onPress={() => act(() => api.addBabyLog(cid, { kind: 'diaper', diaper: d, babyId: b.id }))} />)}
          </Row>
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Overline>{day === todaySG() ? 'Today' : new Date(`${day}T12:00:00+08:00`).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' })}{single && multi ? `: ${single.name}` : ''}</Overline>
          <Row style={{ gap: 4 }}>
            <Pressable onPress={() => setDay(new Date(new Date(`${day}T12:00:00+08:00`).getTime() - 86400e3 + SG).toISOString().slice(0, 10))} accessibilityRole="button" accessibilityLabel="Previous day" style={{ padding: 6 }}><Icon name="chevron-back" size={20} color={colors.primary} /></Pressable>
            <Pressable disabled={day >= todaySG()} onPress={() => setDay(new Date(new Date(`${day}T12:00:00+08:00`).getTime() + 86400e3 + SG).toISOString().slice(0, 10))} accessibilityRole="button" accessibilityLabel="Next day" style={{ padding: 6, opacity: day >= todaySG() ? 0.3 : 1 }}><Icon name="chevron-forward" size={20} color={colors.primary} /></Pressable>
          </Row>
        </Row>
        {single ? (() => { const t = perBaby[0].t; const kg = perBaby[0].kg; return <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stat('Feeds', String(t.feeds), '#2563EB')}
            {stat('Milk', `${t.ml} ml`, '#2563EB')}
            {stat('Energy', `${Math.round(t.kcal)} kcal`, '#C2410C')}
            {stat('Sleep', hm(t.sleepMs), '#4338CA')}
            {stat('Diapers', `${t.wet} wet · ${t.dirty} dirty`, '#0F8A45')}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stat('Protein', `${r1(t.protein)} g`, '#7C3AED')}
            {stat('Fat', `${r1(t.fat)} g`, '#B45309')}
            {stat('Carbs', `${r1(t.carbs)} g`, '#0E7490')}
            {!!(kg && t.ml) && stat('Milk per kg', `${Math.round(t.ml / kg)} ml/kg`, '#0C7C80')}
          </View>
          {t.meals > 0 && <Muted>Food: {t.meals} item{t.meals === 1 ? '' : 's'}, {Math.round(t.foodG)} g, {Math.round(t.foodKcal)} kcal · Milk: {Math.round(t.kcal - t.foodKcal)} kcal</Muted>}
          {t.breastMin > 0 && <Muted>Plus {t.breastMin} min of breastfeeding (not counted in ml or nutrients).</Muted>}
          {(() => { const et = effectiveTargets(single, bd.logs).targets; return !!et && (
            <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceAlt }}>
              <Overline>Daily targets{single.targetsMode === 'auto' ? ' (automatic)' : ''}</Overline>
              {et.ml ? <TargetBar label="Milk" value={t.ml} target={et.ml} unit="ml" color="#2563EB" /> : null}
              {et.kcal ? <TargetBar label="Energy" value={t.kcal} target={et.kcal} unit="kcal" color="#C2410C" /> : null}
              {et.protein ? <TargetBar label="Protein" value={t.protein} target={et.protein} unit="g" color="#7C3AED" /> : null}
              {et.fat ? <TargetBar label="Fat" value={t.fat} target={et.fat} unit="g" color="#B45309" /> : null}
              {et.carbs ? <TargetBar label="Carbs" value={t.carbs} target={et.carbs} unit="g" color="#0E7490" /> : null}
            </View>
          ); })()}
        </>; })() : (
          <View accessibilityLabel="Babies side by side" style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt }}>
              <Text style={{ flex: 1.1, padding: 10, fontWeight: '800', color: colors.muted, fontSize: 13 }}>Side by side</Text>
              {perBaby.map(({ b }) => <Text key={b.id} style={{ flex: 1, padding: 10, fontWeight: '900', color: b.color, textAlign: 'right' }}>{b.name}</Text>)}
            </View>
            {COMPARE.map(([label, fn], i) => (
              <View key={label} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: i % 2 ? colors.surfaceAlt : colors.card }}>
                <Text style={{ flex: 1.1, padding: 10, fontWeight: '700', color: colors.text, fontSize: 14 }}>{label}</Text>
                {perBaby.map(({ b, t, kg }) => <Text key={b.id} style={{ flex: 1, padding: 10, textAlign: 'right', fontWeight: '800', color: colors.text, fontSize: 14 }}>{fn(t, kg)}</Text>)}
              </View>
            ))}
          </View>
        )}
        <Muted>Nutrients come from the milk's values per 100 ml and the food's values per 100 g (typical values until you enter your own). Famhub does not give feeding advice; ask your doctor or nurse.</Muted>
      </Card>

      <Pressable onPress={() => props.go('babyreport')} accessibilityRole="button" accessibilityLabel="Open reports: daily, weekly, monthly or chosen dates"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.accentBorder, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="bar-chart" size={24} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>Reports</Text>
          <Text style={{ fontSize: 13, color: colors.muted }}>Daily, weekly, monthly or ticked dates: energy, protein, fat, carbs, milk, sleep, diapers and growth. Download or print.</Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.faint} />
      </Pressable>

      <Card style={{ gap: 6 }}>
        <Overline>Milk per day (last 7 days)</Overline>
        <BarChart labels={weekLabels} series={shownBabies.map((b) => ({ name: b.name, color: multi ? b.color : '#2563EB', values: week.map((d) => bd.logs.filter((l) => l.babyId === b.id && l.kind === 'bottle' && sgDay(l.at) === d).reduce((a, l) => a + (l.ml || 0), 0)) }))} />
        {shownBabies.length > 1 && <Row style={{ gap: 12 }}>{shownBabies.map((b) => <Row key={b.id} style={{ gap: 6 }}><BabyDot baby={b} /><Muted>{b.name}</Muted></Row>)}</Row>}
      </Card>

      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}><Overline>Growth: weight</Overline><Button small kind="ghost" icon="add" label="Weight" onPress={() => setSheet('weight')} /></Row>
        <LineChart unit=" kg" series={shownBabies.map((b) => ({ name: b.name, color: multi ? b.color : '#0C7C80', points: logsOf(b.id).filter((l) => l.kind === 'weight').map((l) => ({ t: new Date(l.at).getTime(), y: l.kg || 0 })) }))} />
        {shownBabies.map((b) => {
          const w = logsOf(b.id).filter((l) => l.kind === 'weight').sort((x, y) => x.at.localeCompare(y.at));
          if (w.length < 2) return null;
          const a = w[w.length - 2]; const z = w[w.length - 1];
          const days = Math.max(1, (new Date(z.at).getTime() - new Date(a.at).getTime()) / 86400e3);
          const g = Math.round(((z.kg || 0) - (a.kg || 0)) * 1000);
          return <Muted key={b.id}>{multi ? `${b.name}: ` : ''}{g >= 0 ? '+' : ''}{g} g in {Math.round(days)} days (about {Math.round(g / (days / 7))} g a week).</Muted>;
        })}
        <Muted>Show the chart to the doctor or nurse at each check.</Muted>
        <Row><Button small kind="ghost" label="Add length" onPress={() => setSheet('height')} /><Button small kind="ghost" label="Add head size" onPress={() => setSheet('head')} /></Row>
      </Card>

      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}><Overline>{multi ? 'Milk for each baby' : 'Milk'}</Overline><Button small kind="ghost" icon="list" label="Milk and food list" onPress={() => setLibrary('milk')} /></Row>
        {shownBabies.map((b) => (
          <View key={b.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flex: 1, gap: 2 }}>
                {multi && <Row style={{ gap: 6 }}><BabyDot baby={b} /><Text style={{ fontWeight: '900', color: b.color }}>{b.name}</Text></Row>}
                <Text style={s.itemTitle}>{b.formula ? `${b.formula.brand} ${b.formula.name}` : 'No formula chosen'}</Text>
              </View>
              <Button small kind="secondary" icon="swap-horizontal" label={b.formula ? 'Change' : 'Choose'} onPress={() => setFormulaFor(b)} />
            </Row>
            {(() => { const et = effectiveTargets(b, bd.logs).targets; return !!et && <Muted>Daily targets{b.targetsMode === 'auto' ? ' (automatic)' : ''}: {[et.ml && `${et.ml} ml`, et.kcal && `${et.kcal} kcal`, et.protein && `protein ${et.protein} g`, et.fat && `fat ${et.fat} g`, et.carbs && `carbs ${et.carbs} g`].filter(Boolean).join(' · ')}</Muted>; })()}
            {b.formula ? <>
              <Muted>Per 100 ml: {b.formula.per100ml.kcal} kcal · protein {b.formula.per100ml.protein} g · fat {b.formula.per100ml.fat} g · carbs {b.formula.per100ml.carbs} g</Muted>
              {b.formula.typical && <Badge label="Typical values: check the tin" tone="warn" />}
            </> : <Muted>Choose the formula to track energy, protein, fat and carbs.</Muted>}
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>Foods ({(bd.myFoods || []).filter((f) => f.kind === 'food').length} yours, {(bd.presetFoods || []).length} common)</Text>
            <Muted>Energy, protein, fat and carbs per 100 g; used when you log solids.</Muted>
          </View>
          <Button small kind="secondary" icon="restaurant-outline" label="Foods" onPress={() => setLibrary('food')} />
        </Row>
      </Card>

      <Card style={{ gap: 4 }}>
        <Overline>Log</Overline>
        {!dayLogs.length && <Empty icon="list-outline">Nothing logged on this day.</Empty>}
        {dayLogs.map((l) => {
          const k = KIND[l.kind];
          const m = macrosOf(l, bd.breastMilk);
          const b = byId(l.babyId);
          return (
            <Row key={l.id} style={{ flexWrap: 'nowrap', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ width: 62, fontWeight: '800', color: colors.text }}>{fmtTime(l.at)}</Text>
              <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: `${k.color}18`, alignItems: 'center', justifyContent: 'center' }}><Icon name={k.icon} size={18} color={k.color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{multi && <Text style={{ color: b.color, fontWeight: '900' }}>{b.name} · </Text>}{k.label}: {describe(l)}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  <Text style={{ color: personColor(l.by), fontWeight: '700' }}>{nameOf(data, l.by)}</Text>
                  {m ? ` · ${Math.round(m.kcal)} kcal, P ${r1(m.protein)} g, F ${r1(m.fat)} g, C ${r1(m.carbs)} g` : ''}{l.note ? ` · ${l.note}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => act(() => api.deleteBabyLog(cid, l.id))} accessibilityRole="button" accessibilityLabel={`Delete ${multi ? `${b.name}'s ` : ''}${k.label} at ${fmtTime(l.at)}`} style={{ padding: 6 }}><Icon name="trash-outline" size={18} color={colors.faint} /></Pressable>
            </Row>
          );
        })}
      </Card>

      {sheet && !library && <LogSheet kind={sheet} props={props} baby={bd} forIds={forIds} close={() => setSheet(null)} openLibrary={(k) => setLibrary(k)} />}
      {library && <FoodLibrarySheet props={props} bd={bd} startKind={library} close={() => setLibrary(null)} />}
      {formulaFor && !library && <FormulaSheet props={props} baby={formulaFor} count={babies.length} close={() => setFormulaFor(null)} myMilks={(bd.myFoods || []).filter((f) => f.kind === 'milk')} openLibrary={() => setLibrary('milk')} />}
      {sleepAll && <SleepSheet props={props} bd={bd} close={() => setSleepAll(false)} />}
      {settings && <BabySettings props={props} bd={bd} close={() => setSettings(false)} />}
    </View>
  );
}

function BabySettings({ props, bd, close }: { props: ScreenProps; bd: BabyData; close: () => void }) {
  const { cid, refresh } = props;
  const [edits, setEdits] = useState<Record<string, { name: string; birthDate: string; sex: string }>>(() => Object.fromEntries(bd.babies.map((b) => [b.id, { name: b.name, birthDate: b.birthDate || '', sex: b.sex || '' }])));
  const [modes, setModes] = useState<Record<string, 'auto' | 'manual'>>(() => Object.fromEntries(bd.babies.map((b) => [b.id, b.targetsMode === 'auto' ? 'auto' : 'manual'])));
  const [targets, setTargets] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(bd.babies.map((b) => [b.id, Object.fromEntries(Object.entries(b.targets || {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]))])));
  const [feedEvery, setFeedEvery] = useState(String(bd.feedEvery ?? 3));
  const [newName, setNewName] = useState('');
  const [newSex, setNewSex] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saveAll = async () => {
    const ok = await run(async () => {
      for (const b of bd.babies) await api.updateBaby(cid, { babyId: b.id, ...edits[b.id], targetsMode: modes[b.id], targets: targets[b.id] || {} });
      await api.updateBaby(cid, { babyId: bd.babies[0].id, feedEvery: Number(feedEvery) });
    }, refresh, setError);
    if (ok) close();
  };
  return (
    <Sheet visible title={bd.babies.length > 1 ? `${multipleWord(bd.babies.length)}: settings` : 'Baby settings'} onClose={close}>
      {bd.babies.map((b, i) => (
        <Card key={b.id} style={{ gap: 8, borderLeftWidth: 4, borderLeftColor: b.color }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Overline>Baby {i + 1}</Overline>
            {bd.babies.length > 1 && <Button small kind="ghost" icon="trash-outline" label={`Remove ${b.name}`} onPress={() => run(() => api.removeBaby(cid, b.id), refresh, setError)} />}
          </Row>
          <Field label="Name" value={edits[b.id]?.name || ''} onChange={(v) => setEdits((e) => ({ ...e, [b.id]: { ...e[b.id], name: v } }))} />
          <DatePicker label="Birth date" value={edits[b.id]?.birthDate || ''} onChange={(v) => setEdits((e) => ({ ...e, [b.id]: { ...e[b.id], birthDate: v } }))} />
          <Choice label="Baby is a" value={edits[b.id]?.sex || ''} onChange={(v) => setEdits((e) => ({ ...e, [b.id]: { ...e[b.id], sex: v } }))} options={[{ value: 'boy', label: 'Boy' }, { value: 'girl', label: 'Girl' }]} />
          <TargetsEditor baby={{ ...b, ...edits[b.id] } as Baby} logs={bd.logs.filter((l) => l.babyId === b.id)} mode={modes[b.id]} setMode={(m) => setModes((x) => ({ ...x, [b.id]: m }))} value={targets[b.id] || {}} onChange={(v) => setTargets((t) => ({ ...t, [b.id]: v }))} />
        </Card>
      ))}
      <Choice label="Remind everyone when a feed is due, after" value={feedEvery} onChange={setFeedEvery} options={[{ value: '0', label: 'No reminder' }, ...[2, 2.5, 3, 3.5, 4, 5].map((h) => ({ value: String(h), label: `${h} hours` }))]} />
      <Muted>Each baby gets its own reminder. It goes to everyone in the circle (Notification settings &gt; Baby).</Muted>
      <ErrorText message={error} />
      <Button icon="checkmark" label="Save" onPress={saveAll} />
      {bd.babies.length < 4 && (
        <Card style={{ gap: 8 }}>
          <Overline>{bd.babies.length === 1 ? 'Twins? Add the other baby' : bd.babies.length === 2 ? 'Triplets? Add the third baby' : 'Add another baby'}</Overline>
          <Field label="Name" value={newName} onChange={setNewName} placeholder="Emma" />
          <Choice label="Baby is a" value={newSex} onChange={setNewSex} options={[{ value: 'boy', label: 'Boy' }, { value: 'girl', label: 'Girl' }]} />
          <Muted>Uses the same birth date and formula as {bd.babies[0].name}; change them later if needed.</Muted>
          <Button kind="secondary" icon="add" label="Add baby" disabled={!newName.trim()} onPress={async () => { if (await run(() => api.addBaby(cid, { name: newName.trim(), sex: newSex }), refresh, setError)) { setNewName(''); setNewSex(''); } }} />
        </Card>
      )}
    </Sheet>
  );
}
