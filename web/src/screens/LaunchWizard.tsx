import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, CareFor, CarePlan, CareProfile, Formula, ProfileLists, ProfileOption } from '../api';
import { KINDS, kindOf } from '../family';
import DatePicker from '../DatePicker';
import { colors, gradients } from '../theme';
import { TimeField } from '../TimeWheel';
import { Button, Card, Choice, ErrorText, Field, Gradient, Icon, Muted, Overline, Row, s } from '../ui';

// The launch wizard: who you care for (an older parent, or a newborn, baby, twins or triplets),
// their stage of life, where they live and what they need. Famhub then suggests a starter plan.
// Also used later (More > Care profile) to change the profile of an existing circle.

type Catalogue = ProfileLists & { baby: ProfileLists; kid: ProfileLists; teen: ProfileLists };
const ELDER_REL = ['Mum', 'Dad', 'Grandma', 'Grandpa', 'Aunt', 'Uncle', 'Spouse'];
const CHILD_REL = ['Son', 'Daughter', 'Grandson', 'Granddaughter', 'Nephew', 'Niece'];
const BABY_COUNT = [{ n: 1, label: 'One baby', icon: 'happy-outline' as const }, { n: 2, label: 'Twins', icon: 'people-outline' as const }, { n: 3, label: 'Triplets', icon: 'people-circle-outline' as const }];
const joinNames = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

