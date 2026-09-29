import { Text, View } from 'react-native';
import { api, fmtAgo, fmtDate, fmtDateTime, sgd, todaySG } from '../api';
import { colors } from '../theme';
import { Button, Card, Empty, Link, Muted, Row, s, Title } from '../ui';
import { AlertList, HelpBanner } from './Alerts';
import { nameOf, ScreenProps } from './shared';

export default function HomeScreen(props: ScreenProps) {
  const { data, cid, refresh, go } = props;
  const now = new Date().toISOString();
  const next = data.appointments.find((a) => a.startsAt >= now);
  const today = todaySG();
  const open = data.tasks.filter((t) => t.status !== 'done');
  const mine = open.filter((t) => t.assigneeUserId === data.me.userId);
  const taken = data.dosesToday.filter((d) => d.status === 'taken').length;
  const checkedToday = data.lastCheckin && new Date(new Date(data.lastCheckin.createdAt).getTime() + 8 * 3600e3).toISOString().slice(0, 10) === today;

  return (
    <View style={{ gap: 12 }}>
      <HelpBanner {...props} />
      <Card>
        <Title>{data.circle.parentName} today</Title>
        {checkedToday ? (
          <Text style={{ fontSize: 17, color: colors.ok, fontWeight: '600' }}>✓ Checked in {fmtAgo(data.lastCheckin!.createdAt)} ({nameOf(data, data.lastCheckin!.recordedBy)} pressed "I'm OK")</Text>
        ) : (
          <Muted>No check-in yet today. Expected by {data.circle.checkinBy}.</Muted>
        )}
        <Text style={{ fontSize: 16 }}>Medicines: {taken} of {data.dosesToday.length} doses ticked today</Text>
        <Row>
          <Button label={`${data.circle.parentName} is OK`} kind="secondary" onPress={() => api.checkin(cid, 'ok').then(refresh)} />
          <Link label="Medicines" onPress={() => go('meds')} />
        </Row>
      </Card>

      <AlertList {...props} />

      <Card>
        <Title>Next appointment</Title>
        {next ? (
          <View style={{ gap: 2 }}>
            <Text style={s.itemTitle}>{next.title}</Text>
            <Text style={{ fontSize: 16 }}>{fmtDateTime(next.startsAt)}</Text>
            <Muted>{next.location}{next.escortUserId ? ` · Escort: ${nameOf(data, next.escortUserId)}` : ' · No escort yet'}</Muted>
          </View>
        ) : <Empty>Nothing booked.</Empty>}
        <Link label="Calendar" onPress={() => go('calendar')} />
      </Card>

      <Card>
        <Title>Tasks</Title>
        <Muted>{open.length} open · {mine.length} yours · {open.filter((t) => !t.assigneeUserId).length} not taken</Muted>
        {mine.slice(0, 3).map((t) => <Text key={t.id} style={{ fontSize: 16 }}>• {t.title}{t.dueDate ? ` (${fmtDate(t.dueDate)})` : ''}</Text>)}
        <Link label="Tasks" onPress={() => go('tasks')} />
      </Card>

      {data.balances && (
        <Card>
          <Title>Money</Title>
          {data.balances.filter((b) => b.fromUserId === data.me.userId || b.toUserId === data.me.userId).map((b) => (
            <Text key={`${b.fromUserId}${b.toUserId}`} style={{ fontSize: 16 }}>
              {b.fromUserId === data.me.userId ? `You owe ${b.toName} ${sgd(b.amount)}` : `${b.fromName} owes you ${sgd(b.amount)}`}
            </Text>
          ))}
          {!data.balances.some((b) => b.fromUserId === data.me.userId || b.toUserId === data.me.userId) && <Muted>You are settled up.</Muted>}
          <Link label="Costs" onPress={() => go('costs')} />
        </Card>
      )}

      <Card>
        <Title>Latest notes</Title>
        {data.notes.slice(0, 3).map((n) => (
          <View key={n.id}>
            <Text style={{ fontSize: 16, color: n.urgent ? colors.danger : colors.text }}>{n.urgent ? 'URGENT: ' : ''}{n.text}</Text>
            <Muted>{nameOf(data, n.authorUserId)} · {fmtAgo(n.createdAt)}</Muted>
          </View>
        ))}
        {!data.notes.length && <Empty>No notes yet.</Empty>}
        <Link label="Notes" onPress={() => go('notes')} />
      </Card>
    </View>
  );
}
