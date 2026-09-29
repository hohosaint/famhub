import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtAgo, Inbox, Notice } from '../api';
import { colors } from '../theme';
import { Banner, Button, Card, Empty, ErrorText, Icon, IconName, Muted, Overline, Row, Segmented } from '../ui';
import { pushSupported } from '../push';
import { PageHeader } from './shared';

export const CATEGORY_ICON: Record<string, { icon: IconName; color: string }> = {
  emergency: { icon: 'warning', color: colors.danger },
  checkin: { icon: 'sunny-outline', color: colors.warn },
  medicine: { icon: 'medkit-outline', color: colors.info },
  appointments: { icon: 'calendar-outline', color: colors.primary },
  tasks: { icon: 'hand-left-outline', color: colors.warn },
  updates: { icon: 'chatbubble-ellipses-outline', color: colors.primary },
  money: { icon: 'wallet-outline', color: colors.ok },
  renewals: { icon: 'reload-outline', color: colors.muted },
  digest: { icon: 'newspaper-outline', color: colors.primary },
};

function dayGroup(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(0, 10);
  const t = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const y = new Date(Date.now() + 8 * 3600e3 - 86400e3).toISOString().slice(0, 10);
  return d === t ? 'Today' : d === y ? 'Yesterday' : 'Earlier';
}

export default function InboxScreen({ inbox, onOpen, onAction, onMarkAll, reload, pushOn, goSettings, multiCircle }: {
  inbox: Inbox | null; onOpen: (n: Notice) => void; onAction: (n: Notice, actionId: string) => Promise<void>; onMarkAll: () => void;
  reload: () => void; pushOn: boolean; goSettings: () => void; multiCircle: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const items = (inbox?.items || []).filter((n) => !n.digest || n.readAt === '' ? true : true).filter((n) =>
    filter === 'unread' ? !n.readAt : filter === 'urgent' ? n.priority === 'urgent' || n.priority === 'important' : true);
  const groups = ['Today', 'Yesterday', 'Earlier'].map((g) => ({ g, list: items.filter((n) => dayGroup(n.createdAt) === g) })).filter((x) => x.list.length);

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Notifications" subtitle={inbox ? `${inbox.unread} unread` : ''} right={<Button small kind="secondary" icon="checkmark-done" label="Mark all read" onPress={onMarkAll} />} />
      {!pushOn && pushSupported() && (
        <Banner tone="info">
          <Row><Icon name="notifications-outline" size={22} color={colors.primary} /><Text style={{ fontSize: 16, fontWeight: '700', flex: 1 }}>Get alerts on this device</Text></Row>
          <Muted>Turn on notifications so urgent alerts and reminders reach you even when Famhub is closed.</Muted>
          <Button small label="Set up notifications" onPress={goSettings} />
        </Banner>
      )}
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }, { value: 'urgent', label: 'Important' }]} />
      <ErrorText message={error} />
      {!groups.length && <Card><Empty icon="notifications-off-outline">You're all caught up.</Empty></Card>}
      {groups.map(({ g, list }) => (
        <View key={g} style={{ gap: 8 }}>
          <Overline>{g}</Overline>
          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            {list.map((n, i) => {
              const cat = CATEGORY_ICON[n.category] || CATEGORY_ICON.updates;
              const unread = !n.readAt;
              const urgent = n.priority === 'urgent';
              return (
                <Pressable key={n.id} onPress={() => onOpen(n)} accessibilityHint="Opens the related page" style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, backgroundColor: pressed ? colors.surfaceAlt : urgent && unread ? colors.dangerSoft : unread ? colors.okSoft : colors.card, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border })}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${cat.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={cat.icon} size={20} color={cat.color} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: unread ? '800' : '600', color: urgent ? colors.danger : colors.text }}>{n.title}</Text>
                      {unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: urgent ? colors.danger : colors.primary }} />}
                    </Row>
                    {!!n.body && <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20 }}>{n.body}</Text>}
                    <Text style={{ fontSize: 12, color: colors.faint }}>{fmtAgo(n.createdAt)}{multiCircle && n.circleName ? ` · ${n.circleName}` : ''}{n.digest ? ' · in your daily summary' : ''}</Text>
                    {!n.readAt && n.actions.length > 0 && (
                      <Row style={{ marginTop: 6 }}>
                        {n.actions.map((a, j) => <Button key={a.id} small kind={j === 0 ? 'primary' : 'ghost'} label={a.label} onPress={() => onAction(n, a.id).catch((e) => setError(e.message))} />)}
                      </Row>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}
