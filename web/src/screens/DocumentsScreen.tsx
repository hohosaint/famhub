import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { api, fmtDate } from '../api';
import { Badge, Button, Card, Choice, Empty, ErrorText, Field, FilePicker, Link, Muted, Row, s, Title, Toggle } from '../ui';
import { nameOf, run, ScreenProps } from './shared';

const CATEGORIES = [
  { value: 'appointment', label: 'Appointment letters' }, { value: 'discharge', label: 'Discharge summaries' },
  { value: 'insurance', label: 'Insurance' }, { value: 'scheme', label: 'Schemes and subsidies' },
  { value: 'identity', label: 'Identity and legal' }, { value: 'other', label: 'Other' },
];

export default function DocumentsScreen({ data, cid, refresh }: ScreenProps) {
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('appointment');
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f: File) {
    setBusy(true); setError(null);
    try { const up = await api.upload(cid, f); setFile(up); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function save() {
    if (!file) { setError('Choose a file first.'); return; }
    if (await run(() => api.addDocument(cid, { title, category, fileId: file.id, shareWithHelper: share }), refresh, setError)) { setFile(null); setTitle(''); setShare(false); }
  }

  return (
    <View style={{ gap: 12 }}>
      {data.role === 'helper' && <Muted>These are the documents the family has shared with you.</Muted>}
      {data.can.editDocuments && (
        <Card>
          <Title>Add a document</Title>
          <Muted>Photos or PDF files up to 8 MB. Only family members can see documents unless you share one with the helper.</Muted>
          <FilePicker label="File" accept="image/*,application/pdf" onPick={pick} busy={busy} />
          {file && <Muted>Uploaded: {file.name}</Muted>}
          <Field label="Title" value={title} onChange={setTitle} placeholder="Discharge summary, March" />
          <Choice label="Type" value={category} onChange={setCategory} options={CATEGORIES} />
          <Toggle label="Share with the helper" value={share} onChange={setShare} />
          <ErrorText message={error} />
          <Button label={busy ? 'Uploading...' : 'Save document'} onPress={save} disabled={busy} />
        </Card>
      )}
      {!data.documents.length && <Empty>No documents yet.</Empty>}
      {CATEGORIES.map((c) => {
        const docs = data.documents.filter((d) => d.category === c.value);
        if (!docs.length) return null;
        return (
          <View key={c.value} style={{ gap: 8 }}>
            <Title>{c.label}</Title>
            {docs.map((d) => (
              <Card key={d.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[s.itemTitle, { flex: 1 }]}>{d.title}</Text>
                  {d.shareWithHelper && <Badge label="Shared with helper" tone="info" />}
                </Row>
                <Muted>Added by {nameOf(data, d.uploadedBy)} on {fmtDate(d.uploadedAt.slice(0, 10))}</Muted>
                <Row>
                  <Link label="Open" onPress={() => Linking.openURL(api.fileUrl(d.fileId))} />
                  {data.can.editDocuments && <Link label={d.shareWithHelper ? 'Stop sharing with helper' : 'Share with helper'} onPress={() => run(() => api.updateDocument(cid, d.id, { shareWithHelper: !d.shareWithHelper }), refresh, setError)} />}
                  {data.can.editDocuments && <Link label="Delete" danger onPress={() => run(() => api.deleteDocument(cid, d.id), refresh, setError)} />}
                </Row>
              </Card>
            ))}
          </View>
        );
      })}
      {!data.can.editDocuments && <ErrorText message={error} />}
    </View>
  );
}
