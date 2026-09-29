import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, fmtAgo, fmtDate, Visit, VisitType } from '../api';
import DatePicker from '../DatePicker';
import { Attachment, AttachmentList, AttachmentPicker } from '../Photos';
import { colors } from '../theme';
import { TimeField } from '../TimeWheel';
import { Avatar, Badge, Button, Card, Choice, Empty, ErrorText, Field, Icon, IconName, Muted, Row, Sheet, s } from '../ui';
import { nameOf, run, ScreenProps, sgDayOf } from './shared';

export const VISIT_TYPES: { value: VisitType; label: string; icon: IconName; color: string }[] = [
  { value: 'doctor', label: 'Doctor', icon: 'medkit-outline', color: '#2563EB' },
  { value: 'dentist', label: 'Dentist', icon: 'happy-outline', color: '#0891B2' },
  { value: 'physio', label: 'Physio', icon: 'walk-outline', color: '#16A34A' },
  { value: 'therapy', label: 'Therapy', icon: 'chatbubble-ellipses-outline', color: '#9333EA' },
  { value: 'specialist', label: 'Specialist', icon: 'pulse-outline', color: '#DC2626' },
  { value: 'other', label: 'Other', icon: 'clipboard-outline', color: '#6B7280' },
];
const typeOf = (t: VisitType) => VISIT_TYPES.find((x) => x.value === t) || VISIT_TYPES[5];

// Guess the kind of visit from an appointment title.
export function guessType(title: string): VisitType {
  const t = title.toLowerCase();
  if (/dent|teeth|tooth/.test(t)) return 'dentist';
  if (/physio|rehab|exercise/.test(t)) return 'physio';
  if (/therap|counsel|speech|occupational|psych/.test(t)) return 'therapy';
  if (/eye|cardio|heart|specialist|ortho|neuro|renal|kidney|ent\b|skin|derma/.test(t)) return 'specialist';
  return 'doctor';
}

