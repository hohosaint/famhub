import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, fmtDate, Task, todaySG } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, Choice, DateField, Empty, ErrorText, Field, Link, Muted, Row, s, Title } from '../ui';
import { memberOptions, nameOf, run, ScreenProps } from './shared';

const CATEGORIES = [
  { value: 'errand', label: 'Errand' }, { value: 'refill', label: 'Medicine refill' }, { value: 'bill', label: 'Bill' },
  { value: 'care', label: 'Care' }, { value: 'other', label: 'Other' },
];
type Filter = 'mine' | 'open' | 'untaken' | 'done';

export default function TasksScreen({ data, cid, refresh }: ScreenProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('errand');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todaySG();
  const manager = data.role === 'owner' || data.role === 'family';
  const me = data.me.userId;

  const lists: Record<Filter, Task[]> = {
    mine: data.tasks.filter((t) => t.status !== 'done' && t.assigneeUserId === me),
    open: data.tasks.filter((t) => t.status !== 'done'),
    untaken: data.tasks.filter((t) => t.status !== 'done' && !t.assigneeUserId),
    done: data.tasks.filter((t) => t.status === 'done'),
  };
  const shown = lists[filter].sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const act = (t: Task, action: string, extra = {}) => run(() => api.taskAction(cid, t.id, action, extra), refresh, setError);

  async function add() {
    const ok = await run(() => api.addTask(cid, { title, category, dueDate: due, assigneeUserId: assignee }), refresh, setError);
    if (ok) { setTitle(''); setDue(''); }
  }

  return (
    <View style={{ gap: 12 }}>
      {data.can.addTasks && (
        <Card>
          <Title>New task</Title>
          <Field label="Task" value={title} onChange={setTitle} placeholder="Collect medicine refill" />
          <Choice label="Type" value={category} onChange={setCategory} options={CATEGORIES} />
          <DateField label="Due date (optional)" value={due} onChange={setDue} />
          <Choice label="Who will do it?" value={assignee} onChange={setAssignee} options={[{ value: '', label: 'Anyone (not taken)' }, ...memberOptions(data)]} />
          <ErrorText message={error} />
          <Button label="Add task" onPress={add} />
        </Card>
      )}
      <Choice label="Show" value={filter} onChange={setFilter} options={[
        { value: 'open', label: `All open (${lists.open.length})` }, { value: 'mine', label: `Mine (${lists.mine.length})` },
        { value: 'untaken', label: `Not taken (${lists.untaken.length})` }, { value: 'done', label: `Done (${lists.done.length})` },
      ]} />
      {!data.can.addTasks && <ErrorText message={error} />}
      {!shown.length && <Empty>Nothing here.</Empty>}
      {shown.map((t) => {
        const overdue = t.status !== 'done' && t.dueDate && t.dueDate < today;
        const isMine = t.assigneeUserId === me;
        return (
          <Card key={t.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[s.itemTitle, t.status === 'done' && { textDecorationLine: 'line-through', color: colors.muted }, { flex: 1 }]}>{t.title}</Text>
              {overdue ? <Badge label="Overdue" tone="bad" /> : t.status === 'accepted' ? <Badge label="Accepted" tone="good" /> : t.status === 'open' && t.assigneeUserId ? <Badge label="Waiting to accept" tone="warn" /> : null}
            </Row>
            <Muted>
              {CATEGORIES.find((c) => c.value === t.category)?.label || 'Other'} · {t.assigneeUserId ? nameOf(data, t.assigneeUserId) : 'Not taken'}
              {t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : ''}
              {t.status === 'done' && t.doneBy ? ` · done by ${nameOf(data, t.doneBy)}` : ''}
            </Muted>
            <Row>
              {t.status !== 'done' && !t.assigneeUserId && data.role !== 'parent' && <Button label="I'll do it" kind="secondary" onPress={() => act(t, 'take')} />}
              {t.status === 'open' && isMine && <Button label="Accept" kind="secondary" onPress={() => act(t, 'accept')} />}
              {t.status !== 'done' && isMine && <Button label="Hand back" kind="secondary" onPress={() => act(t, 'decline')} />}
              {t.status !== 'done' && (isMine || manager) && <Button label="Mark done" onPress={() => act(t, 'done')} />}
              {t.status === 'done' && (isMine || manager) && <Button label="Reopen" kind="secondary" onPress={() => act(t, 'reopen')} />}
              {t.status !== 'done' && manager && <Link label="Assign" onPress={() => setAssigning(assigning === t.id ? null : t.id)} />}
              {(data.role === 'owner' || t.createdBy === me) && <Link label="Delete" danger onPress={() => run(() => api.deleteTask(cid, t.id), refresh, setError)} />}
            </Row>
            {assigning === t.id && (
              <Choice label="Assign to" value={t.assigneeUserId} onChange={(v) => { setAssigning(null); act(t, 'assign', { assigneeUserId: v }); }} options={[{ value: '', label: 'Nobody' }, ...memberOptions(data)]} />
            )}
          </Card>
        );
      })}
    </View>
  );
}
