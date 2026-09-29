import DatePicker from '../DatePicker';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, daysUntil, fmtDate } from '../api';
import { Badge, Button, Card, DateField, Empty, ErrorText, Field, Link, Muted, Row, s, Title } from '../ui';
import { run, ScreenProps } from './shared';
import { Photo, PhotoCapture, PhotoGrid } from '../Photos';

export default function RenewalsScreen({ data, cid, refresh }: ScreenProps) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [nextFor, setNextFor] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = data.renewals || [];

  return (
    <View style={{ gap: 12 }}>
      <Muted>Track renewal dates the family enters: subsidy cards, the helper's work permit, insurance and so on. Alerts start 30 days before.</Muted>
      {data.can.editRenewals && (
        <Card>
          <Title>Add a renewal</Title>
          <Field label="What needs renewing?" value={title} onChange={setTitle} placeholder="Helper's work permit" />
          <DatePicker label="Due date" value={due} onChange={setDue} />
          <Field label="Notes" value={notes} onChange={setNotes} placeholder="Where or how to renew" />
          <Text style={s.label}>Photo of the card, letter or permit (optional)</Text>
          <PhotoCapture cid={cid} photos={photos} setPhotos={setPhotos} onError={setError} />
          <ErrorText message={error} />
          <Button label="Add" onPress={async () => { if (await run(() => api.addRenewal(cid, { title, dueDate: due, notes, fileIds: photos.map((p) => p.id) } as any), refresh, setError)) { setTitle(''); setDue(''); setNotes(''); setPhotos([]); } }} />
        </Card>
      )}
      {!list.length && <Empty>No renewals yet.</Empty>}
      {list.map((r) => {
        const days = daysUntil(r.dueDate);
        return (
          <Card key={r.id} style={r.doneAt ? { opacity: 0.6 } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[s.itemTitle, { flex: 1 }]}>{r.title}</Text>
              {r.doneAt ? <Badge label="Renewed" tone="good" /> : days < 0 ? <Badge label={`${-days} days overdue`} tone="bad" /> : days <= 30 ? <Badge label={`${days} days left`} tone="warn" /> : <Badge label={`${days} days left`} />}
            </Row>
            <Muted>Due {fmtDate(r.dueDate)}{r.notes ? ` · ${r.notes}` : ''}</Muted>
            {!!r.fileIds?.length && <PhotoGrid ids={r.fileIds} height={150} />}
            {data.can.editRenewals && (
              <Row>
                {!r.doneAt && <Link label="Mark renewed" onPress={() => run(() => api.updateRenewal(cid, r.id, { done: true }), refresh, setError)} />}
                <Link label="Set next due date" onPress={() => { setNextFor(nextFor === r.id ? null : r.id); setNextDate(''); }} />
                <Link label="Delete" danger onPress={() => run(() => api.deleteRenewal(cid, r.id), refresh, setError)} />
              </Row>
            )}
            {nextFor === r.id && (
              <Row>
                <DatePicker label="Next due date" value={nextDate} onChange={setNextDate} />
                <Button label="Save" onPress={async () => { if (await run(() => api.updateRenewal(cid, r.id, { dueDate: nextDate }), refresh, setError)) setNextFor(null); }} />
              </Row>
            )}
          </Card>
        );
      })}
    </View>
  );
}
