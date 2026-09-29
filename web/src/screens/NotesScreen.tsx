import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { api, fmtAgo } from '../api';
import { colors } from '../theme';
import { Button, Card, Empty, ErrorText, Field, FilePicker, Link, Muted, Row, Title, Toggle } from '../ui';
import { nameOf, run, ScreenProps } from './shared';

export default function NotesScreen({ data, cid, refresh }: ScreenProps) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ id: string; name: string } | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f: File) {
    setBusy(true); setError(null);
    try { setPhoto(await api.upload(cid, f)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function post() {
    if (await run(() => api.addNote(cid, { text, fileId: photo?.id, urgent }), refresh, setError)) { setText(''); setPhoto(null); setUrgent(false); }
  }

  return (
    <View style={{ gap: 12 }}>
      {data.can.postNotes && (
        <Card>
          <Title>Share an update</Title>
          <Field label="Note for everyone in the circle" value={text} onChange={setText} placeholder="Meals, mood, sleep, anything to watch" multiline />
          {data.role !== 'parent' && <FilePicker label="Add a photo (optional)" accept="image/*" onPick={pick} busy={busy} />}
          {photo && <Muted>Photo attached: {photo.name} <Link label="Remove" onPress={() => setPhoto(null)} /></Muted>}
          <Toggle label="Mark as urgent" value={urgent} onChange={setUrgent} />
          <ErrorText message={error} />
          <Button label={busy ? 'Uploading...' : 'Post note'} onPress={post} disabled={busy} />
        </Card>
      )}
      {!data.notes.length && <Empty>No notes yet.</Empty>}
      {data.notes.map((n) => (
        <Card key={n.id} style={n.urgent ? { borderColor: colors.danger, backgroundColor: '#FEF3F2' } : undefined}>
          {n.urgent && <Text style={{ color: colors.danger, fontWeight: '700' }}>URGENT</Text>}
          {!!n.text && <Text style={{ fontSize: 16, color: colors.text }}>{n.text}</Text>}
          {!!n.fileId && <Image source={{ uri: api.fileUrl(n.fileId) }} style={{ width: '100%', height: 220, borderRadius: 8 }} resizeMode="contain" accessibilityLabel="Photo with the note" />}
          <Row style={{ justifyContent: 'space-between' }}>
            <Muted>{nameOf(data, n.authorUserId)} · {fmtAgo(n.createdAt)}</Muted>
            {(n.authorUserId === data.me.userId || data.role === 'owner') && <Link label="Delete" danger onPress={() => run(() => api.deleteNote(cid, n.id), refresh, setError)} />}
          </Row>
        </Card>
      ))}
    </View>
  );
}
