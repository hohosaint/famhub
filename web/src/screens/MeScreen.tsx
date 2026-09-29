import { useState } from 'react';
import { Linking, View } from 'react-native';
import { api, roleLabel, signOut } from '../api';
import { Button, Card, ErrorText, Field, Link, Muted, Title } from '../ui';
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
        <Muted>Your role in {data.circle.name}: {roleLabel[data.role]}</Muted>
        <Field label="Your name as others see it" value={name} onChange={setName} />
        {data.role !== 'parent' && data.role !== 'helper' && (
          <Field label="Your PayNow mobile (so others can pay you back)" value={paynow} onChange={setPaynow} placeholder="9123 4567" keyboard="phone-pad" />
        )}
        <ErrorText message={error} />
        {saved && <Muted>Saved.</Muted>}
        <Button label="Save" onPress={save} />
      </Card>
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
