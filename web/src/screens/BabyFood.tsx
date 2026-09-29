import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, Baby, BabyData, BabyLog, FoodItem, Macros } from '../api';
import { suggestTargets } from '../babyTargets';
import { colors } from '../theme';
import { Button, Card, Choice, ErrorText, Field, Icon, Muted, Overline, Row, Segmented, Sheet, s } from '../ui';
import { run, ScreenProps } from './shared';

// Milk powders and foods with their macronutrients, for infants.
// Milks are per 100 ml of made-up milk; foods are per 100 g as served. The family can add their own
// (copying the tin or packet) or copy and adjust a common food. Famhub gives no feeding advice.

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const scale = (per: Macros, amount: number): Macros => ({ kcal: (per.kcal * amount) / 100, protein: (per.protein * amount) / 100, fat: (per.fat * amount) / 100, carbs: (per.carbs * amount) / 100 });
export const addM = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, fat: a.fat + b.fat, carbs: a.carbs + b.carbs });
export const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
const MC = { kcal: '#C2410C', protein: '#7C3AED', fat: '#B45309', carbs: '#0E7490' };

export function MacroRow({ m, compact }: { m: Macros; compact?: boolean }) {
  const items: [keyof Macros, string, string][] = [['kcal', 'Energy', `${Math.round(m.kcal)} kcal`], ['protein', 'Protein', `${r1(m.protein)} g`], ['fat', 'Fat', `${r1(m.fat)} g`], ['carbs', 'Carbs', `${r1(m.carbs)} g`]];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {items.map(([k, a, b]) => (
        <View key={k} style={{ alignItems: 'center', backgroundColor: `${MC[k]}14`, borderRadius: 10, paddingVertical: compact ? 2 : 4, paddingHorizontal: compact ? 6 : 9 }}>
          {!compact && <Text style={{ fontSize: 11, color: colors.muted }}>{a}</Text>}
          <Text style={{ fontWeight: '800', color: MC[k], fontSize: compact ? 12 : 13 }}>{compact ? `${a[0]} ` : ''}{b}</Text>
        </View>
      ))}
    </View>
  );
}

