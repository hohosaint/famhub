import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { Button, Card, ErrorText, Field, Muted, Title } from '../ui';
import LaunchWizard from './LaunchWizard';

// Shown to someone who is not in any care circle yet.
export default function OnboardingScreen({ name, onDone, live }: { name: string; onDone: (circleId: string) => void; live?: boolean }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const attempt = async (fn: () => Promise<string>) => { try { setError(null); onDone(await fn()); } catch (e: any) { setError(e.message); } };

  if (wizard) return <LaunchWizard onDone={onDone} onCancel={() => setWizard(false)} />;
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Title>Welcome to Famhub, {name}</Title>
        <Muted>You are not in a care circle yet. Join your family's circle with an invite code, or start a new one.</Muted>
      </Card>
      <Card>
        <Title>Join with an invite code</Title>
        <Field label="Invite code (6 letters and numbers)" value={code} onChange={setCode} placeholder="ABC234" />
        <Button label="Join" onPress={() => attempt(async () => (await api.acceptInvite(code)).circleId)} />
      </Card>
      <Card>
        <Title>Start a new care circle</Title>
        <Muted>Tell Famhub who you care for (an older parent, a newborn, twins or triplets), their stage of life and where they live. It suggests a starter plan.</Muted>
        <Button icon="sparkles" label="Set up a care circle (parent, baby, twins or triplets)" onPress={() => setWizard(true)} />
      </Card>
      {!live && <Card>
        <Title>Try it with sample data</Title>
        <Muted>Creates a demo circle with sample appointments, tasks, medicines and costs, with you as the owner.</Muted>
        <Button label="Create a demo circle" kind="secondary" onPress={() => attempt(async () => (await api.createCircle({ withDemoData: true })).id)} />
      </Card>}
      <ErrorText message={error} />
    </View>
  );
}
