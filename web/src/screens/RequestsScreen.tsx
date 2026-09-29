import RepeatPicker, { collapseSeries, NO_REPEAT, RepeatBadge, RepeatValue, SeriesDelete, SeriesManager, SeriesScope } from '../RepeatPicker';
import DatePicker from '../DatePicker';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, fmtDate, Task, taskLocked, taskWhen, todaySG } from '../api';
import { colors } from '../theme';
import { Avatar, Badge, Button, Card, Choice, DateField, Empty, ErrorText, Field, Icon, IconName, Muted, Row, Segmented, Sheet, s } from '../ui';
import { asPhotos, Photo, PhotoCapture, PhotoGrid } from '../Photos';
import { memberOptions, nameOf, PageHeader, run, ScreenProps } from './shared';

const CATEGORIES: { value: string; label: string; icon: IconName }[] = [
  { value: 'errand', label: 'Errand', icon: 'bag-handle-outline' }, { value: 'refill', label: 'Medicine refill', icon: 'medkit-outline' },
  { value: 'bill', label: 'Bill', icon: 'receipt-outline' }, { value: 'care', label: 'Care', icon: 'heart-outline' }, { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

function NewRequest({ data, cid, refresh, close }: ScreenProps & { close: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('errand');
  const [due, setDue] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [assignee, setAssignee] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [repeat, setRepeat] = useState<RepeatValue>(NO_REPEAT);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet visible title="New request" onClose={close}>
      <Muted>Post what needs doing. Leave it open for anyone to take, or ask one person directly. They get a notification either way.</Muted>
      <Field label="What needs doing?" value={title} onChange={setTitle} placeholder="Collect medicine refill" />
      <Choice label="Type" value={category} onChange={setCategory} options={CATEGORIES} />
      <PhotoCapture cid={cid} photos={photos} setPhotos={setPhotos} onError={setError} />
      <DatePicker label="Date (optional)" value={due} onChange={setDue} optional />
      {!!due && <DateField label="Time (optional)" value={dueTime} onChange={setDueTime} timeOnly optional />}
      {!!due && <Muted>It can be ticked Done only from {dueTime ? `${dueTime} on ` : ''}this date. At that time Famhub alerts the person doing it (or everyone, if nobody has taken it) by app notification and email.</Muted>}
      <RepeatPicker start={due || todaySG()} value={repeat} onChange={setRepeat} />
      <Choice label="Who?" value={assignee} onChange={setAssignee} options={[{ value: '', label: 'Anyone can take it' }, ...memberOptions(data)]} />
      <ErrorText message={error} />
      <Button label="Post request" icon="send" onPress={async () => { if (await run(() => api.addTask(cid, { title, category, dueDate: due, dueTime: due ? dueTime : '', assigneeUserId: assignee, fileIds: photos.map((p) => p.id), repeat: repeat.freq === 'none' ? undefined : repeat }), refresh, setError)) close(); }} />
    </Sheet>
  );
}

// Edit a request. For a repeating one, choose which repeats get the change.
function EditRequest({ data, cid, refresh, task, close }: ScreenProps & { task: Task; close: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category);
  const [due, setDue] = useState(task.dueDate || '');
  const [dueTime, setDueTime] = useState(task.dueTime || '');
  const [assignee, setAssignee] = useState(task.assigneeUserId || '');
  const [asking, setAsking] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>(asPhotos(task.fileIds));
  const [error, setError] = useState<string | null>(null);
  const manager = data.role === 'owner' || data.role === 'family';
  const save = async (series: '' | 'later' | 'all') => {
    const body: Record<string, unknown> = { title, category, dueDate: due, dueTime: due ? dueTime : '', series, fileIds: photos.map((p) => p.id) };
    if (manager && assignee !== (task.assigneeUserId || '')) body.assigneeUserId = assignee;
    if (await run(() => api.taskAction(cid, task.id, 'edit', body), refresh, setError)) close();
  };
  return (
    <Sheet visible title="Edit request" onClose={close}>
      {task.repeatText && <RepeatBadge text={task.repeatText} />}
      <Field label="What needs doing?" value={title} onChange={setTitle} />
      <Choice label="Type" value={category} onChange={setCategory} options={CATEGORIES} />
      <PhotoCapture cid={cid} photos={photos} setPhotos={setPhotos} onError={setError} />
      {!task.seriesId && <DatePicker label="Date (optional)" value={due} onChange={setDue} optional />}
      {!!due && <DateField label="Time (optional)" value={dueTime} onChange={setDueTime} timeOnly optional />}
      {manager && <Choice label="Who?" value={assignee} onChange={setAssignee} options={[{ value: '', label: 'Anyone can take it' }, ...memberOptions(data)]} />}
      <ErrorText message={error} />
      <Button label="Save changes" icon="checkmark" onPress={() => (task.seriesId ? setAsking(true) : save(''))} />
      {asking && <SeriesScope what="request" close={() => setAsking(false)} onPick={save} />}
    </Sheet>
  );
}

export default function RequestsScreen(props: ScreenProps) {
  const { data, cid, refresh } = props;
  const [filter, setFilter] = useState<'open' | 'mine' | 'done'>('open');
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [managing, setManaging] = useState<string | null>(null);   // seriesId
  const [editing, setEditing] = useState<Task | null>(null);
  const me = data.me.userId;
  const today = todaySG();
  const manager = data.role === 'owner' || data.role === 'family';
  const lists = {
    open: data.tasks.filter((t) => t.status !== 'done'),
    mine: data.tasks.filter((t) => t.status !== 'done' && t.assigneeUserId === me),
    done: data.tasks.filter((t) => t.status === 'done').sort((a, b) => b.doneAt.localeCompare(a.doneAt)),
  };
  const shown = filter === 'done' ? lists.done : lists[filter].sort((a, b) => Number(!!a.assigneeUserId) - Number(!!b.assigneeUserId) || (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  // Repeating requests show once (the next one), with how many more are coming.
  const rows = filter === 'done' ? shown.map((item) => ({ item, more: 0 })) : collapseSeries(shown);
  const act = (t: Task, action: string, extra = {}) => run(() => api.taskAction(cid, t.id, action, extra), refresh, setError);

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Requests" subtitle={`${collapseSeries(lists.open.filter((t) => !t.assigneeUserId)).length} waiting for someone`} right={data.can.addTasks ? <Button icon="add" label="New" onPress={() => setAdding(true)} /> : undefined} />
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'open', label: `Open (${collapseSeries(lists.open).length})` }, { value: 'mine', label: `Mine (${collapseSeries(lists.mine).length})` }, { value: 'done', label: 'Done' }]} />
      <ErrorText message={error} />
      {!shown.length && <Card><Empty icon="checkmark-done-outline">{filter === 'mine' ? 'Nothing on your list.' : 'Nothing here.'}</Empty></Card>}
      {rows.map(({ item: t, more }) => {
        const cat = CATEGORIES.find((c) => c.value === t.category) || CATEGORIES[4];
        const overdue = t.status !== 'done' && t.dueDate && t.dueDate < today;
        const isMine = t.assigneeUserId === me;
        return (
          <Card key={t.id}>
            <Row style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.status === 'done' ? colors.okSoft : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.status === 'done' ? 'checkmark' : cat.icon} size={20} color={t.status === 'done' ? colors.ok : colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[s.itemTitle, t.status === 'done' && { color: colors.muted, textDecorationLine: 'line-through' }]}>{t.title}</Text>
                <Row>
                  {t.assigneeUserId ? <><Avatar id={t.assigneeUserId} name={nameOf(data, t.assigneeUserId)} size={22} /><Muted>{isMine ? 'You' : nameOf(data, t.assigneeUserId)}</Muted></> : <Badge label="Up for grabs" tone="warn" />}
                  {t.dueDate ? <Muted>· {taskWhen(t)}</Muted> : null}
                  <RepeatBadge text={t.repeatText} more={more} onPress={t.seriesId && (manager || t.createdBy === me) ? () => setManaging(t.seriesId!) : undefined} />
                  {overdue ? <Badge label="Overdue" tone="bad" /> : null}
                  {t.status === 'open' && t.assigneeUserId ? <Badge label="Waiting to accept" /> : null}
                </Row>
                {t.status === 'done' && <Muted>Done by {nameOf(data, t.doneBy)}</Muted>}
                {!!t.fileIds?.length && <PhotoGrid ids={t.fileIds} height={160} />}
              </View>
            </Row>
            <Row>
              {t.status !== 'done' && !t.assigneeUserId && data.role !== 'parent' && <Button small icon="hand-left-outline" label="I'll do it" onPress={() => act(t, 'take')} />}
              {t.status === 'open' && isMine && <Button small label="Accept" onPress={() => act(t, 'accept')} />}
              {t.status !== 'done' && (isMine || manager) && (taskLocked(t)
                ? <Button small kind="secondary" icon="lock-closed-outline" label={`Done from ${taskWhen(t)}`} disabled onPress={() => {}} />
                : <Button small kind="secondary" icon="checkmark" label="Done" onPress={() => act(t, 'done')} />)}
              {t.status !== 'done' && isMine && <Button small kind="ghost" label="Can't do it" onPress={() => act(t, 'decline')} />}
              {t.status === 'done' && (isMine || manager) && <Button small kind="ghost" label="Reopen" onPress={() => act(t, 'reopen')} />}
              {t.status !== 'done' && manager && <Button small kind="ghost" label="Assign" onPress={() => setAssigning(assigning === t.id ? null : t.id)} />}
              {(manager || t.createdBy === me) && <Button small kind="ghost" icon="create-outline" label="Edit" onPress={() => setEditing(t)} />}
              {(data.role === 'owner' || t.createdBy === me) && <Button small kind="ghost" icon="trash-outline" label="" onPress={() => (t.seriesId ? setDeleting(t) : run(() => api.deleteTask(cid, t.id), refresh, setError))} />}
            </Row>
            {assigning === t.id && <Choice label="Ask someone" value={t.assigneeUserId} onChange={(v) => { setAssigning(null); act(t, 'assign', { assigneeUserId: v }); }} options={[{ value: '', label: 'Anyone' }, ...memberOptions(data)]} />}
          </Card>
        );
      })}
      {deleting && <SeriesDelete what="request" close={() => setDeleting(null)} onChoose={() => setManaging(deleting.seriesId!)} onDelete={(series) => run(() => api.deleteTask(cid, deleting.id, series), refresh, setError)} />}
      {managing && (() => {
        const all = data.tasks.filter((x) => x.seriesId === managing).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        if (!all.length) return null;
        return <SeriesManager what="request" title={all[0].title} rule={all[0].repeatText} close={() => setManaging(null)}
          rows={all.map((x) => ({ id: x.id, day: x.dueDate, label: taskWhen(x) || 'No date', done: x.status === 'done' }))}
          onDelete={(ids) => run(() => api.deleteRepeats(cid, 'task', ids), refresh, setError)} />;
      })()}
      {editing && <EditRequest {...props} task={editing} close={() => setEditing(null)} />}
      {adding && <NewRequest {...props} close={() => setAdding(false)} />}
    </View>
  );
}
