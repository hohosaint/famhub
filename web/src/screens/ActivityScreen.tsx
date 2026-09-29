import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { api, fmtAgo } from '../api';
import { colors } from '../theme';
import { Card, Empty, Muted } from '../ui';
import { ScreenProps } from './shared';

// Everything that happened in the circle, newest first. Opening it marks all as read.
export default function ActivityScreen({ data, cid, refresh }: ScreenProps) {
  useEffect(() => { if (data.unreadCount) api.seen(cid).then(refresh); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ gap: 8 }}>
      {!data.activity.length && <Empty>No activity yet.</Empty>}
      {data.activity.map((a) => (
        <Card key={a.id} style={a.unread ? { borderColor: colors.primary, backgroundColor: colors.okSoft } : undefined}>
          <Text style={{ fontSize: 16, fontWeight: a.unread ? '600' : '400' }}>{a.text}</Text>
          <Muted>{fmtAgo(a.createdAt)}{a.unread ? ' · new' : ''}</Muted>
        </Card>
      ))}
    </View>
  );
}
