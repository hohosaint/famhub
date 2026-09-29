import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, Baby, fmtTime, RoutineDone, RoutineItem, RoutineKind, Task, todaySG } from '../api';
import { colors } from '../theme';
import { Avatar, Button, Card, Choice, DateField, Empty, ErrorText, Field, Icon, IconName, Muted, Overline, PhotoAvatar, Row, Sheet } from '../ui';
import { nameOf, run, ScreenProps } from './shared';

// Infants (4.9): one simple page for the day. The routine (feeds, meals, naps, bath, vitamins) is ticked off by
// whoever does it, usually the helper, and the short to-do list sits underneath. Details live in More.

export const KIND_ICON: Record<RoutineKind, { icon: IconName; color: string; label: string }> = {
  milk: { icon: 'water', color: '#2563EB', label: 'Milk' },
  meal: { icon: 'restaurant', color: '#F97316', label: 'Meal' },
  nap: { icon: 'moon', color: '#7C3AED', label: 'Nap' },
  bath: { icon: 'sparkles', color: '#0EA5E9', label: 'Bath' },
  medicine: { icon: 'medkit', color: '#DC2626', label: 'Medicine or vitamins' },
  play: { icon: 'happy', color: '#16A34A', label: 'Play' },
  other: { icon: 'ellipse', color: '#64748B', label: 'Other' },
};
const EATEN = [{ value: 'all', label: 'All' }, { value: 'most', label: 'Most' }, { value: 'some', label: 'Some' }, { value: 'little', label: 'A little' }];
const nowHM = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 16);

export function routineToday(data: ScreenProps['data']) {
  const b = data.baby!;
  const today = todaySG();
  const done = b.routineDone.filter((d) => d.day === today);
  const doneOf = (r: RoutineItem) => done.filter((d) => d.itemId === r.id);
  const hm = nowHM();
  const open = b.routine.filter((r) => !doneOf(r).length);
  const next = open.find((r) => r.time >= hm) || null;
  const late = open.filter((r) => r.time < hm && r.time >= '05:00');
  return { done, doneOf, next, late, hm, total: b.routine.length, count: b.routine.filter((r) => doneOf(r).length).length };
}

// Ticking an item: milk asks how much each baby drank; meals ask how much was eaten; everything else ticks at once.
function TickSheet({ data, cid, item, onClose, refresh }: { data: ScreenProps['data']; cid: string; item: RoutineItem; onClose: () => void; refresh: () => Promise<void> }) {
  const babies = data.baby!.babies;
  const [who, setWho] = useState<string[]>(babies.map((b) => b.id));
  const [ml, setMl] = useState<Record<string, number>>(Object.fromEntries(babies.map((b) => [b.id, item.ml || 120])));
  const [eaten, setEaten] = useState('all');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const k = KIND_ICON[item.kind];
  const save = async () => {
    if (await run(() => api.tickRoutine(cid, item.id, { babyIds: who, amounts: item.kind === 'milk' ? Object.fromEntries(who.map((id) => [id, ml[id]])) : undefined, eaten, note }), refresh, setError)) onClose();
  };
  return (
    <Sheet visible title={`${item.time} ${item.title}`} onClose={onClose}>
      <View style={{ gap: 14 }}>
        {!!item.detail && <Muted>{item.detail}</Muted>}
        {babies.length > 1 && (
          <View style={{ gap: 6 }}>
            <Overline>For</Overline>
            <Row>
              {babies.map((b) => {
                const on = who.includes(b.id);
                return (
                  <Pressable key={b.id} onPress={() => setWho(on ? who.filter((x) => x !== b.id) : [...who, b.id])} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 2, borderColor: on ? b.color : colors.border, backgroundColor: on ? `${b.color}14` : colors.card }}>
                    <Avatar id={b.id} name={b.name} size={28} /><Text style={{ fontWeight: '800', color: colors.text }}>{b.name}</Text>
                    <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={on ? b.color : colors.faint} />
                  </Pressable>
                );
              })}
            </Row>
          </View>
        )}
        {item.kind === 'milk' && who.map((id) => {
          const b = babies.find((x) => x.id === id)!;
          const set = (v: number) => setMl({ ...ml, [id]: Math.max(10, Math.min(400, v)) });
          return (
            <View key={id} style={{ gap: 6 }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>{babies.length > 1 ? `${b.name} drank` : 'How much?'}</Text>
              <Row style={{ flexWrap: 'nowrap', gap: 10 }}>
                <Button kind="secondary" label="−10" onPress={() => set(ml[id] - 10)} />
                <Text style={{ fontSize: 30, fontWeight: '900', color: k.color, minWidth: 110, textAlign: 'center' }}>{ml[id]} ml</Text>
                <Button kind="secondary" label="+10" onPress={() => set(ml[id] + 10)} />
              </Row>
            </View>
          );
        })}
        {item.kind === 'meal' && (
          <View style={{ gap: 6 }}>
            <Overline>How much was eaten?</Overline>
            <Choice value={eaten} onChange={setEaten} options={EATEN} />
          </View>
        )}
        <Field label="Note (optional)" value={note} onChange={setNote} placeholder={item.kind === 'milk' ? 'Burped well' : item.kind === 'nap' ? 'Slept 1 hour' : ''} />
        <ErrorText message={error} />
        <Button icon="checkmark-circle" label="Done" onPress={save} disabled={!who.length} />
      </View>
    </Sheet>
  );
}

