import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, fmtDateTime, todaySG } from '../api';
import { colors } from '../theme';
import { Button, Card, Empty, ErrorText, Field, Muted, Row, s, Title } from '../ui';
import { AlertList, HelpBanner } from './Alerts';
import { DoseList } from './MedsScreen';
import { run, ScreenProps } from './shared';

// The helper's day on one page: check-in, medicines, tasks, appointments, daily update.
export default function HelperToday(props: ScreenProps) {
  const { data, cid, refresh, go } = props;
  const [update, setUpdate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = todaySG();
  const mine = data.tasks.filter((t) => t.status !== 'done' && t.assigneeUserId === data.me.userId);
  const todays = data.appointments.filter((a) => new Date(new Date(a.startsAt).getTime() + 8 * 3600e3).toISOString().slice(0, 10) === today);
  const template = `Meals: \nMood: \nWalk or exercise: \nSleep: \nAnything to watch: `;

  return (
    <View style={{ gap: 12 }}>
      <HelpBanner {...props} />
      <Card>
        <Title>Check in for {data.circle.parentName}</Title>
        <Row>
          <Button label={`${data.circle.parentName} is OK`} onPress={() => run(() => api.checkin(cid, 'ok'), refresh, setError)} />
          <Button label="Needs help" kind="danger" onPress={() => run(() => api.checkin(cid, 'help'), refresh, setError)} />
        </Row>
      </Card>
      <AlertList {...props} />
      <Card>
        <Title>Medicines today</Title>
        <DoseList {...props} />
      </Card>
      <Card>
        <Title>My tasks ({mine.length})</Title>
        {mine.map((t) => (
          <Row key={t.id} style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, flex: 1 }}>{t.title}</Text>
            {t.status === 'open' && <Button label="Accept" kind="secondary" onPress={() => run(() => api.taskAction(cid, t.id, 'accept'), refresh, setError)} />}
            <Button label="Done" onPress={() => run(() => api.taskAction(cid, t.id, 'done'), refresh, setError)} />
          </Row>
        ))}
        {!mine.length && <Empty>No tasks for you.</Empty>}
        <Text style={s.link} onPress={() => go('tasks')}>All tasks</Text>
      </Card>
      <Card>
        <Title>Appointments today</Title>
        {todays.map((a) => <Text key={a.id} style={{ fontSize: 16 }}>{fmtDateTime(a.startsAt)}: {a.title}, {a.location}</Text>)}
        {!todays.length && <Empty>None today.</Empty>}
      </Card>
      <Card>
        <Title>Daily update for the family</Title>
        <Muted>Tap "Use template" to fill in the usual points.</Muted>
        <Field label="Update" value={update} onChange={setUpdate} multiline />
        <ErrorText message={error} />
        <Row>
          <Button label="Use template" kind="secondary" onPress={() => setUpdate(template)} />
          <Button label="Post update" onPress={async () => { if (await run(() => api.addNote(cid, { text: update }), refresh, setError)) setUpdate(''); }} />
        </Row>
      </Card>
    </View>
  );
}
