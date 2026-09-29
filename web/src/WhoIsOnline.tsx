import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, CircleData, fmtAgo, PersonStatus, roleLabel } from './api';
import { PAGE_LABEL } from './Presence';
import { colors } from './theme';
import { Avatar, Badge, Button, Card, ErrorText, Muted, Overline, Row } from './ui';

// For the owner: who in the circle is online now, where they are in the app, and when the others
// were last active. Refreshes every 10 seconds while open.
function useStatus(cid: string, enabled: boolean) {
  const [people, setPeople] = useState<PersonStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { if (enabled) api.people(cid).then((r) => { setPeople(r.people); setError(null); }).catch((e) => setError(e.message)); }, [cid, enabled]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  return { people, error, load };
}

const statusText = (p: PersonStatus) => {
  if (p.online && p.where) return `Online now · ${PAGE_LABEL[p.where] || p.where}${p.doing ? `, ${p.doing}` : ''}`;
  if (p.online) return 'Online now (in another circle)';
  if (p.lastSeenAt) return `Offline · last active ${fmtAgo(p.lastSeenAt)}`;
  return 'Has not opened Famhub yet';
};

function Dot({ on }: { on: boolean }) {
  return <View style={{ position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: on ? '#12B76A' : colors.borderStrong, borderWidth: 2.5, borderColor: colors.card }} />;
}

export function WhoIsOnlineCard({ data, cid, go }: { data: CircleData; cid: string; go: (t: string) => void }) {
  const { people } = useStatus(cid, data.role === 'owner');
  if (data.role !== 'owner' || !people) return null;
  const others = people.filter((p) => p.userId !== data.me.userId);
  if (!others.length) return null;
  const on = others.filter((p) => p.online);
  return (
    <Pressable onPress={() => go('circle')} accessibilityRole="button" accessibilityLabel={`${on.length} of ${others.length} online. Open who is online`}>
      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Overline>Family online</Overline>
          <Text style={{ fontWeight: '800', color: on.length ? '#12B76A' : colors.muted }}>{on.length} of {others.length} online</Text>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {others.map((p) => (
            <View key={p.userId} style={{ alignItems: 'center', gap: 4, width: 64 }}>
              <View><Avatar id={p.userId} name={p.name} size={44} /><Dot on={p.online} /></View>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{p.name.split(' ')[0]}</Text>
              <Text numberOfLines={1} style={{ fontSize: 10, color: p.online ? '#12B76A' : colors.faint }}>{p.online ? 'online' : p.lastSeenAt ? fmtAgo(p.lastSeenAt) : 'never'}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

export default function WhoIsOnline({ data, cid }: { data: CircleData; cid: string }) {
  const owner = data.role === 'owner';
  const { people, error } = useStatus(cid, owner);
  const [link, setLink] = useState<{ userId: string; link: string; name: string } | null>(null);
  const [err2, setErr2] = useState<string | null>(null);
  if (!owner) return null;
  const on = (people || []).filter((p) => p.online).length;
  const makeLink = async (p: PersonStatus) => {
    try { setErr2(null); const r = await api.resetLink(cid, p.userId); setLink({ userId: p.userId, link: r.link, name: r.name }); } catch (e: any) { setErr2(e.message); }
  };
  return (
    <Card style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Overline>Who is online</Overline>
        {people && <Badge label={`${on} online · ${people.length - on} offline`} tone={on ? 'good' : 'neutral'} />}
      </Row>
      <Muted>Only you (the owner) see this. It updates every 10 seconds.</Muted>
      <ErrorText message={error || err2} />
      {(people || []).map((p) => (
        <View key={p.userId} style={{ gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Row style={{ flexWrap: 'nowrap', gap: 12 }}>
            <View><Avatar id={p.userId} name={p.name} size={40} /><Dot on={p.online} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{p.name}{p.userId === data.me.userId ? ' (you)' : ''}</Text>
              <Text style={{ fontSize: 13, color: p.online ? '#067647' : colors.muted, fontWeight: p.online ? '700' : '400' }}>{statusText(p)}</Text>
            </View>
            <Badge label={roleLabel[p.role]} tone={p.role === 'owner' ? 'info' : 'neutral'} />
          </Row>
          {p.account && p.userId !== data.me.userId && (
            <Row>
              <Button small kind="ghost" icon="key-outline" label="Password reset link" onPress={() => makeLink(p)} />
            </Row>
          )}
          {link && link.userId === p.userId && (
            <View style={{ gap: 6, padding: 10, borderRadius: 12, backgroundColor: colors.surfaceAlt }}>
              <Muted>Send this link to {link.name}. It works once, for one hour.</Muted>
              <Text selectable style={{ fontSize: 12, color: colors.text }}>{link.link}</Text>
              <Row>
                <Button small kind="secondary" icon="copy-outline" label="Copy" onPress={() => { navigator.clipboard?.writeText(link.link).catch(() => {}); }} />
                <Button small kind="secondary" icon="logo-whatsapp" label="WhatsApp" onPress={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`Famhub password reset link (works for one hour): ${link.link}`)}`, '_blank', 'noopener'); }} />
              </Row>
            </View>
          )}
        </View>
      ))}
    </Card>
  );
}