function EditSheet({ data, cid, item, onClose, refresh }: { data: ScreenProps['data']; cid: string; item: RoutineItem | null; onClose: () => void; refresh: () => Promise<void> }) {
  const [time, setTime] = useState(item ? item.time : '09:00');
  const [kind, setKind] = useState<RoutineKind>(item ? item.kind : 'milk');
  const [title, setTitle] = useState(item ? item.title : '');
  const [detail, setDetail] = useState(item ? item.detail : '');
  const [ml, setMl] = useState(item && item.ml ? String(item.ml) : '');
  const [who, setWho] = useState(item ? item.who : (data.members.find((m) => m.role === 'helper')?.userId || ''));
  const [error, setError] = useState<string | null>(null);
  const people = [{ value: '', label: 'Anyone' }, ...data.members.filter((m) => m.role !== 'parent').map((m) => ({ value: m.userId, label: m.name }))];
  const body = { time, kind, title: title || KIND_ICON[kind].label, detail, ml: Number(ml) || 0, who };
  const save = async () => { if (await run(() => (item ? api.updateRoutine(cid, item.id, body) : api.addRoutine(cid, body)), refresh, setError)) onClose(); };
  return (
    <Sheet visible title={item ? 'Change routine item' : 'Add to the routine'} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <DateField label="Time" value={time} onChange={setTime} timeOnly minuteStep={5} />
        <Choice label="What" value={kind} onChange={setKind} options={(Object.keys(KIND_ICON) as RoutineKind[]).map((k) => ({ value: k, label: KIND_ICON[k].label }))} />
        <Field label="Name" value={title} onChange={setTitle} placeholder={KIND_ICON[kind].label} />
        {kind === 'milk' && <Field label="Usual amount (ml)" value={ml} onChange={setMl} placeholder="150" keyboard="numeric" />}
        <Field label={kind === 'meal' ? 'Food' : kind === 'medicine' ? 'Which and how much' : 'Details (optional)'} value={detail} onChange={setDetail} placeholder={kind === 'meal' ? 'Porridge with fish and carrot' : kind === 'medicine' ? 'Vitamin D, 1 drop' : ''} />
        <Choice label="Who does it" value={who} onChange={setWho} options={people} />
        <ErrorText message={error} />
        <Button label="Save" onPress={save} />
        {item && <Button kind="ghost" label="Remove from the routine" onPress={async () => { if (await run(() => api.deleteRoutine(cid, item.id), refresh, setError)) onClose(); }} />}
      </View>
    </Sheet>
  );
}