// Bar showing how much of a daily target has been reached.
export function TargetBar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <View style={{ gap: 4 }} accessibilityLabel={`${label}: ${Math.round(value)} of ${target} ${unit}, ${pct} percent`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>{label}</Text>
        <Text style={{ fontWeight: '800', color, fontSize: 13 }}>{unit === 'kcal' || unit === 'ml' ? Math.round(value) : r1(value)} / {target} {unit}</Text>
      </Row>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt2, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function allFoods(bd: BabyData) {
  return [...(bd.myFoods || []), ...(bd.presetFoods || [])];
}

// Add or edit a milk powder or food.
export function FoodEditor({ props, kind, item, copyOf, babies, onDone }: { props: ScreenProps; kind: 'milk' | 'food'; item?: FoodItem; copyOf?: FoodItem; babies: Baby[]; onDone: () => void }) {
  const { cid, refresh } = props;
  const base = item || copyOf;
  const [name, setName] = useState(item ? item.name : copyOf ? `${copyOf.name} (mine)` : '');
  const [brand, setBrand] = useState(base?.brand || '');
  const [v, setV] = useState({ kcal: String(base?.per100.kcal ?? ''), protein: String(base?.per100.protein ?? ''), fat: String(base?.per100.fat ?? ''), carbs: String(base?.per100.carbs ?? '') });
  const [useFor, setUseFor] = useState(item ? 'none' : kind === 'milk' ? (babies.length > 1 ? 'all' : babies[0]?.id || 'none') : 'none');
  const [error, setError] = useState<string | null>(null);
  const unit = kind === 'milk' ? 'ml' : 'g';
  const calc = () => { const p = Number(v.protein) || 0; const f = Number(v.fat) || 0; const c = Number(v.carbs) || 0; setV({ ...v, kcal: String(Math.round(4 * p + 9 * f + 4 * c)) }); };
  const save = async () => {
    const body = { kind, name, brand, per100: v, ...(kind === 'milk' && useFor !== 'none' ? { useFor } : {}), ...(copyOf ? { from: copyOf.id } : {}) };
    if (await run(() => (item ? api.updateFood(cid, item.id, body) : api.addFood(cid, body)), refresh, setError)) onDone();
  };
  return (
    <Card style={{ gap: 10 }}>
      <Overline>{item ? 'Edit' : 'Add'} {kind === 'milk' ? 'milk powder' : 'food'}</Overline>
      <Field label={kind === 'milk' ? 'Name on the tin' : 'Food'} value={name} onChange={setName} placeholder={kind === 'milk' ? 'Aptamil Essensis Stage 1' : "Grandma's fish porridge"} />
      {kind === 'milk' && <Field label="Brand (optional)" value={brand} onChange={setBrand} placeholder="Aptamil" />}
      <Muted>{kind === 'milk' ? 'Copy the "per 100 ml" (made-up milk) column from the nutrition table on the tin.' : 'Per 100 g as served. From the packet, or copy a common food and adjust.'}</Muted>
      <Row>
        {(['kcal', 'protein', 'fat', 'carbs'] as const).map((k) => (
          <View key={k} style={{ flex: 1, minWidth: 72 }}>
            <Field label={k === 'kcal' ? 'Energy (kcal)' : `${k[0].toUpperCase()}${k.slice(1)} (g)`} value={v[k]} onChange={(x) => setV({ ...v, [k]: x })} keyboard="decimal-pad" />
          </View>
        ))}
      </Row>
      <Pressable onPress={calc} accessibilityRole="button"><Text style={s.link}>Work out energy from protein, fat and carbs (4, 9 and 4 kcal per g)</Text></Pressable>
      {kind === 'milk' && !item && (
        <Choice label="Use it now for" value={useFor} onChange={setUseFor} options={[...(babies.length > 1 ? [{ value: 'all', label: `All ${babies.length} babies` }] : []), ...babies.map((b) => ({ value: b.id, label: b.name })), { value: 'none', label: 'Just add it' }]} />
      )}
      <ErrorText message={error} />
      <Row>
        <Button icon="checkmark" label="Save" onPress={save} />
        <Button kind="secondary" label="Cancel" onPress={onDone} />
      </Row>
      <Muted>Energy per 100 {unit} is worked out for each {kind === 'milk' ? 'bottle' : 'serving'} from the amount you log.</Muted>
    </Card>
  );
}

// The family's milks and foods, plus common foods to copy.
export function FoodLibrarySheet({ props, bd, close, startKind = 'milk' }: { props: ScreenProps; bd: BabyData; close: () => void; startKind?: 'milk' | 'food' }) {
  const { cid, refresh } = props;
  const [tab, setTab] = useState<'milk' | 'food'>(startKind);
  const [editing, setEditing] = useState<{ item?: FoodItem; copyOf?: FoodItem } | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mine = (bd.myFoods || []).filter((f) => f.kind === tab);
  const presets = tab === 'food' ? (bd.presetFoods || []).filter((f) => f.name.toLowerCase().includes(q.toLowerCase())) : [];
  const groups = useMemo(() => [...new Set(presets.map((f) => f.group))], [presets]);
  const row = (f: FoodItem, actions: React.ReactNode) => (
    <View key={f.id} style={{ gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15 }}>{f.name}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{f.brand ? `${f.brand} · ` : ''}per 100 {f.unit}{f.typical ? ' · typical values' : ''}{bd.babies.filter((b) => b.formulaId === f.id).map((b) => ` · ${b.name}'s milk`).join('')}</Text>
        </View>
        <Row style={{ gap: 2, flexWrap: 'nowrap' }}>{actions}</Row>
      </Row>
      <MacroRow m={f.per100} compact />
    </View>
  );
  return (
    <Sheet visible title="Milk and food list" onClose={close}>
      <Segmented value={tab} onChange={(t) => { setTab(t as 'milk' | 'food'); setEditing(null); }} options={[{ value: 'milk', label: 'Milk powders' }, { value: 'food', label: 'Foods' }]} />
      <ErrorText message={error} />
      {editing ? (
        <FoodEditor props={props} kind={tab} item={editing.item} copyOf={editing.copyOf} babies={bd.babies} onDone={() => setEditing(null)} />
      ) : (
        <Button icon="add" label={tab === 'milk' ? 'Add your own milk powder' : 'Add your own food'} onPress={() => setEditing({})} />
      )}
      <Overline>{tab === 'milk' ? 'Your milk powders' : 'Your foods'} ({mine.length})</Overline>
      {!mine.length && <Muted>{tab === 'milk' ? 'None yet. Add the milk powder you use with the values from the tin, or choose one from the Singapore list (Formula > Change).' : 'None yet. Add a home-cooked dish or a packet food, or copy a common food below and adjust it.'}</Muted>}
      {mine.map((f) => row(f, <>
        <Pressable onPress={() => setEditing({ item: f })} accessibilityRole="button" accessibilityLabel={`Edit ${f.name}`} style={{ padding: 8 }}><Icon name="create-outline" size={20} color={colors.primary} /></Pressable>
        <Pressable onPress={() => run(() => api.deleteFood(cid, f.id), refresh, setError)} accessibilityRole="button" accessibilityLabel={`Delete ${f.name}`} style={{ padding: 8 }}><Icon name="trash-outline" size={20} color={colors.faint} /></Pressable>
      </>))}
      {tab === 'food' && <>
        <Overline>Common first foods (typical values)</Overline>
        <Field label="Search" value={q} onChange={setQ} placeholder="Pumpkin, salmon, avocado..." />
        {groups.map((g) => (
          <View key={g}>
            <Text style={{ fontWeight: '900', color: colors.muted, fontSize: 12, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{g}</Text>
            {presets.filter((f) => f.group === g).map((f) => row(f, <Pressable onPress={() => setEditing({ copyOf: f })} accessibilityRole="button" accessibilityLabel={`Copy and adjust ${f.name}`} style={{ padding: 8 }}><Icon name="copy-outline" size={20} color={colors.primary} /></Pressable>))}
          </View>
        ))}
      </>}
      <Muted>Values are per 100 ml of made-up milk or per 100 g of food. Common foods use typical values; recipes vary. Ask your doctor or dietitian about how much your baby needs.</Muted>
    </Sheet>
  );
}

// Build a meal from one or more foods with grams; shows the macros as you go.
export type MealLine = { foodId: string; grams: number };
export function MealBuilder({ bd, lines, setLines, openLibrary }: { bd: BabyData; lines: MealLine[]; setLines: (l: MealLine[]) => void; openLibrary: () => void }) {
  const foods = allFoods(bd).filter((f) => f.kind === 'food');
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState(lines.length === 0);
  const byId = (id: string) => foods.find((f) => f.id === id);
  const total = lines.reduce((a, l) => { const f = byId(l.foodId); return f ? addM(a, scale(f.per100, l.grams)) : a; }, ZERO);
  const shown = foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, q ? 30 : 12);
  return (
    <View style={{ gap: 10 }}>
      {lines.map((l, i) => {
        const f = byId(l.foodId);
        if (!f) return null;
        return (
          <View key={`${l.foodId}${i}`} style={{ gap: 8, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Text style={{ flex: 1, fontWeight: '800', color: colors.text }}>{f.name}</Text>
              <Pressable onPress={() => setLines(lines.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} style={{ padding: 4 }}><Icon name="close-circle" size={22} color={colors.faint} /></Pressable>
            </Row>
            <Row style={{ gap: 8, flexWrap: 'nowrap' }}>
              <Pressable onPress={() => setLines(lines.map((x, j) => (j === i ? { ...x, grams: Math.max(0, x.grams - 5) } : x)))} accessibilityRole="button" accessibilityLabel={`Less ${f.name}`} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="remove" size={20} color={colors.primary} /></Pressable>
              <TextInput value={String(l.grams)} onChangeText={(t) => setLines(lines.map((x, j) => (j === i ? { ...x, grams: Number(t.replace(/[^\d.]/g, '')) || 0 } : x)))} keyboardType="decimal-pad" accessibilityLabel={`Grams of ${f.name}`}
                style={{ width: 70, fontSize: 22, fontWeight: '900', textAlign: 'center', color: colors.text, borderBottomWidth: 2, borderBottomColor: colors.primary }} />
              <Text style={{ fontWeight: '700', color: colors.muted }}>g</Text>
              <Pressable onPress={() => setLines(lines.map((x, j) => (j === i ? { ...x, grams: x.grams + 5 } : x)))} accessibilityRole="button" accessibilityLabel={`More ${f.name}`} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="add" size={20} color={colors.primary} /></Pressable>
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                {[15, 30, 50, 80].map((g) => <Pressable key={g} onPress={() => setLines(lines.map((x, j) => (j === i ? { ...x, grams: g } : x)))} style={[s.chip, { paddingHorizontal: 8, paddingVertical: 4 }, l.grams === g && s.chipOn]}><Text style={[s.chipText, { fontSize: 12 }, l.grams === g && s.chipTextOn]}>{g}</Text></Pressable>)}
              </View>
            </Row>
            <MacroRow m={scale(f.per100, l.grams)} compact />
          </View>
        );
      })}
      {picking ? (
        <View style={{ gap: 6 }}>
          <Field label="Find a food" value={q} onChange={setQ} placeholder="Pumpkin, porridge, salmon..." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {shown.map((f) => (
              <Pressable key={f.id} onPress={() => { setLines([...lines, { foodId: f.id, grams: 30 }]); setPicking(false); setQ(''); }} accessibilityRole="button" accessibilityLabel={`Add ${f.name}`}
                style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: f.custom ? colors.accent : colors.border, backgroundColor: pressed ? colors.primarySoft : colors.card })}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>{f.custom ? '★ ' : ''}{f.name.replace(/,.*$/, '')}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={openLibrary} accessibilityRole="button"><Text style={s.link}>Not in the list? Add your own food</Text></Pressable>
        </View>
      ) : (
        <Button kind="secondary" icon="add" label="Add another food" onPress={() => setPicking(true)} />
      )}
      {lines.length > 0 && (
        <View style={{ gap: 6, padding: 12, borderRadius: 16, backgroundColor: colors.primarySoft }}>
          <Text style={{ fontWeight: '900', color: colors.text }}>This meal: {lines.reduce((a, l) => a + l.grams, 0)} g</Text>
          <MacroRow m={total} />
        </View>
      )}
    </View>
  );
}

// Daily targets per baby: automatic (from weight, length, sex and age, using published formulas) or the family's own.
export function TargetsEditor({ baby, logs, mode, setMode, value, onChange }: {
  baby: Baby; logs: BabyLog[]; mode: 'auto' | 'manual'; setMode: (m: 'auto' | 'manual') => void; value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const sug = suggestTargets(baby, logs);
  const fill = () => { if (sug.ok) onChange(Object.fromEntries(Object.entries(sug.s.targets).map(([k, v]) => [k, v === null ? '' : String(v)]))); };
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>Daily targets for {baby.name}</Text>
      <Choice value={mode} onChange={(m) => { setMode(m); if (m === 'manual' && !Object.values(value).some(Boolean)) fill(); }}
        options={[{ value: 'auto', label: 'Automatic (recommended)' }, { value: 'manual', label: 'Set my own' }]} />
      {sug.ok ? (
        <View style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder }}>
          <Text style={{ fontWeight: '900', color: colors.text }}>Suggested for {baby.name} today</Text>
          <MacroRow m={{ kcal: sug.s.targets.kcal || 0, protein: sug.s.targets.protein || 0, fat: sug.s.targets.fat || 0, carbs: sug.s.targets.carbs || 0 }} />
          {sug.s.targets.ml ? <Text style={{ fontWeight: '700', color: '#2563EB' }}>Milk about {sug.s.targets.ml} ml a day</Text> : <Muted>From 6 months milk and food share the energy, so no milk amount is suggested.</Muted>}
          <Muted>Based on {sug.s.basis.ageText} old, {sug.s.basis.kg} kg{sug.s.basis.cm ? `, ${sug.s.basis.cm} cm` : ''}{sug.s.basis.sex ? `, ${sug.s.basis.sex}` : ''}. Energy: {sug.s.basis.method === 'NASEM 2023' ? 'National Academies (NASEM 2023) equation using age, length, weight and sex' : 'Institute of Medicine (2005) equation using age and weight; add the length and sex for the newer equation'}. Protein, fat and carbs: Dietary Reference Intakes for this age.</Muted>
          {mode === 'auto' ? <Muted>Automatic targets update by themselves each time you log a new weight or length.</Muted> : <Button small kind="secondary" icon="copy-outline" label="Copy the suggestion into my targets" onPress={fill} />}
        </View>
      ) : (
        <View style={{ padding: 12, borderRadius: 14, backgroundColor: colors.warnSoft }}>
          <Text style={{ color: colors.warnText, fontWeight: '700' }}>To suggest targets, add {sug.missing.join(' and ')}{sug.missing.includes('weight') ? ' (Log > Weight)' : ''}. Adding the length and boy or girl gives the most accurate estimate.</Text>
        </View>
      )}
      {mode === 'manual' && (
        <>
          <Row>
            {([['ml', 'Milk (ml)'], ['kcal', 'Energy (kcal)'], ['protein', 'Protein (g)'], ['fat', 'Fat (g)'], ['carbs', 'Carbs (g)']] as const).map(([k, l]) => (
              <View key={k} style={{ flex: 1, minWidth: 64 }}><Field label={l} value={value[k] || ''} onChange={(x) => onChange({ ...value, [k]: x })} keyboard="decimal-pad" /></View>
            ))}
          </Row>
          <Muted>Use the amounts your doctor, nurse or dietitian gave you. Leave a box empty to hide that progress bar.</Muted>
        </>
      )}
      <Muted>Estimates for healthy babies born at term. For a premature baby or a medical condition, use your doctor's or dietitian's targets. Famhub does not give feeding advice.</Muted>
    </View>
  );
}
