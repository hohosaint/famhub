import { asPhotos, Photo, PhotoCapture, PhotoGrid } from '../Photos';
import DatePicker from '../DatePicker';
import RepeatPicker, { NO_REPEAT, RepeatBadge, RepeatValue } from '../RepeatPicker';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { api, Dose, fmtTime, Medication, slotOf, todaySG } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, Empty, ErrorText, Field, Icon, Muted, Overline, Row, Segmented, Sheet, s } from '../ui';
import { nameOf, PageHeader, run, ScreenProps, sgDayOf } from './shared';

export function DoseRow({ d, props, big, setError }: { d: Dose; props: ScreenProps; big?: boolean; setError: (e: string | null) => void }) {
  const { data, cid, refresh } = props;
  const taken = d.status === 'taken';
  const med = data.medications.find((m) => m.id === d.medicationId);
  const low = med && med.supply !== null && med.supply <= med.refillAt;
  const locked = !taken && d.status === 'later';
  return (
    <Pressable
      accessibilityRole="checkbox" accessibilityState={{ checked: taken, disabled: locked }} accessibilityLabel={`${d.time} ${d.name}${locked ? `, can be ticked from ${d.time}` : ''}`} disabled={!data.can.logDoses || locked}
      onPress={() => run(() => api.logDose(cid, d.medicationId, d.time, !taken), refresh, setError)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: big ? 16 : 12, borderRadius: 16, backgroundColor: taken ? colors.okSoft : d.status === 'missed' ? colors.dangerSoft : locked ? colors.surfaceAlt : colors.card, borderWidth: 1, borderColor: taken ? colors.okBorder : d.status === 'missed' ? colors.dangerBorder : colors.border, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: big ? 48 : 36, height: big ? 48 : 36, borderRadius: big ? 24 : 18, borderWidth: 2.5, borderColor: taken ? colors.ok : colors.faint, backgroundColor: taken ? colors.ok : colors.card, alignItems: 'center', justifyContent: 'center' }}>
        {taken && <Icon name="checkmark" size={big ? 30 : 22} color="#fff" />}
        {locked && <Icon name="lock-closed" size={big ? 22 : 16} color={colors.faint} />}
      </View>
      {!!med?.fileIds?.length && <Image source={{ uri: api.fileUrl(med.fileIds[0]) }} accessibilityLabel={`Photo of ${d.name}`} style={{ width: big ? 64 : 44, height: big ? 64 : 44, borderRadius: 10, backgroundColor: colors.surfaceAlt2 }} />}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: big ? 24 : 17, fontWeight: '700' }}>{d.name}</Text>
        <Text style={{ fontSize: big ? 19 : 14, color: colors.muted }}>
          {d.time} · {d.dose}{d.instructions ? ` · ${d.instructions}` : ''}{taken ? ` · taken ${fmtTime(d.takenAt)} by ${d.recordedBy}` : ''}
        </Text>
        {locked && <Text style={{ fontSize: big ? 18 : 13, color: colors.faint }}>Can be ticked from {d.time}</Text>}
      </View>
      {!big && (d.status === 'missed' ? <Badge label="Not ticked" tone="bad" /> : d.status === 'due' ? <Badge label="Due now" tone="warn" /> : low && !taken ? <Badge label="Low" tone="warn" /> : null)}
    </Pressable>
  );
}

export function DoseGroups({ props, big, setError }: { props: ScreenProps; big?: boolean; setError: (e: string | null) => void }) {
  const groups = ['Morning', 'Afternoon', 'Evening', 'Night'].map((slot) => ({ slot, doses: props.data.dosesToday.filter((d) => slotOf(d.time) === slot) })).filter((g) => g.doses.length);
  if (!groups.length) return <Empty icon="medkit-outline">No medicines scheduled.</Empty>;
  return (
    <View style={{ gap: 16 }}>
      {groups.map((g) => (
        <View key={g.slot} style={{ gap: 8 }}>
          <Text style={{ fontSize: big ? 22 : 14, fontWeight: '800', color: colors.muted, letterSpacing: big ? 0 : 0.8, textTransform: big ? 'none' : 'uppercase' }}>{g.slot}</Text>
          {g.doses.map((d) => <DoseRow key={`${d.medicationId}${d.time}`} d={d} props={props} big={big} setError={setError} />)}
        </View>
      ))}
    </View>
  );
}