// Add or edit visit notes: what was said, what to do next, medicine changes, follow-up, photos and files.
export function VisitSheet({ data, cid, refresh, editing, fromAppointment, close }: ScreenProps & {
  editing?: Visit; fromAppointment?: { id: string; title: string; startsAt: string; location: string }; close: () => void;
}) {
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const [type, setType] = useState<VisitType>(editing?.type || (fromAppointment ? guessType(fromAppointment.title) : 'doctor'));
  const [provider, setProvider] = useState(editing?.provider || fromAppointment?.location || '');
  const [date, setDate] = useState(editing?.date || (fromAppointment ? sgDayOf(fromAppointment.startsAt) : today));
  const [time, setTime] = useState(editing?.time || (fromAppointment ? new Date(new Date(fromAppointment.startsAt).getTime() + 8 * 3600e3).toISOString().slice(11, 16) : ''));
  const [summary, setSummary] = useState(editing?.summary || '');
  const [instructions, setInstructions] = useState(editing?.instructions || '');
  const [medChanges, setMedChanges] = useState(editing?.medChanges || '');
  const [followUpDate, setFollowUpDate] = useState(editing?.followUpDate || '');
  const [followUpTime, setFollowUpTime] = useState('09:00');
  const [addFollowUp, setAddFollowUp] = useState(true);
  const [files, setFiles] = useState<Attachment[]>(editing?.files || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    const body = {
      type, provider, date, time, summary, instructions, medChanges, followUpDate, fileIds: files.map((f) => f.id),
      ...(editing ? {} : { appointmentId: fromAppointment?.id || '', addFollowUp: !!followUpDate && addFollowUp, followUpTime }),
    };
    const ok = await run(() => (editing ? api.updateVisit(cid, editing.id, body) : api.addVisit(cid, body)), refresh, setError);
    setBusy(false);
    if (ok) close();
  }

  return (
    <Sheet visible title={editing ? 'Edit visit notes' : 'Visit notes'} onClose={close}>
      {fromAppointment && <Muted>For the appointment "{fromAppointment.title}" on {fmtDate(sgDayOf(fromAppointment.startsAt))}.</Muted>}
      <Choice label="Who was the visit with?" value={type} onChange={setType} options={VISIT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
      <Field label="Name and clinic" value={provider} onChange={setProvider} placeholder="Dr Tan, Bukit Merah Polyclinic" />
      <DatePicker label="Date of the visit" value={date} onChange={(v) => setDate(v || today)} />
      <TimeField label="Time (optional)" value={time} onChange={setTime} minuteStep={5} optional labelStyle={s.label} />
      <Field label="What did they say?" value={summary} onChange={setSummary} multiline placeholder="Findings, test results, how Mum is doing" />
      <Field label="What to do next" value={instructions} onChange={setInstructions} multiline placeholder="Exercises, diet, things to watch for" />
      <Field label="Medicine changes" value={medChanges} onChange={setMedChanges} multiline placeholder="New, stopped or changed doses (copy from the prescription)" />
      <DatePicker label="Follow-up date (optional)" value={followUpDate} onChange={setFollowUpDate} optional minDate={today} />
      {!!followUpDate && !editing && (
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setAddFollowUp(!addFollowUp)} accessibilityRole="checkbox" accessibilityState={{ checked: addFollowUp }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: addFollowUp ? colors.primary : colors.faint, backgroundColor: addFollowUp ? colors.primary : colors.card, alignItems: 'center', justifyContent: 'center' }}>{addFollowUp && <Icon name="checkmark" size={16} color="#fff" />}</View>
            <Text style={{ fontSize: 15, color: colors.text }}>Add the follow-up to the calendar</Text>
          </Pressable>
          {addFollowUp && <TimeField label="Follow-up time" value={followUpTime} onChange={setFollowUpTime} minuteStep={5} labelStyle={s.label} />}
        </View>
      )}
      <Text style={s.label}>Photos, documents and files</Text>
      <Muted>For example the memo, prescription, referral letter, X-ray report or exercise sheet.</Muted>
      <AttachmentPicker cid={cid} items={files} setItems={setFiles} onError={setError} />
      <ErrorText message={error} />
      <Button icon="checkmark" label={busy ? 'Saving...' : 'Save visit notes'} disabled={busy} onPress={save} />
    </Sheet>
  );
}

