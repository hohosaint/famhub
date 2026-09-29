import { asPhotos, Photo, PhotoCapture, PhotoGrid } from '../Photos';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, Appointment, fmtDate, fmtTime, toLocalInput, todaySG } from '../api';
import { fmt12 } from '../TimeWheel';
import ShareAppointment from '../ShareAppointment';
import HScroll from '../HScroll';
import { VisitSheet } from './VisitsScreen';
import RepeatPicker, { collapseSeries, NO_REPEAT, RepeatBadge, RepeatValue, SeriesDelete, SeriesManager, SeriesScope } from '../RepeatPicker';
import { colors, personColor } from '../theme';
import { Avatar, Badge, Button, Card, Choice, DateField, Empty, ErrorText, Field, Icon, Link, Muted, Overline, Row, Sheet, s } from '../ui';
import { memberOptions, nameOf, PageHeader, run, ScreenProps, sgDayOf, sgTimeOf } from './shared';
import MonthGrid from '../MonthGrid';

const QUICK_TIMES = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

// Default time for a new appointment: 9 am, or the next hour if the day is today.
function defaultTime(day: string) {
  if (day !== todaySG()) return '09:00';
  const h = Number(new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 13)) + 1;
  return `${String(Math.min(Math.max(h, 8), 21)).padStart(2, '0')}:00`;
}

