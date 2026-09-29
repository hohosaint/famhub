import { useState } from 'react';
import { Linking, View } from 'react-native';
import { api, roleLabel, signOut } from '../api';
import { Button, Card, ErrorText, Field, Link, Muted, PhotoAvatar, Row, Title } from '../ui';
import { Text } from 'react-native';
import { ScreenProps } from './shared';

export default function MeScreen({ data, refresh }: ScreenProps) {
  const [name, setName] = useState(data.me.name);
  const [paynow, setPaynow] = useState(data.me.paynow);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaved(false); setError(null);
    try { await api.updateMe({ name, paynow }); await refresh(); setSaved(true); } catch (e: any) { setError(e.message); }
  }

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Title>Your profile</Title>
        <Row style={{ gap: 16 }}>
          <PhotoAvatar id={data.me.userId} name={data.me.name} size={84} onUpload={async (f) => { await api.uploadMyPhoto(f); await refresh(); }} onRemove={async () => { await api.removeMyPhoto(); await refresh(); }} />
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ fontSize: 20, fontWeight: '900' }}>{data.me.name}</Text>
            <Muted>Your role in {data.circle.name}: {roleLabel[data.role]}</Muted>
            <Muted>Tap the picture to add or change your photo. Everyone in your circles sees it.</Muted>
          </View>
        </Row>
        <Field label="Your name as others see it" value={name} onChange={setName} />
        {data.role !== 'parent' && (
          <Field label="Your PayNow / PayLah! mobile (so others can pay you by QR code)" value={paynow} onChange={setPaynow} placeholder="9123 4567" keyboard="phone-pad" />
        )}
        <ErrorText message={error} />
        {saved && <Muted>Saved.</Muted>}
        <Button label="Save" onPress={save} />
      </Card>
      <FamilyPhotos data={data} refresh={refresh} />
      {data.me.account && <PasswordCard email={data.me.email || ''} />}
      <Card>
        <Title>Account</Title>
        <Link label="Sign out" onPress={() => signOut()} />
      </Card>
    </View>
  );
}

function PasswordCard({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setMsg(null); setError(null);
    if (next.length < 8) { setError('The new password must be at least 8 characters.'); return; }
    if (next !== again) { setError('The two new passwords do not match.'); return; }
    try { await api.changePassword(current, next); setMsg('Password changed.'); setCurrent(''); setNext(''); setAgain(''); } catch (e: any) { setError(e.message); }
  };
  return (
    <Card>
      <Title>Sign-in</Title>
      <Muted>You sign in with {email}.</Muted>
      <Field label="Current password" value={current} onChange={setCurrent} secure autoComplete="current-password" />
      <Field label="New password (at least 8 characters)" value={next} onChange={setNext} secure autoComplete="new-password" />
      <Field label="New password again" value={again} onChange={setAgain} secure autoComplete="new-password" onSubmit={save} />
      <ErrorText message={error} />
      {msg && <Muted>{msg}</Muted>}
      <Button label="Change password" onPress={save} />
    </Card>
  );
}

// Photos of the person the circle is for (parent, kid, teen) and of each baby.
function FamilyPhotos({ data, refresh }: { data: ScreenProps['data']; refresh: () => Promise<void> }) {
  const cid = data.circle.id;
  const canPerson = ['owner', 'family', 'parent'].includes(data.role);
  const canBaby = data.role !== 'parent';
  const people = data.baby
    ? (canBaby ? data.baby.babies.map((b) => ({ id: b.id, who: b.id, name: b.name })) : [])
    : canPerson ? [{ id: `person-${cid}`, who: 'person', name: data.circle.parentName }] : [];
  if (!people.length) return null;
  return (
    <Card>
      <Title>{data.baby ? (people.length > 1 ? 'Baby photos' : 'Baby photo') : `${data.circle.parentName}'s photo`}</Title>
      <Muted>Tap a picture to add or change the photo.</Muted>
      <Row style={{ gap: 20, paddingTop: 6 }}>
        {people.map((p) => (
          <View key={p.id} style={{ alignItems: 'center', gap: 4 }}>
            <PhotoAvatar id={p.id} name={p.name} size={72} onUpload={async (f) => { await api.uploadCirclePhoto(cid, p.who, f); await refresh(); }} onRemove={async () => { await api.removeCirclePhoto(cid, p.who); await refresh(); }} />
            <Text style={{ fontWeight: '800' }}>{p.name}</Text>
          </View>
        ))}
      </Row>
    </Card>
  );
}
