import { Text, View } from 'react-native';
import { api } from '../api';
import { colors } from '../theme';
import { Banner, Button, Card, Link, Row, Title } from '../ui';
import { ScreenProps } from './shared';

// Help requests at the top, then everything that needs attention.
export function HelpBanner({ data, cid, refresh }: ScreenProps) {
  if (!data.openHelp.length || data.role === 'parent') return null;
  return (
    <Banner tone="bad">
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.danger }}>{data.circle.parentName} asked for help</Text>
      <Text style={{ fontSize: 15 }}>Call {data.circle.parentName}{data.circle.parentPhone ? ` on ${data.circle.parentPhone}` : ''} now. When someone is handling it, tap the button so the others know.</Text>
      <Row>
        {data.circle.parentPhone ? <Button label={`Call ${data.circle.parentName}`} onPress={() => { window.location.href = `tel:${data.circle.parentPhone}`; }} /> : null}
        {data.openHelp.map((h) => <Button key={h.id} kind="secondary" label="I'm handling it" onPress={() => api.resolveHelp(cid, h.id).then(refresh)} />)}
      </Row>
    </Banner>
  );
}

export function AlertList({ data, go }: ScreenProps) {
  const list = data.alerts.filter((a) => a.kind !== 'help');
  if (!list.length) return <Card><Title>Needs attention</Title><Text style={{ color: colors.ok, fontSize: 16 }}>All clear. Nothing needs attention.</Text></Card>;
  return (
    <Card>
      <Title>Needs attention ({list.length})</Title>
      {list.map((a, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ color: a.level === 'info' ? colors.primary : colors.danger, fontSize: 16 }}>{a.level === 'info' ? '•' : '!'}</Text>
          <Text style={{ fontSize: 16, flex: 1 }}>{a.text} <Link label="Open" onPress={() => go(a.tab)} /></Text>
        </View>
      ))}
    </Card>
  );
}