function AppointmentSheet({ data, cid, refresh, editing, open, close, defaultDay, onManage }: ScreenProps & { editing?: Appointment; open: boolean; close: () => void; defaultDay: string; onManage?: (seriesId: string) => void }) {
  const [title, setTitle] = useState(editing?.title || '');
  const [date, setDate] = useState(editing ? toLocalInput(editing.startsAt).slice(0, 10) : defaultDay);
  const [time, setTime] = useState(editing ? toLocalInput(editing.startsAt).slice(11, 16) : defaultTime(defaultDay));
  const [picking, setPicking] = useState(false);
  const [pickMonth, setPickMonth] = useState((editing ? toLocalInput(editing.startsAt) : defaultDay).slice(0, 7));
  const [location, setLocation] = useState(editing?.location || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [escort, setEscort] = useState(editing?.escortUserId || '');
  const [outcome, setOutcome] = useState(editing?.outcome || '');
  const [repeat, setRepeat] = useState<RepeatValue>(NO_REPEAT);
  const [photos, setPhotos] = useState<Photo[]>(asPhotos(editing?.fileIds));
  const [deleting, setDeleting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const past = editing && editing.startsAt < new Date().toISOString();
  // A repeating appointment asks which repeats get the change first.
  const save = () => (editing?.seriesId ? setAsking(true) : doSave(''));
  async function doSave(series: '' | 'later' | 'all') {
    const body = { ...(editing?.seriesId ? { series } : {}), title, startsAt: date && time ? `${date}T${time}:00+08:00` : '', location, notes, escortUserId: escort, fileIds: photos.map((p) => p.id), ...(editing ? { outcome } : repeat.freq !== 'none' ? { repeat } : {}) };
    if (await run(() => (editing ? api.updateAppointment(cid, editing.id, body) : api.addAppointment(cid, body)), refresh, setError)) close();
  }
  return (
    <Sheet visible={open} title={editing ? 'Appointment' : 'New appointment'} onClose={close}>
      <Field label="What is it for?" value={title} onChange={setTitle} placeholder="Polyclinic review" />
      <View style={{ gap: 6 }}>
        <Text style={s.label}>Date</Text>
        <Pressable onPress={() => setPicking(!picking)} accessibilityRole="button" accessibilityLabel={`Date: ${date ? fmtDate(date) : 'not set'}. ${picking ? 'Close' : 'Open'} calendar`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: picking ? colors.primary : colors.border, borderRadius: 12, padding: 12 }}>
          <Icon name="calendar" size={20} color={colors.primary} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700' }}>{date ? fmtDate(date) : 'Tap to choose a date'}</Text>
          <Icon name={picking ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
        </Pressable>
        {picking && (
          <MonthGrid month={pickMonth} onMonthChange={setPickMonth} selected={date} onSelect={(d) => { setDate(d); setPicking(false); }}
            marks={Object.fromEntries(Object.entries(data.appointments.reduce((acc, a) => { const d = sgDayOf(a.startsAt); (acc[d] ||= []).push(a.escortUserId ? personColor(a.escortUserId) : colors.warn); return acc; }, {} as Record<string, string[]>)))} />
        )}
      </View>
      <View style={{ gap: 6 }}>
        <DateField label="Time" value={time} onChange={setTime} timeOnly minuteStep={5} />
        <Row>{QUICK_TIMES.map((t) => <Button key={t} small kind={t === time ? 'primary' : 'ghost'} label={fmt12(t)} onPress={() => setTime(t)} />)}</Row>
      </View>
      {!editing && <RepeatPicker start={date || todaySG()} value={repeat} onChange={setRepeat} />}
      {editing?.repeatText && <RepeatBadge text={editing.repeatText} />}
      <Field label="Where" value={location} onChange={setLocation} placeholder="Clinic, level, room" />
      <Field label="Notes" value={notes} onChange={setNotes} placeholder="What to bring, questions for the doctor" multiline />
      <Text style={s.label}>Photo of the appointment card or referral letter (optional)</Text>
      <PhotoCapture cid={cid} photos={photos} setPhotos={setPhotos} onError={setError} />
      <Choice label="Who will go?" value={escort} onChange={setEscort} options={[{ value: '', label: 'Escort needed' }, ...memberOptions(data)]} />
      {past && <Field label="Visit outcome: what did the doctor say?" value={outcome} onChange={setOutcome} multiline />}
      <ErrorText message={error} />
      <Button label="Save" icon="checkmark" onPress={() => save()} />
      {asking && <SeriesScope what="appointment" close={() => setAsking(false)} onPick={(scope) => { setAsking(false); doSave(scope); }} />}
      {editing && <Button label="Delete appointment" kind="danger" icon="trash-outline" onPress={async () => { if (editing.seriesId) { setDeleting(true); return; } if (await run(() => api.deleteAppointment(cid, editing.id), refresh, setError)) close(); }} />}
      {deleting && editing && <SeriesDelete what="appointment" close={() => setDeleting(false)} onChoose={editing.seriesId && onManage ? () => onManage(editing.seriesId!) : undefined} onDelete={async (series) => { if (await run(() => api.deleteAppointment(cid, editing.id, series), refresh, setError)) close(); }} />}
    </Sheet>
  );
}

function ApptCard({ a, props, onOpen, setError, onManage }: { a: Appointment; props: ScreenProps; onOpen: () => void; setError: (e: string | null) => void; onManage?: (seriesId: string) => void }) {
  const { data, cid, refresh } = props;
  const color = a.escortUserId ? personColor(a.escortUserId) : colors.warn;
  const [sharing, setSharing] = useState(false);
  const [visitFor, setVisitFor] = useState(false);
  return (
    <>
    {sharing && <ShareAppointment a={a} data={data} cid={cid} close={() => setSharing(false)} />}
    {visitFor && <VisitSheet {...props} fromAppointment={a} close={() => setVisitFor(false)} />}
    <Card onPress={props.data.can.editAppointments ? onOpen : undefined} style={{ flexDirection: 'row', gap: 12, paddingLeft: 12 }}>
      <View style={{ width: 4, borderRadius: 2, backgroundColor: color }} />
      <View style={{ width: 54 }}>
        <Text style={{ fontSize: 16, fontWeight: '800' }}>{fmtTime(a.startsAt)}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Text style={[s.itemTitle, { flex: 1 }]}>{a.title}</Text>
          <Pressable onPress={() => setSharing(true)} accessibilityRole="button" accessibilityLabel={`Share ${a.title}`} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 14, backgroundColor: colors.primarySoft }}>
            <Icon name="share-outline" size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Share</Text>
          </Pressable>
        </Row>
        <RepeatBadge text={a.repeatText} onPress={a.seriesId && onManage && data.can.editAppointments ? () => onManage(a.seriesId!) : undefined} />
        {!!a.location && <Row><Icon name="location-outline" size={15} color={colors.muted} /><Muted>{a.location}</Muted></Row>}
        {!!a.notes && <Muted>{a.notes}</Muted>}
        {!!a.fileIds?.length && <PhotoGrid ids={a.fileIds} height={140} />}
        {data.can.seeVisits && a.startsAt < new Date().toISOString() && (() => {
          const v = data.visits.find((x) => x.appointmentId === a.id);
          if (v) return <Button small kind="secondary" icon="clipboard-outline" label="View visit notes" onPress={() => props.go('visits')} />;
          return data.can.editVisits ? <Button small kind="secondary" icon="create-outline" label="Add visit notes" onPress={() => setVisitFor(true)} /> : null;
        })()}
        {!!a.outcome && <Text style={{ fontSize: 15 }}><Text style={{ fontWeight: '700' }}>Outcome: </Text>{a.outcome}</Text>}
        {a.escortUserId ? (
          <Row><Avatar id={a.escortUserId} name={nameOf(data, a.escortUserId)} size={24} /><Muted>{nameOf(data, a.escortUserId)} is going</Muted></Row>
        ) : (
          <Row>
            <Badge label="Escort needed" tone="warn" />
            {data.role !== 'parent' && a.startsAt > new Date().toISOString() && <Button small label="I'll go" onPress={() => run(() => api.updateAppointment(cid, a.id, { escortUserId: data.me.userId }), refresh, setError)} />}
          </Row>
        )}
      </View>
    </Card>
    </>
  );
}

