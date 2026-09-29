import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, fmtAgo, Note, photosOf } from '../api';
import { Photo, PhotoCapture, PhotoGrid } from '../Photos';
import { colors } from '../theme';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Icon, Muted, Row, Sheet, Toggle, s } from '../ui';
import { nameOf, PageHeader, run, ScreenProps } from './shared';

function Composer({ data, cid, refresh, close }: ScreenProps & { close: () => void }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = 'Meals: \nMood: \nWalk or exercise: \nSleep: \nAnything to watch: ';
  return (
    <Sheet visible title="Share an update" onClose={close}>
      <Field label="What would the family like to know?" value={text} onChange={setText} placeholder="How was today? Meals, mood, anything to watch" multiline />
      {data.role !== 'parent' && <Button small kind="secondary" icon="list-outline" label="Use daily update template" onPress={() => setText(template)} />}
      <PhotoCapture cid={cid} photos={photos} setPhotos={setPhotos} onError={setError} />
      <Toggle label="Urgent" help="Sends an immediate alert to everyone, even in quiet hours" value={urgent} onChange={setUrgent} />
      <ErrorText message={error} />
      <Button label={busy ? 'Posting...' : photos.length && !text.trim() ? `Post ${photos.length > 1 ? `${photos.length} photos` : 'photo'}` : 'Post update'} icon="send" disabled={busy} onPress={async () => { setBusy(true); const ok = await run(() => api.addNote(cid, { text, fileIds: photos.map((p) => p.id), urgent }), refresh, setError); setBusy(false); if (ok) close(); }} />
    </Sheet>
  );
}

function Post({ n, props }: { n: Note; props: ScreenProps }) {
  const { data, cid, refresh } = props;
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const thanks = Object.keys(n.reactions || {});
  const mine = thanks.includes(data.me.userId);
  return (
    <Card style={n.urgent ? { borderColor: colors.dangerBorder } : undefined}>
      <Row>
        <Avatar id={n.authorUserId} name={nameOf(data, n.authorUserId)} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{nameOf(data, n.authorUserId)}</Text>
          <Muted>{fmtAgo(n.createdAt)}</Muted>
        </View>
        {n.urgent && <Badge label="Urgent" tone="bad" />}
      </Row>
      {!!n.text && <Text style={{ fontSize: 16, lineHeight: 23, color: colors.text }}>{n.text}</Text>}
      <PhotoGrid ids={photosOf(n)} />
      <Row style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, justifyContent: 'space-between' }}>
        <Pressable onPress={() => run(() => api.react(cid, n.id), refresh, setError)} accessibilityRole="button" accessibilityLabel={mine ? 'Remove thanks' : 'Say thanks'} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: mine ? colors.dangerSoft : 'transparent' }}>
          <Icon name={mine ? 'heart' : 'heart-outline'} size={20} color={colors.danger} />
          <Text style={{ fontWeight: '700', color: mine ? colors.danger : colors.muted }}>Thanks{thanks.length ? ` · ${thanks.length}` : ''}</Text>
        </Pressable>
        <Muted>{thanks.length ? thanks.map((u) => nameOf(data, u)).join(', ') : ''}</Muted>
        {(n.authorUserId === data.me.userId || data.role === 'owner') && <Pressable onPress={() => run(() => api.deleteNote(cid, n.id), refresh, setError)} accessibilityLabel="Delete update"><Icon name="trash-outline" size={18} color={colors.faint} /></Pressable>}
      </Row>
      {(n.comments || []).map((c) => (
        <Row key={c.id} style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <Avatar id={c.userId} name={nameOf(data, c.userId)} size={26} />
          <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 10 }}>
            <Text style={{ fontWeight: '700', fontSize: 14 }}>{nameOf(data, c.userId)} <Text style={[s.small, { fontWeight: '400' }]}>· {fmtAgo(c.createdAt)}</Text></Text>
            <Text style={{ fontSize: 15 }}>{c.text}</Text>
          </View>
        </Row>
      ))}
      <Row style={{ flexWrap: 'nowrap' }}>
        <TextInput value={reply} onChangeText={setReply} placeholder="Write a comment" placeholderTextColor={colors.faint} accessibilityLabel="Write a comment" style={[s.input, { flex: 1, paddingVertical: 10 }]} />
        <Button small icon="send" label="" onPress={async () => { if (reply.trim() && (await run(() => api.comment(cid, n.id, reply), refresh, setError))) setReply(''); }} />
      </Row>
      <ErrorText message={error} />
    </Card>
  );
}

// Set by the Today screen's "Share a photo" button so the composer opens straight away.
export const composeNext = { open: false };

export default function UpdatesScreen(props: ScreenProps) {
  const { data } = props;
  const [composing, setComposing] = useState(() => { const o = composeNext.open; composeNext.open = false; return o; });
  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Updates" subtitle="News for the whole family, in one place" />
      {data.can.postNotes && (
        <Card onPress={() => setComposing(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar id={data.me.userId} name={data.me.name} size={40} />
          <Text style={{ flex: 1, fontSize: 16, color: colors.faint }}>Share how {data.circle.parentName} is doing...</Text>
          <Icon name="camera-outline" size={24} color={colors.primary} />
        </Card>
      )}
      {!data.notes.length && <Card><Empty icon="chatbubbles-outline">No updates yet. Be the first to share.</Empty></Card>}
      {data.notes.map((n) => <Post key={n.id} n={n} props={props} />)}
      {composing && <Composer {...props} close={() => setComposing(false)} />}
    </View>
  );
}