function OptionCard({ o, on, onPress, multi }: { o: ProfileOption; on: boolean; onPress: () => void; multi?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={multi ? { checked: on } : { selected: on }} accessibilityLabel={o.label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.card, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: on ? colors.primary : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={(o.icon as any) || 'ellipse-outline'} size={22} color={on ? '#fff' : colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{o.label}</Text>
        {!!o.desc && <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{o.desc}</Text>}
      </View>
      {multi ? <Icon name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.primary : colors.faint} /> : on ? <Icon name="checkmark-circle" size={24} color={colors.primary} /> : null}
    </Pressable>
  );
}

export default function LaunchWizard({ onDone, onCancel, edit, initialKind }: {
  onDone: (circleId: string) => void; onCancel?: () => void; initialKind?: CareFor;
  edit?: { cid: string; profile: CareProfile | null; checkinBy: string; name: string };
}) {
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [careFor, setCareFor] = useState<CareFor>(edit?.profile?.careFor || initialKind || 'elder');
  const [name, setName] = useState(edit?.name || '');
  const [relation, setRelation] = useState(edit?.profile?.relation || '');
  const [count, setCount] = useState(edit?.profile?.count || 1);
  const [babies, setBabies] = useState<{ name: string; sex: string }[]>([{ name: '', sex: '' }, { name: '', sex: '' }, { name: '', sex: '' }]);
  const [birthDate, setBirthDate] = useState('');
  const [stage, setStage] = useState(edit?.profile?.stage || '');
  const [living, setLiving] = useState(edit?.profile?.living || '');
  const [needs, setNeeds] = useState<string[]>(edit?.profile?.needs || []);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [formulaId, setFormulaId] = useState('');
  const [fq, setFq] = useState('');
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [checkinBy, setCheckinBy] = useState(edit?.checkinBy || '10:00');
  const [feedEvery, setFeedEvery] = useState('3');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.profileCatalogue().then(setCat).catch((e) => setError(e.message)); }, []);
  const baby = careFor === 'baby';
  const child = careFor === 'kid' || careFor === 'teen';
  const kind = kindOf(careFor);
  const lists = cat ? (careFor === 'elder' ? cat : cat[careFor]) : null;
  const wantsFormula = baby && needs.includes('formula') && !edit;
  const steps = [...(edit ? [] : initialKind ? ['name'] : ['who', 'name']), 'stage', 'living', 'needs', ...(wantsFormula ? ['formula'] : []), 'plan'];
  const cur = steps[Math.min(step, steps.length - 1)];
  const babyNames = babies.slice(0, count).map((b, i) => b.name.trim() || (count > 1 ? `Baby ${i + 1}` : 'Baby'));
  const profile: Partial<CareProfile> = { careFor, stage, living, needs, relation: baby ? (count === 2 ? 'Twins' : count === 3 ? 'Triplets' : relation) : relation, ...(baby ? { count } : {}) };

  useEffect(() => { if (wantsFormula && !formulas.length) api.formulas().then((r) => setFormulas(r.formulas)).catch(() => undefined); }, [wantsFormula, formulas.length]);
  useEffect(() => {
    if (cur !== 'plan') return;
    api.profilePlan(profile).then((p) => { setPlan(p); setPicked(p.tasks.map((t) => t.key)); if (!edit && p.checkinBy) setCheckinBy(p.checkinBy); if (p.feedEvery !== undefined) setFeedEvery(String(p.feedEvery)); }).catch((e) => setError(e.message));
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = cur === 'name' ? (baby ? babies.slice(0, count).every((b) => b.name.trim()) : !!name.trim()) : cur === 'stage' ? !!stage : cur === 'living' ? !!living : true;
  const next = () => { setError(null); setStep((x) => Math.min(x + 1, steps.length - 1)); };
  const back = () => { setError(null); if (step === 0) onCancel?.(); else setStep((x) => x - 1); };

  const finish = async () => {
    setBusy(true); setError(null);
    try {
      if (edit) {
        await api.setProfile(edit.cid, { profile, checkinBy: baby || careFor === 'kid' ? undefined : checkinBy, tasks: picked });
        onDone(edit.cid);
      } else {
        const parentName = baby ? joinNames(babyNames) : name.trim();
        const r = await api.createCircle({
          name: baby || child ? `${parentName}'s circle` : `${parentName}'s care circle`, parentName, profile, tasks: picked,
          ...(baby ? { birthDate, formulaId, feedEvery: Number(feedEvery), babies: babies.slice(0, count).map((b, i) => ({ name: babyNames[i], sex: b.sex })) } : careFor === 'kid' ? {} : { checkinBy }),
        } as any);
        onDone(r.id);
      }
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const heading: Record<string, [string, string]> = {
    who: ['Who are you caring for?', 'Famhub sets itself up differently for parents, infants, kids and teenagers.'],
    name: baby ? ['About the baby', 'For twins or triplets, each baby gets their own log, formula and growth chart.'] : child ? [careFor === 'kid' ? 'About your child' : 'About your teenager', 'The name everyone in the family uses.'] : ['Who is it?', 'The name they like to be called. It is shown on their big-button screen.'],
    stage: baby || child ? ['How old?', 'Pick the closest stage.'] : ['Stage of life', 'Pick the one closest to how things are now. You can change it later.'],
    living: baby ? ['Who looks after them in the day?', ''] : careFor === 'kid' ? ['Who looks after them after school?', ''] : careFor === 'teen' ? ['Where do they live?', ''] : ['Where do they live?', ''],
    needs: baby ? ['Feeding and health', 'Tick all that apply.'] : child ? ['School, activities and health', 'Tick all that apply, or none.'] : ['Anything to watch for?', 'Tick all that apply, or none.'],
    formula: ['Which formula milk?', 'Used to work out energy, protein, fat and carbs for each bottle. You can set a different one for each baby later.'],
    plan: ['Your starter plan', 'Untick anything you do not need. Each item becomes a request anyone in the circle can take.'],
  };
  const [h1, h2] = heading[cur];

  return (
    <View style={{ gap: 14 }}>
      <Gradient colors={careFor === 'elder' ? gradients.brand : kind.gradient} fallback={colors.primary} style={{ borderRadius: 24, padding: 20, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '800', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' }}>{edit ? 'Care profile' : 'Set up Famhub'} · step {step + 1} of {steps.length}</Text>
          {onCancel && <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" size={22} color="#fff" /></Pressable>}
        </Row>
        <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{h1}</Text>
        {!!h2 && <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15 }}>{h2}</Text>}
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: steps.length, now: step + 1 }}>
          <View style={{ width: `${((step + 1) / steps.length) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.card }} />
        </View>
      </Gradient>

      {!cat && !error && <Muted>Loading…</Muted>}
      {edit && step === 0 && <Card><Muted>This changes the profile of {edit.name}. To follow someone else (a parent, baby, child or teenager), use the tabs at the top or More &gt; Set up someone new.</Muted></Card>}

      {cur === 'who' && (
        <View style={{ gap: 10 }}>
          {KINDS.map((k) => (
            <OptionCard key={k.id} o={{ id: k.id, label: k.id === 'elder' ? 'An older parent or relative' : k.id === 'baby' ? 'A newborn, baby, twins or triplets' : k.id === 'kid' ? 'A child (preschool or primary school)' : 'A teenager (secondary, JC, Poly or ITE)', icon: k.icon, desc: k.blurb }}
              on={careFor === k.id} onPress={() => { setCareFor(k.id); setStage(''); setLiving(''); setNeeds([]); setRelation(''); }} />
          ))}
        </View>
      )}

      {cur === 'name' && !baby && (
        <Card style={{ gap: 10 }}>
          <Field label="Name" value={name} onChange={setName} placeholder={child ? (careFor === 'kid' ? 'Chloe' : 'Ryan') : 'Mum'} />
          <Text style={s.label}>They are my</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(child ? CHILD_REL : ELDER_REL).map((r) => <Pressable key={r} onPress={() => { setRelation(r); if (!name.trim() && !child) setName(r); }} accessibilityRole="radio" accessibilityState={{ selected: relation === r }} style={[s.chip, relation === r && s.chipOn]}><Text style={[s.chipText, relation === r && s.chipTextOn]}>{r}</Text></Pressable>)}
          </View>
        </Card>
      )}

      {cur === 'name' && baby && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {BABY_COUNT.map((c) => (
              <Pressable key={c.n} onPress={() => setCount(c.n)} accessibilityRole="radio" accessibilityState={{ selected: count === c.n }} accessibilityLabel={c.label}
                style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 18, borderWidth: 2, borderColor: count === c.n ? '#F45B8D' : colors.border, backgroundColor: count === c.n ? colors.dangerSoft : colors.card }}>
                <Row style={{ gap: 2 }}>{Array.from({ length: c.n }, (_, i) => <Icon key={i} name="happy" size={20} color={count === c.n ? '#F45B8D' : colors.faint} />)}</Row>
                <Text style={{ fontWeight: '900', color: colors.text }}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          {babies.slice(0, count).map((b, i) => (
            <Card key={i} style={{ gap: 8, borderLeftWidth: 4, borderLeftColor: ['#2563EB', '#DB2777', '#0F8A45'][i] }}>
              {count > 1 && <Overline>Baby {i + 1}</Overline>}
              <Field label="Name" value={b.name} onChange={(v) => setBabies((l) => l.map((x, j) => (j === i ? { ...x, name: v } : x)))} placeholder={['Ethan', 'Emma', 'Ella'][i]} />
              <Choice label="Baby is a" value={b.sex} onChange={(v) => setBabies((l) => l.map((x, j) => (j === i ? { ...x, sex: v } : x)))} options={[{ value: 'boy', label: 'Boy' }, { value: 'girl', label: 'Girl' }]} />
            </Card>
          ))}
          <Card><DatePicker label="Birth date" value={birthDate} onChange={setBirthDate} optional /></Card>
        </View>
      )}

      {lists && cur === 'stage' && <View style={{ gap: 10 }}>{lists.stages.map((o) => <OptionCard key={o.id} o={o} on={stage === o.id} onPress={() => setStage(o.id)} />)}</View>}
      {lists && cur === 'living' && <View style={{ gap: 10 }}>{lists.living.map((o) => <OptionCard key={o.id} o={o} on={living === o.id} onPress={() => setLiving(o.id)} />)}</View>}
      {lists && cur === 'needs' && <View style={{ gap: 10 }}>{lists.needs.map((o) => <OptionCard key={o.id} multi o={o} on={needs.includes(o.id)} onPress={() => setNeeds((n) => (n.includes(o.id) ? n.filter((x) => x !== o.id) : [...n, o.id]))} />)}</View>}

      {cur === 'formula' && (
        <View style={{ gap: 8 }}>
          <Field label="Search" value={fq} onChange={setFq} placeholder="Similac, NAN, Friso, Enfamil..." />
          <OptionCard o={{ id: '', label: 'Choose later', icon: 'time-outline' }} on={!formulaId} onPress={() => setFormulaId('')} />
          {formulas.filter((f) => `${f.brand} ${f.product}`.toLowerCase().includes(fq.toLowerCase())).map((f) => (
            <OptionCard key={f.id} o={{ id: f.id, label: f.product, icon: 'water-outline', desc: `${f.brand} · ${f.stageLabel} · ${f.type}` }} on={formulaId === f.id} onPress={() => setFormulaId(f.id)} />
          ))}
          <Muted>Nutrition values are typical for each stage; check the tin and enter its values later under Baby &gt; Formula.</Muted>
        </View>
      )}

      {cur === 'plan' && plan && (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 6, backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }}>
            <Overline>Care focus</Overline>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>{plan.focus.title}</Text>
            {plan.focus.tips.map((t) => <Row key={t} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Icon name="sparkles" size={16} color={colors.accent} /><Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{t}</Text></Row>)}
          </Card>
          {baby ? (
            <Card><Choice label="Remind everyone when a feed is due, after" value={feedEvery} onChange={setFeedEvery} options={[{ value: '0', label: 'No reminder' }, ...[2, 2.5, 3, 3.5, 4, 5].map((h) => ({ value: String(h), label: `${h} hours` }))]} />{count > 1 && <Muted>Each baby gets their own reminder.</Muted>}</Card>
          ) : careFor === 'kid' ? null : (
            <Card style={{ gap: 4 }}><TimeField label={careFor === 'teen' ? '"Home safe" check-in expected by' : 'Daily check-in expected by'} value={checkinBy} onChange={setCheckinBy} minuteStep={15} labelStyle={s.label} /><Muted>{careFor === 'teen' ? 'If nobody ticks "Home safe" by then, the family gets a gentle reminder.' : 'If there is no "I\'m OK" by then, the family is alerted.'}</Muted></Card>
          )}
          {plan.quietNags && <Card><Muted>Gentle mode: Famhub will not send "overdue" nudges for this circle.</Muted></Card>}
          <Card style={{ gap: 8 }}>
            <Overline>Starter requests ({picked.length})</Overline>
            {plan.tasks.map((t) => {
              const on = picked.includes(t.key);
              return (
                <Pressable key={t.key} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== t.key) : [...p, t.key]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={t.title}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                  <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.faint} />
                  <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{t.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>in {t.days} day{t.days === 1 ? '' : 's'}</Text>
                </Pressable>
              );
            })}
            {!plan.tasks.length && <Muted>No starter requests for this profile.</Muted>}
          </Card>
        </View>
      )}

      <ErrorText message={error} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        {(step > 0 || onCancel) ? <Button kind="secondary" icon="chevron-back" label="Back" onPress={back} /> : <View />}
        {cur === 'plan'
          ? <Button icon="rocket-outline" label={busy ? 'Saving…' : edit ? 'Save profile' : baby ? `Start ${joinNames(babyNames)}'s circle` : `Start ${name.trim() || 'the'} circle`} disabled={busy || !plan} onPress={finish} />
          : <Button icon="chevron-forward" label="Next" disabled={!canNext || !cat} onPress={next} />}
      </Row>
    </View>
  );
}