function MedSheet({ cid, refresh, editing, close }: { cid: string; refresh: () => Promise<void>; editing?: Medication; close: () => void }) {
  const [name, setName] = useState(editing?.name || '');
  const [dose, setDose] = useState(editing?.dose || '');
  const [times, setTimes] = useState(editing?.times.join(', ') || '08:00');
  const [instructions, setInstructions] = useState(editing?.instructions || '');
  const [supply, setSupply] = useState(editing?.supply === null || editing?.supply === undefined ? '' : String(editing.supply));
  const [perDose, setPerDose] = useState(String(editing?.perDose ?? 1));
  const [refillAt, setRefillAt] = useState(String(editing?.refillAt ?? 7));
  const [startDate, setStartDate] = useState(editing?.startDate || todaySG());
  const [photos, setPhotos] = useState<Photo[]>(asPhotos(editing?.fileIds));
  const [repeat, setRepeat] = useState<RepeatValue>(editing?.repeat ? { ...editing.repeat, until: editing.repeat.until === '9999-12-31' ? '' : editing.repeat.until } : NO_REPEAT);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const body = { name, dose, times, instructions, supply: supply === '' ? null : Number(supply), perDose: Number(perDose) || 0, refillAt: Number(refillAt) || 0,
      startDate, repeat: repeat.freq === 'none' ? null : repeat, fileIds: photos.map((p) => p.id) };
    if (await run(() => (editing ? api.updateMedication(cid, editing.id, body) : api.addMedication(cid, body)), refresh, setError)) close();
  }
  return (
    <Sheet visible title={editing ? 'Edit medicine' : 'Add medicine'} onClose={close}>
      <Muted>Copy exactly from the pharmacy label. Famhub only records; it gives no dosing advice.</Muted>
      <Field label="Medicine name" value={name} onChange={setName} placeholder="As on the label" />
      <Field label="Dose" value={dose} onChange={setDose} placeholder="1 tablet" />
      <Field label="Times (24-hour, separated by commas)" value={times} onChange={setTimes} placeholder="08:00, 20:00" />
      <Field label="Instructions" value={instructions} onChange={setInstructions} placeholder="After food" />
      <Text style={s.label}>Photo of the medicine, box or pharmacy label (optional)</Text>
      <Muted>Helps the helper and Mum recognise the right tablet.</Muted>
      <PhotoCapture cid={cid} photos={photos} setPhotos={setPhotos} onError={setError} />
      <Overline>Which days</Overline>
      <Muted>"Does not repeat" means every day. Choose Weekly, Monthly and so on for medicines taken only on some days, for example every Monday and Thursday.</Muted>
      <DatePicker label="Starting" value={startDate} onChange={(v) => setStartDate(v || todaySG())} />
      <RepeatPicker start={startDate} value={repeat} onChange={setRepeat} openEnded />
      <Overline>Supply (optional)</Overline>
      <Field label="How many are left now" value={supply} onChange={setSupply} keyboard="numeric" placeholder="30" />
      <Field label="Used per dose" value={perDose} onChange={setPerDose} keyboard="numeric" />
      <Field label="Remind family to refill when this many are left" value={refillAt} onChange={setRefillAt} keyboard="numeric" />
      <ErrorText message={error} />
      <Button label="Save" icon="checkmark" onPress={save} />
      {editing && <Button label="Delete medicine" kind="danger" icon="trash-outline" onPress={async () => { if (await run(() => api.deleteMedication(cid, editing.id), refresh, setError)) close(); }} />}
    </Sheet>
  );
}

