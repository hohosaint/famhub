import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, fmtDate, fmtTime } from '../api';
import { RepeatBadge, SeriesManager } from '../RepeatPicker';
import { colors } from '../theme';
import { Button, Card, Empty, ErrorText, Icon, Muted, Overline, Row, s } from '../ui';
import { run, ScreenProps, sgDayOf } from './shared';

// Every repeating request, appointment and medicine in one place, with Manage (tick dates to delete).
export default function RepeatsScreen(props: ScreenProps) {
  const { data, cid, refresh, go } = props;
  const [managing, setManaging] = useState<{ kind: 'task' | 'appointment'; seriesId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const me = data.me.userId;
  const manager = data.role === 'owner' || data.role === 'family';

  const group = <T extends { seriesId?: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) if (x.seriesId) m.set(x.seriesId, [...(m.get(x.seriesId) || []), x]);
    return [...m.entries()];
  };
  const taskSeries = group(data.tasks).map(([id, xs]) => ({ id, xs: xs.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')) }));
  const apptSeries = group(data.appointments).map(([id, xs]) => ({ id, xs: xs.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }));
  const meds = data.medications.filter((m) => m.repeat && m.active);

  const card = (key: string, icon: any, title: string, rule: string | undefined, info: string, canManage: boolean, onManage: () => void) => (
    <Card key={key}>
      <Row style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={colors.primary} /></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.itemTitle}>{title}</Text>
          <RepeatBadge text={rule} />
          <Muted>{info}</Muted>
        </View>
      </Row>
      {canManage && <Button small kind="secondary" icon="checkbox-outline" label="Manage repeats" onPress={onManage} />}
    </Card>
  );

  return (
    <View style={{ gap: 14 }}>
      <Muted>Everything that repeats. Use Manage repeats to tick dates and delete them, or delete a whole series.</Muted>
      <ErrorText message={error} />
      <Overline>Requests</Overline>
      {!taskSeries.length && <Card><Empty icon="repeat">No repeating requests.</Empty></Card>}
      {taskSeries.map(({ id, xs }) => {
        const next = xs.find((x) => x.status !== 'done' && (x.dueDate || '') >= today);
        return card(id, 'hand-left-outline', xs[0].title, xs[0].repeatText,
          `${xs.length} dates · ${xs.filter((x) => x.status === 'done').length} done${next ? ` · next ${fmtDate(next.dueDate)}` : ''}`,
          manager || xs[0].createdBy === me, () => setManaging({ kind: 'task', seriesId: id }));
      })}
      <Overline>Appointments</Overline>
      {!apptSeries.length && <Card><Empty icon="repeat">No repeating appointments.</Empty></Card>}
      {apptSeries.map(({ id, xs }) => {
        const next = xs.find((x) => sgDayOf(x.startsAt) >= today);
        return card(id, 'calendar-outline', xs[0].title, xs[0].repeatText,
          `${xs.length} dates${next ? ` · next ${fmtDate(sgDayOf(next.startsAt))}, ${fmtTime(next.startsAt)}` : ''}`,
          data.can.editAppointments, () => setManaging({ kind: 'appointment', seriesId: id }));
      })}
      <Overline>Medicines</Overline>
      {!meds.length && <Card><Empty icon="repeat">All medicines are taken every day.</Empty></Card>}
      {meds.map((m) => card(m.id, 'medkit-outline', m.name, m.repeatText, `${m.dose} at ${m.times.join(', ')} · change or stop it in Care > Medicine list`, data.can.editMedications, () => go('care')))}

      {managing && (() => {
        if (managing.kind === 'task') {
          const all = taskSeries.find((x) => x.id === managing.seriesId)?.xs || [];
          if (!all.length) return null;
          return <SeriesManager what="request" title={all[0].title} rule={all[0].repeatText} close={() => setManaging(null)}
            rows={all.map((x) => ({ id: x.id, day: x.dueDate, label: `${fmtDate(x.dueDate)}${x.dueTime ? ` ${x.dueTime}` : ''}`, done: x.status === 'done' }))}
            onDelete={(ids) => run(() => api.deleteRepeats(cid, 'task', ids), refresh, setError)} />;
        }
        const all = apptSeries.find((x) => x.id === managing.seriesId)?.xs || [];
        if (!all.length) return null;
        return <SeriesManager what="appointment" title={all[0].title} rule={all[0].repeatText} close={() => setManaging(null)}
          rows={all.map((x) => ({ id: x.id, day: sgDayOf(x.startsAt), label: `${fmtDate(sgDayOf(x.startsAt))}, ${fmtTime(x.startsAt)}` }))}
          onDelete={(ids) => run(() => api.deleteRepeats(cid, 'appointment', ids), refresh, setError)} />;
      })()}
    </View>
  );
}
