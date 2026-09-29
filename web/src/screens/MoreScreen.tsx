import { Linking, View } from 'react-native';
import { roleLabel, signOut } from '../api';
import { colors } from '../theme';
import { Avatar, Card, ListItem, Muted, Overline, Row } from '../ui';
import { PageHeader, ScreenProps } from './shared';
import { Text } from 'react-native';

export default function MoreScreen({ data, go }: ScreenProps) {
  const items = [
    data.can.seeMoney && { key: 'costs', icon: 'wallet-outline', title: 'Costs and settle up', subtitle: 'Shared expenses, PayNow, monthly statement', color: colors.ok },
    { key: 'docs', icon: 'folder-open-outline', title: 'Documents', subtitle: data.role === 'helper' ? 'Shared with you' : 'Letters, discharge summaries, insurance', color: colors.info },
    data.can.seeRenewals && { key: 'renewals', icon: 'reload-outline', title: 'Renewals', subtitle: 'Permits, cards and policies due', color: colors.warn },
    data.can.seeVisits && { key: 'visits', icon: 'clipboard-outline', title: 'Visit notes', subtitle: 'Doctor, dentist, physio and therapy: notes, documents and photos', color: '#2563EB' },
    { key: 'repeats', icon: 'repeat', title: 'Repeating items', subtitle: 'Repeating requests, appointments and medicines', color: colors.primary },
    data.can.editCircle && { key: 'profile', icon: data.baby ? 'happy-outline' : 'person-outline', title: 'Care profile', subtitle: data.carePlan ? `${data.carePlan.focus.title}` : 'Stage of life, living situation and needs', color: colors.accent },
    { key: 'launch', icon: 'add-circle-outline', title: 'Set up someone new', subtitle: 'Another parent, a newborn, twins or triplets', color: '#F45B8D' },
    { key: 'circle', icon: 'people-outline', title: 'Circle and people', subtitle: 'Members, invites, emergency contacts', color: colors.primary },
    { key: 'notify', icon: 'notifications-outline', title: 'Notification settings', subtitle: 'Alerts, quiet hours, daily summary', color: colors.danger },
    { key: 'appearance', icon: 'color-palette-outline', title: 'Appearance', subtitle: 'Dark mode and colour theme', color: colors.accent },
    { key: 'activity', icon: 'time-outline', title: 'Activity log', subtitle: 'Everything that happened', color: colors.muted },
    { key: 'me', icon: 'person-circle-outline', title: 'My profile', subtitle: 'Name and PayNow mobile', color: colors.primary },
  ].filter(Boolean) as { key: string; icon: any; title: string; subtitle: string; color: string }[];
  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="More" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar id={data.me.userId} name={data.me.name} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>{data.me.name}</Text>
          <Muted>{roleLabel[data.role]} in {data.circle.name}</Muted>
        </View>
      </Card>
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        {items.map((i) => <ListItem key={i.key} icon={i.icon} iconColor={i.color} title={i.title} subtitle={i.subtitle} onPress={() => go(i.key)} />)}
      </Card>
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListItem icon="log-out-outline" iconColor={colors.danger} title="Sign out" onPress={() => signOut()} />
      </Card>
      <Row><Overline>Famhub 4.6</Overline></Row>
    </View>
  );
}