export function RoutineRow({ data, cid, item, done, next, late, editing, onTick, onEdit, refresh }: {
  data: ScreenProps['data']; cid: string; item: RoutineItem; done: RoutineDone[]; next: boolean; late: boolean; editing?: boolean;
  onTick: (r: RoutineItem) => void; onEdit?: (r: RoutineItem) => void; refresh: () => Promise<void>;
}) {
  const k = KIND_ICON[item.kind];
  const [error, setError] = useState<string | null>(null);
  const isDone = done.length > 0;
  const babies = data.baby!.babies;
  const doneText = done.map((d) => {
    const amounts = Object.entries(d.amounts || {}).map(([id, v]) => `${babies.length > 1 ? `${babies.find((b) => b.id === id)?.name || ''} ` : ''}${v} ml`).join(', ');
    return `${nameOf(data, d.by)} ${fmtTime(d.at)}${amounts ? ` · ${amounts}` : ''}${d.eaten && d.eaten !== 'all' ? ` · ate ${EATEN.find((e) => e.value === d.eaten)?.label.toLowerCase()}` : ''}${d.note ? ` · ${d.note}` : ''}`;
  }).join('; ');
  const canTick = data.can.logDoses && data.role !== 'parent';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 16, backgroundColor: next ? `${k.color}12` : 'transparent', borderWidth: next ? 1.5 : 0, borderColor: `${k.color}55` }}>
      <Text style={{ width: 48, fontSize: 15, fontWeight: '800', color: late && !isDone ? colors.danger : colors.muted }}>{item.time}</Text>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDone ? colors.okSoft : `${k.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={isDone ? 'checkmark' : k.icon} size={20} color={isDone ? colors.ok : k.color} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: isDone ? colors.muted : colors.text }}>{item.title}{item.kind === 'milk' && item.ml ? ` · ${item.ml} ml` : ''}</Text>
        {!!item.detail && <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={2}>{item.detail}</Text>}
        {isDone ? <Text style={{ fontSize: 12, color: colors.ok, fontWeight: '700' }}>Done: {doneText}</Text>
          : <Text style={{ fontSize: 12, color: late ? colors.danger : colors.faint, fontWeight: late ? '700' : '500' }}>{late ? 'Not done yet' : next ? 'Next' : ''}{item.who ? `${late || next ? ' · ' : ''}${nameOf(data, item.who)}` : ''}</Text>}
        <ErrorText message={error} />
      </View>
      {editing && onEdit ? <Button small kind="ghost" icon="create-outline" label="Change" onPress={() => onEdit(item)} />
        : isDone ? (canTick ? <Pressable onPress={() => run(() => api.untickRoutine(cid, done[0].id), refresh, setError)} accessibilityRole="button" accessibilityLabel={`Undo ${item.title}`}><Text style={{ color: colors.muted, fontSize: 13, textDecorationLine: 'underline' }}>Undo</Text></Pressable> : null)
        : canTick ? <Button small kind={next || late ? 'primary' : 'secondary'} icon="checkmark" label="Done" onPress={() => onTick(item)} /> : null}
    </View>
  );
}

export function TickHost({ data, cid, refresh, item, onClose }: { data: ScreenProps['data']; cid: string; refresh: () => Promise<void>; item: RoutineItem | null; onClose: () => void }) {
  return item ? <TickSheet data={data} cid={cid} item={item} onClose={onClose} refresh={refresh} /> : null;
}
// Items that need no amount are ticked straight away.
export function useTick(data: ScreenProps['data'], cid: string, refresh: () => Promise<void>) {
  const [ticking, setTicking] = useState<RoutineItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tick = (r: RoutineItem) => {
    if (r.kind === 'milk' || r.kind === 'meal' || data.baby!.babies.length > 1) setTicking(r);
    else run(() => api.tickRoutine(cid, r.id, {}), refresh, setError);
  };
  return { ticking, setTicking, tick, error };
}

function ToDo({ data, cid, refresh }: ScreenProps) {
  const [title, setTitle] = useState('');
  const helper = data.members.find((m) => m.role === 'helper');
  const [who, setWho] = useState(helper ? helper.userId : '');
  const [error, setError] = useState<string | null>(null);
  const open = data.tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const recent = data.tasks.filter((t) => t.status === 'done' && t.doneAt && t.doneAt > new Date(Date.now() - 86400e3).toISOString());
  const people = [{ value: '', label: 'Anyone' }, ...data.members.filter((m) => m.role !== 'parent').map((m) => ({ value: m.userId, label: m.userId === data.me.userId ? 'Me' : m.name.split(' ')[0] }))];
  const add = async () => {
    if (!title.trim()) return;
    if (await run(() => api.addTask(cid, { title: title.trim(), category: 'errand', dueDate: todaySG(), dueTime: '', assigneeUserId: who } as Partial<Task>), refresh, setError)) setTitle('');
  };
  const row = (t: Task) => (
    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Pressable onPress={() => run(() => api.taskAction(cid, t.id, t.status === 'done' ? 'reopen' : 'done'), refresh, setError)} accessibilityRole="checkbox" accessibilityState={{ checked: t.status === 'done' }} accessibilityLabel={t.title}>
        <Icon name={t.status === 'done' ? 'checkbox' : 'square-outline'} size={26} color={t.status === 'done' ? colors.ok : colors.faint} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: t.status === 'done' ? colors.muted : colors.text, textDecorationLine: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</Text>
        {t.status !== 'done' && t.dueDate && t.dueDate < todaySG() && <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '700' }}>Overdue</Text>}
      </View>
      {t.assigneeUserId ? <Row style={{ gap: 6 }}><Avatar id={t.assigneeUserId} name={nameOf(data, t.assigneeUserId)} size={24} /><Text style={{ fontSize: 13, color: colors.muted }}>{nameOf(data, t.assigneeUserId).split(' ')[0]}</Text></Row> : <Text style={{ fontSize: 13, color: colors.faint }}>Anyone</Text>}
    </View>
  );
  return (
    <Card style={{ gap: 8 }}>
      <Overline>To do</Overline>
      {!open.length && !recent.length && <Muted>Nothing to do. Add a job below, for example "Buy diapers".</Muted>}
      {open.map(row)}
      {recent.map(row)}
      {data.role !== 'parent' && (
        <View style={{ gap: 8, paddingTop: 6 }}>
          <Field label="Add a job" value={title} onChange={setTitle} placeholder="Buy diapers (size M)" onSubmit={add} />
          <Choice value={who} onChange={setWho} options={people} />
          <Button small icon="add" label="Add" onPress={add} disabled={!title.trim()} />
        </View>
      )}
      <ErrorText message={error} />
    </Card>
  );
}

export default function RoutineScreen(props: ScreenProps) {
  const { data, cid, refresh, go } = props;
  const baby = data.baby!;
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<RoutineItem | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const { ticking, setTicking, tick, error: tickError } = useTick(data, cid, refresh);
  const t = routineToday(data);
  const canEdit = data.role !== 'parent';
  const photo = (b: Baby) => (canEdit
    ? <PhotoAvatar key={b.id} id={b.id} name={b.name} size={64} onUpload={async (f) => { await api.uploadCirclePhoto(cid, b.id, f); await refresh(); }} onRemove={async () => { await api.removeCirclePhoto(cid, b.id); await refresh(); }} />
    : <Avatar key={b.id} id={b.id} name={b.name} size={64} />);
  const pct = t.total ? Math.round((t.count / t.total) * 100) : 0;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 12 }}>
        <Row style={{ gap: 16, alignItems: 'flex-start' }}>
          {baby.babies.map((b) => (
            <View key={b.id} style={{ alignItems: 'center', gap: 4 }}>
              {photo(b)}
              <Text style={{ fontWeight: '800', color: colors.text }}>{b.name}</Text>
            </View>
          ))}
          <View style={{ flex: 1, gap: 6, minWidth: 140 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{t.count} of {t.total} done</Text>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: 10, backgroundColor: colors.ok }} /></View>
            <Muted>{t.next ? `Next: ${t.next.time} ${t.next.title}` : 'All done for today.'}{t.late.length ? ` · ${t.late.length} not done yet` : ''}</Muted>
          </View>
        </Row>
      </Card>

      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Overline>Today's routine</Overline>
          {canEdit && <Pressable onPress={() => setEditing(!editing)} accessibilityRole="button"><Text style={{ color: colors.primary, fontWeight: '800' }}>{editing ? 'Finished' : 'Change routine'}</Text></Pressable>}
        </Row>
        <Card style={{ paddingVertical: 6, paddingHorizontal: 6, gap: 2 }}>
          {!baby.routine.length && <Empty icon="list-outline">No routine yet. Tap "Change routine" to add feeds, meals and naps.</Empty>}
          {baby.routine.map((r) => (
            <RoutineRow key={r.id} data={data} cid={cid} item={r} done={t.doneOf(r)} next={t.next?.id === r.id} late={t.late.includes(r)} editing={editing} onTick={tick} onEdit={(x) => setEdit(x)} refresh={refresh} />
          ))}
        </Card>
        <ErrorText message={error || tickError} />
        {editing && (
          <View style={{ gap: 8, paddingTop: 6 }}>
            <Button icon="add" label="Add to the routine" onPress={() => setEdit('new')} />
            <Button kind="secondary" icon="refresh" label="Use the suggested routine for the baby's age" onPress={() => run(() => api.resetRoutine(cid), refresh, setError)} />
            <Muted>The suggested routine is a starting point. Change the times and amounts to suit your baby and your doctor's advice.</Muted>
          </View>
        )}
      </View>

      <ToDo {...props} />

      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <Pressable onPress={() => go('calendar')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <Icon name="medkit-outline" size={22} color="#DB2777" /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Check-ups and vaccinations</Text><Muted>In the Calendar</Muted></View><Icon name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
        <Pressable onPress={() => go('nutrition')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Icon name="nutrition-outline" size={22} color="#F97316" /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Feeding details and growth</Text><Muted>Other feeds, diapers, weight, milk and food nutrition</Muted></View><Icon name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
        <Pressable onPress={() => go('babyreport')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Icon name="bar-chart-outline" size={22} color="#2563EB" /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Reports</Text><Muted>Day, week or month</Muted></View><Icon name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
      </Card>

      <TickHost data={data} cid={cid} refresh={refresh} item={ticking} onClose={() => setTicking(null)} />
      {edit && <EditSheet data={data} cid={cid} item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} refresh={refresh} />}
    </View>
  );
}