export default function CareScreen(props: ScreenProps) {
  const { data, cid, refresh } = props;
  const [view, setView] = useState<'today' | 'schedule'>('today');
  const [sheet, setSheet] = useState<string | null>(null);
  const [refill, setRefill] = useState<{ id: string; amount: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parent = data.circle.parentName;
  const checkedToday = data.lastCheckin && sgDayOf(data.lastCheckin.createdAt) === todaySG();
  const taken = data.dosesToday.filter((d) => d.status === 'taken').length;

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title={data.circle.profile?.careFor === 'kid' || data.circle.profile?.careFor === 'teen' ? 'Health' : 'Care'} subtitle={`${taken} of ${data.dosesToday.length} doses taken today`} right={view === 'schedule' && data.can.editMedications ? <Button icon="add" label="Add" onPress={() => setSheet('new')} /> : undefined} />
      <Segmented value={view} onChange={setView} options={[{ value: 'today', label: 'Today' }, { value: 'schedule', label: 'Medicine list' }]} />
      <ErrorText message={error} />
      {view === 'today' && (
        <>
          {!!data.circle.checkinBy && <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{data.circle.profile?.careFor === 'teen' ? '"Home safe" check-in' : 'Daily check-in'}</Text>
                <Muted>{checkedToday ? `${parent} is OK · ${fmtTime(data.lastCheckin!.createdAt)} (${nameOf(data, data.lastCheckin!.recordedBy)})` : `Expected by ${data.circle.checkinBy}`}</Muted>
              </View>
              {checkedToday ? <Badge label="Done" tone="good" /> : null}
            </Row>
            {data.can.checkIn && (
              <Row>
                {!checkedToday && <Button icon="checkmark-circle" label={`${parent} is OK`} onPress={() => run(() => api.checkin(cid, 'ok'), refresh, setError)} />}
                <Button icon="warning-outline" kind="danger" label="Needs help" onPress={() => run(() => api.checkin(cid, 'help'), refresh, setError)} />
              </Row>
            )}
          </Card>}
          <Muted>Tap a medicine when it has been taken. Tap again to undo. If a dose is not ticked 30 minutes after its time, the family is told.</Muted>
          <DoseGroups props={props} setError={setError} />
        </>
      )}
      {view === 'schedule' && (
        <>
          {!data.medications.length && <Card><Empty icon="medkit-outline">No medicines yet.</Empty></Card>}
          {data.medications.map((m) => {
            const low = m.supply !== null && m.supply <= m.refillAt;
            const daily = (m.perDose || 0) * m.times.length;
            const daysLeft = m.supply !== null && daily ? Math.floor(m.supply / daily) : null;
            return (
              <Card key={m.id} style={!m.active ? { opacity: 0.6 } : undefined}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[s.itemTitle, { flex: 1 }]}>{m.name}</Text>
                  {!m.active ? <Badge label="Stopped" /> : low ? <Badge label="Refill soon" tone="warn" /> : null}
                </Row>
                <Muted>{m.dose} at {m.times.join(', ')}{m.instructions ? ` · ${m.instructions}` : ''}</Muted>
                <RepeatBadge text={m.repeatText || 'Every day'} />
                {!!m.fileIds?.length && <PhotoGrid ids={m.fileIds} height={140} />}
                {m.supply !== null && (
                  <View style={{ gap: 4 }}>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt2, overflow: 'hidden' }}>
                      <View style={{ height: 8, width: `${Math.min(100, (m.supply / Math.max(m.refillAt * 4, 1)) * 100)}%`, backgroundColor: low ? colors.warn : colors.ok }} />
                    </View>
                    <Muted>{m.supply} left{daysLeft !== null ? ` · about ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : ''}</Muted>
                  </View>
                )}
                {data.can.editMedications && (
                  <Row>
                    <Button small kind="secondary" icon="create-outline" label="Edit" onPress={() => setSheet(m.id)} />
                    {m.supply !== null && <Button small kind="secondary" icon="refresh" label="Refilled" onPress={() => setRefill({ id: m.id, amount: '' })} />}
                    <Button small kind="ghost" label={m.active ? 'Stop' : 'Restart'} onPress={() => run(() => api.updateMedication(cid, m.id, { active: !m.active }), refresh, setError)} />
                  </Row>
                )}
                {refill?.id === m.id && (
                  <Row>
                    <View style={{ flex: 1 }}><Field label="How many now?" value={refill.amount} onChange={(v) => setRefill({ id: m.id, amount: v })} keyboard="numeric" /></View>
                    <Button label="Save" onPress={async () => { if (await run(() => api.updateMedication(cid, m.id, { supply: Number(refill.amount), refilled: true }), refresh, setError)) setRefill(null); }} />
                  </Row>
                )}
              </Card>
            );
          })}
        </>
      )}
      {sheet && <MedSheet cid={cid} refresh={refresh} editing={data.medications.find((m) => m.id === sheet)} close={() => setSheet(null)} />}
    </View>
  );
}