function VisitCard({ v, props, onEdit }: { v: Visit; props: ScreenProps; onEdit: () => void }) {
  const { data, cid, refresh } = props;
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = typeOf(v.type);
  const canDelete = data.role === 'owner' || v.createdBy === data.me.userId;
  const block = (label: string, value: string, icon: IconName) => !!value && (
    <View style={{ gap: 2 }}>
      <Row style={{ gap: 6 }}><Icon name={icon} size={16} color={colors.muted} /><Text style={{ fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text></Row>
      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.text }}>{value}</Text>
    </View>
  );
  return (
    <Card>
      <Row style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${t.color}1A`, alignItems: 'center', justifyContent: 'center' }}><Icon name={t.icon} size={22} color={t.color} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Row style={{ gap: 6 }}><Badge label={t.label} /><Text style={{ fontSize: 13, color: colors.muted }}>{fmtDate(v.date)}{v.time ? `, ${v.time}` : ''}</Text></Row>
          {!!v.provider && <Text style={s.itemTitle}>{v.provider}</Text>}
          <Muted>Notes by {nameOf(data, v.createdBy)}</Muted>
        </View>
        {data.can.editVisits && <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit visit notes" style={{ padding: 6 }}><Icon name="create-outline" size={20} color={colors.primary} /></Pressable>}
        {canDelete && <Pressable onPress={() => run(() => api.deleteVisit(cid, v.id), refresh, setError)} accessibilityRole="button" accessibilityLabel="Delete visit notes" style={{ padding: 6 }}><Icon name="trash-outline" size={20} color={colors.faint} /></Pressable>}
      </Row>
      {block('What they said', v.summary, 'chatbox-ellipses-outline')}
      {block('What to do next', v.instructions, 'list-outline')}
      {block('Medicine changes', v.medChanges, 'medkit-outline')}
      {!!v.followUpDate && <Row style={{ gap: 6 }}><Icon name="calendar-outline" size={16} color={colors.primary} /><Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>Follow-up {fmtDate(v.followUpDate)}</Text></Row>}
      {!!v.files?.length && <AttachmentList files={v.files} />}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 8 }}>
        {(v.comments || []).map((c) => (
          <Row key={c.id} style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <Avatar id={c.userId} name={nameOf(data, c.userId)} size={26} />
            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 10 }}>
              <Text style={{ fontWeight: '700', fontSize: 14 }}>{nameOf(data, c.userId)} <Text style={[s.small, { fontWeight: '400' }]}>· {fmtAgo(c.createdAt)}</Text></Text>
              <Text style={{ fontSize: 15 }}>{c.text}</Text>
            </View>
          </Row>
        ))}
        <Row style={{ flexWrap: 'nowrap' }}>
          <TextInput value={reply} onChangeText={setReply} placeholder="Add a comment or question" placeholderTextColor={colors.faint} accessibilityLabel="Comment on this visit" style={[s.input, { flex: 1, paddingVertical: 10 }]} />
          <Button small icon="send" label="" onPress={async () => { if (reply.trim() && (await run(() => api.commentVisit(cid, v.id, reply), refresh, setError))) setReply(''); }} />
        </Row>
      </View>
      <ErrorText message={error} />
    </Card>
  );
}

// Visit notes: after the doctor, dentist, physio, therapy and other visits.
export default function VisitsScreen(props: ScreenProps) {
  const { data } = props;
  const [filter, setFilter] = useState<'all' | VisitType>('all');
  const [sheet, setSheet] = useState<Visit | 'new' | null>(null);
  const [fromAppt, setFromAppt] = useState<{ id: string; title: string; startsAt: string; location: string } | undefined>(undefined);
  const now = new Date().toISOString();
  const noted = new Set(data.visits.map((v) => v.appointmentId).filter(Boolean));
  const needNotes = data.appointments.filter((a) => a.startsAt < now && !noted.has(a.id) && a.startsAt > new Date(Date.now() - 30 * 86400e3).toISOString()).slice(-3).reverse();
  const shown = data.visits.filter((v) => filter === 'all' || v.type === filter);

  if (!data.can.seeVisits) return <Card><Empty icon="lock-closed-outline">Visit notes are for family and the helper.</Empty></Card>;
  return (
    <View style={{ gap: 14 }}>
      <Muted>Notes after each visit to the doctor, dentist, physio or therapist: what was said, what to do next, medicine changes, and photos of memos, prescriptions and letters. Everyone can comment.</Muted>
      {data.can.editVisits && <Button icon="add" label="Add visit notes" onPress={() => { setFromAppt(undefined); setSheet('new'); }} />}
      {data.can.editVisits && needNotes.length > 0 && (
        <Card style={{ gap: 8, backgroundColor: colors.warnSoft, borderColor: colors.warnBorder }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.warnText }}>Recent appointments without notes</Text>
          {needNotes.map((a) => (
            <Row key={a.id} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Text style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>{a.title} · {fmtDate(sgDayOf(a.startsAt))}</Text>
              <Button small kind="secondary" icon="create-outline" label="Add notes" onPress={() => { setFromAppt(a); setSheet('new'); }} />
            </Row>
          ))}
        </Card>
      )}
      <Choice value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${data.visits.length})` }, ...VISIT_TYPES.filter((t) => data.visits.some((v) => v.type === t.value)).map((t) => ({ value: t.value, label: t.label }))]} />
      {!shown.length && <Card><Empty icon="clipboard-outline">No visit notes yet.</Empty></Card>}
      {shown.map((v) => <VisitCard key={v.id} v={v} props={props} onEdit={() => setSheet(v)} />)}
      {sheet && <VisitSheet {...props} editing={sheet === 'new' ? undefined : sheet} fromAppointment={sheet === 'new' ? fromAppt : undefined} close={() => setSheet(null)} />}
    </View>
  );
}