export default function CalendarScreen(props: ScreenProps) {
  const { data, cid, refresh } = props;
  const [day, setDay] = useState(todaySG());
  const [sheet, setSheet] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);   // seriesId
  const [monthView, setMonthView] = useState(false);
  const [month, setMonth] = useState(todaySG().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const marks = data.appointments.reduce((acc, a) => { const d = sgDayOf(a.startsAt); (acc[d] ||= []).push(a.escortUserId ? personColor(a.escortUserId) : colors.warn); return acc; }, {} as Record<string, string[]>);
  const days = Array.from({ length: 21 }, (_, i) => new Date(Date.now() + 8 * 3600e3 + i * 86400e3).toISOString().slice(0, 10));
  const onDay = data.appointments.filter((a) => sgDayOf(a.startsAt) === day);
  // Coming up: repeating appointments show once (the next one).
  const upcoming = collapseSeries(data.appointments.filter((a) => sgDayOf(a.startsAt) > day).sort((x, y) => x.startsAt.localeCompare(y.startsAt))).map((r) => r.item).slice(0, 12);
  const past = data.appointments.filter((a) => a.startsAt < new Date().toISOString() && sgDayOf(a.startsAt) < todaySG()).reverse().slice(0, 8);
  const editing = data.appointments.find((a) => a.id === sheet);

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Calendar" subtitle="Colour shows who is going" right={data.can.editAppointments ? <Button icon="add" label="Add" onPress={() => setSheet('new')} /> : undefined} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>{fmtDate(day)}</Text>
        <Row>
          {day !== todaySG() && <Button small kind="ghost" label="Today" onPress={() => { setDay(todaySG()); setMonth(todaySG().slice(0, 7)); }} />}
          <Button small kind={monthView ? 'primary' : 'secondary'} icon="calendar-outline" label={monthView ? 'Day strip' : 'Month'} onPress={() => { setMonth(day.slice(0, 7)); setMonthView(!monthView); }} />
        </Row>
      </Row>
      {monthView && <MonthGrid month={month} onMonthChange={setMonth} selected={day} onSelect={setDay} marks={marks} />}
      {!monthView && <HScroll gap={8}>
        {days.map((d) => {
          const has = data.appointments.filter((a) => sgDayOf(a.startsAt) === d);
          const on = d === day;
          const dt = new Date(`${d}T12:00:00+08:00`);
          return (
            <Pressable key={d} onPress={() => setDay(d)} accessibilityRole="button" accessibilityLabel={fmtDate(d)} style={{ width: 56, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 4, backgroundColor: on ? colors.primary : colors.card, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#fff' : colors.muted }}>{dt.toLocaleDateString('en-SG', { weekday: 'short', timeZone: 'Asia/Singapore' }).toUpperCase()}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: on ? '#fff' : colors.text }}>{dt.getUTCDate()}</Text>
              <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
                {has.slice(0, 3).map((a) => <View key={a.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? '#fff' : a.escortUserId ? personColor(a.escortUserId) : colors.warn }} />)}
              </View>
            </Pressable>
          );
        })}
      </HScroll>}
      <ErrorText message={error} />
      <Overline>{day === todaySG() ? 'Today' : fmtDate(day)}</Overline>
      {!onDay.length && <Card><Empty icon="calendar-clear-outline">No appointments on this day.</Empty></Card>}
      {onDay.map((a) => <ApptCard key={a.id} a={a} props={props} onOpen={() => setSheet(a.id)} setError={setError} onManage={setManaging} />)}
      {upcoming.length > 0 && <Overline>Coming up</Overline>}
      {upcoming.map((a) => (
        <View key={a.id} style={{ gap: 6 }}>
          <Muted>{fmtDate(sgDayOf(a.startsAt))}</Muted>
          <ApptCard a={a} props={props} onOpen={() => setSheet(a.id)} setError={setError} onManage={setManaging} />
        </View>
      ))}
      {past.length > 0 && <Overline>Past visits</Overline>}
      {past.map((a) => (
        <Card key={a.id} onPress={data.can.editAppointments ? () => setSheet(a.id) : undefined}>
          <Row style={{ justifyContent: 'space-between' }}><Text style={s.itemTitle}>{a.title}</Text><Muted>{fmtDate(sgDayOf(a.startsAt))}</Muted></Row>
          {a.outcome ? <Text style={{ fontSize: 15 }}>{a.outcome}</Text> : data.can.editAppointments ? <Link label="Add what the doctor said" onPress={() => setSheet(a.id)} /> : null}
        </Card>
      ))}
      {sheet && <AppointmentSheet {...props} key={sheet} editing={editing} open defaultDay={day < todaySG() ? todaySG() : day} close={() => setSheet(null)} onManage={(id) => { setSheet(null); setManaging(id); }} />}
      {managing && (() => {
        const all = data.appointments.filter((x) => x.seriesId === managing).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
        if (!all.length) return null;
        return <SeriesManager what="appointment" title={all[0].title} rule={all[0].repeatText} close={() => setManaging(null)}
          rows={all.map((x) => ({ id: x.id, day: sgDayOf(x.startsAt), label: `${fmtDate(sgDayOf(x.startsAt))}, ${fmtTime(x.startsAt)}` }))}
          onDelete={(ids) => run(() => api.deleteRepeats(cid, 'appointment', ids), refresh, setError)} />;
      })()}
    </View>
  );
}
