import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, fmtTime, Medication } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, Empty, ErrorText, Field, Link, Muted, Row, s, Title } from '../ui';
import { run, ScreenProps } from './shared';

export function DoseList({ data, cid, refresh, big }: ScreenProps & { big?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  if (!data.dosesToday.length) return <Empty>No medicines scheduled.</Empty>;
  return (
    <View style={{ gap: 10 }}>
      {data.dosesToday.map((d) => {
        const taken = d.status === 'taken';
        return (
          <Pressable
            key={`${d.medicationId}${d.time}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: taken }}
            disabled={!data.can.logDoses}
            onPress={() => run(() => api.logDose(cid, d.medicationId, d.time, !taken), refresh, setError)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: big ? 14 : 8, borderRadius: 10, backgroundColor: taken ? '#ECFDF3' : d.status === 'missed' ? '#FEF3F2' : '#fff', borderWidth: 1, borderColor: colors.border }}
          >
            <View style={{ width: big ? 40 : 28, height: big ? 40 : 28, borderRadius: 8, borderWidth: 2, borderColor: colors.ok, backgroundColor: taken ? colors.ok : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {taken && <Text style={{ color: '#fff', fontWeight: '800', fontSize: big ? 24 : 16 }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: big ? 24 : 17, fontWeight: '600' }}>{d.time} · {d.name}</Text>
              <Text style={{ fontSize: big ? 20 : 15, color: colors.muted }}>
                {d.dose}{d.instructions ? `, ${d.instructions}` : ''}
                {taken ? ` · taken ${fmtTime(d.takenAt)} (${d.recordedBy})` : ''}
              </Text>
            </View>
            {!big && (d.status === 'missed' ? <Badge label="Not ticked" tone="bad" /> : d.status === 'due' ? <Badge label="Due now" tone="warn" /> : null)}
          </Pressable>
        );
      })}
      <ErrorText message={error} />
    </View>
  );
}

function MedForm({ cid, refresh, editing, done }: { cid: string; refresh: () => Promise<void>; editing?: Medication; done: () => void }) {
  const [name, setName] = useState(editing?.name || '');
  const [dose, setDose] = useState(editing?.dose || '');
  const [times, setTimes] = useState(editing?.times.join(', ') || '08:00');
  const [instructions, setInstructions] = useState(editing?.instructions || '');
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const body = { name, dose, times, instructions };
    if (await run(() => (editing ? api.updateMedication(cid, editing.id, body) : api.addMedication(cid, body)), refresh, setError)) done();
  }
  return (
    <Card>
      <Title>{editing ? 'Edit medicine' : 'Add medicine'}</Title>
      <Muted>Copy exactly from the pharmacy label. The app only records; it gives no dosing advice.</Muted>
      <Field label="Medicine name" value={name} onChange={setName} placeholder="As on the label" />
      <Field label="Dose" value={dose} onChange={setDose} placeholder="1 tablet" />
      <Field label="Times (24-hour, separated by commas)" value={times} onChange={setTimes} placeholder="08:00, 20:00" />
      <Field label="Instructions" value={instructions} onChange={setInstructions} placeholder="After food" />
      <ErrorText message={error} />
      <Row><Button label="Save" onPress={save} /><Button label="Cancel" kind="secondary" onPress={done} /></Row>
    </Card>
  );
}

export default function MedsScreen(props: ScreenProps) {
  const { data, cid, refresh } = props;
  const [mode, setMode] = useState<string>('list');
  const [error, setError] = useState<string | null>(null);
  const edit = data.can.editMedications;
  if (mode === 'add') return <MedForm cid={cid} refresh={refresh} done={() => setMode('list')} />;
  const editing = data.medications.find((m) => m.id === mode);
  if (editing) return <MedForm cid={cid} refresh={refresh} editing={editing} done={() => setMode('list')} />;

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Title>Today</Title>
        <Muted>Tap a dose when it has been taken. Tap again to undo.</Muted>
        <DoseList {...props} />
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>Schedule</Title>
        {edit && <Button label="+ Add medicine" onPress={() => setMode('add')} />}
      </Row>
      <ErrorText message={error} />
      {!data.medications.length && <Empty>No medicines yet.</Empty>}
      {data.medications.map((m) => (
        <Card key={m.id} style={m.active ? undefined : { opacity: 0.6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={s.itemTitle}>{m.name}</Text>
            {!m.active && <Badge label="Stopped" />}
          </Row>
          <Muted>{m.dose} at {m.times.join(', ')}{m.instructions ? ` · ${m.instructions}` : ''}</Muted>
          {edit && (
            <Row>
              <Link label="Edit" onPress={() => setMode(m.id)} />
              <Link label={m.active ? 'Stop' : 'Restart'} onPress={() => run(() => api.updateMedication(cid, m.id, { active: !m.active }), refresh, setError)} />
              <Link label="Delete" danger onPress={() => run(() => api.deleteMedication(cid, m.id), refresh, setError)} />
            </Row>
          )}
        </Card>
      ))}
    </View>
  );
}
