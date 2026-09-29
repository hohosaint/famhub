import HScroll from './HScroll';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, Profiles, Role, Session, signOut, TestProfile } from './api';
import { colors } from './theme';
import { Avatar, Badge, Button, Choice, ErrorText, Field, Icon, Muted, Overline, Row, Sheet } from './ui';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'family', label: 'Family' }, { value: 'helper', label: 'Helper' }, { value: 'parent', label: 'Parent' }, { value: 'owner', label: 'Owner' },
];
const IN_CIRCLE: { value: '' | Role; label: string }[] = [{ value: '', label: 'Not in circle' }, ...ROLE_OPTIONS];
const ROLE_NAME: Record<string, string> = { owner: 'Owner', family: 'Family', helper: 'Helper', parent: 'Parent' };

function describe(p: TestProfile, data: Profiles) {
  if (!p.memberships.length) return 'No care circle yet';
  return p.memberships.map((m) => `${ROLE_NAME[m.role]} · ${data.circles.find((c) => c.id === m.circleId)?.name || 'circle'}`).join('\n');
}

// Test mode: switch between any number of test people, like accounts in an app.
export default function ProfileSwitcher({ session, onSwitch, onRunChecks }: { session: Session; onSwitch: () => void; onRunChecks: () => void }) {
  const [data, setData] = useState<Profiles | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TestProfile | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mail, setMail] = useState<Awaited<ReturnType<typeof api.outbox>> | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await api.profiles()); setLoadError(null); } catch (e: any) { setLoadError(e?.message || 'Could not load test profiles.'); }
  }, []);
  useEffect(() => { if (!session.testMode) return; load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [session.testMode, session.user.id, load]);
  if (!session.testMode) return null;

  const switchTo = async (id: string) => {
    if (id === session.user.id) { setOpen(false); return; }
    setBusy(true); setError(null);
    try { await api.testAs(id); setOpen(false); onSwitch(); load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const profiles = data?.profiles || [];

  return (
    <View style={st.bar}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Text style={st.title} numberOfLines={1}>TEST MODE · acting as {session.user.testingAs || `${session.user.name} (your account)`}</Text>
        <Pressable onPress={() => { setOpen(true); load(); }} accessibilityRole="button" accessibilityLabel="Manage test profiles" hitSlop={10} style={st.manage}>
          <Icon name="people" size={14} color="#7A4B00" /><Text style={st.manageText}>Profiles</Text>
        </Pressable>
      </Row>
      <HScroll gap={10} paddingRight={8} arrows={false}>
        {profiles.map((p) => {
          const on = p.id === session.user.id;
          return (
            <Pressable key={p.id} disabled={busy} onPress={() => switchTo(p.id)} accessibilityRole="button" accessibilityLabel={`Switch to ${p.label}`} accessibilityState={{ selected: on }} style={{ alignItems: 'center', width: 58 }}>
              <View style={[st.ring, on && { borderColor: colors.primary }, p.urgent && !on && { borderColor: colors.danger }]}>
                <Avatar id={p.id} name={p.name} size={36} />
              </View>
              {p.unread > 0 && !on && <View style={[st.dot, p.urgent && { backgroundColor: colors.danger }]}><Text style={st.dotText}>{p.unread > 9 ? '9+' : p.unread}</Text></View>}
              <Text style={[st.name, on && { color: colors.primary, fontWeight: '800' }]} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => { setEditing('new'); setError(null); if (!data) load(); }} accessibilityRole="button" accessibilityLabel="Add test profile" hitSlop={8} style={{ alignItems: 'center', width: 58 }}>
          <View style={[st.ring, { borderStyle: 'dashed', borderColor: '#D9A21B', alignItems: 'center', justifyContent: 'center' }]}><Icon name="add" size={24} color="#B7791F" /></View>
          <Text style={st.name}>Add</Text>
        </Pressable>
      </HScroll>
      <ErrorText message={error} />

      {open && !data && (
        <Sheet visible title="Switch profile" onClose={() => setOpen(false)}>
          {loadError ? <ErrorText message={`Could not load test profiles: ${loadError}`} /> : <Muted>Loading profiles...</Muted>}
          <Button kind="secondary" icon="refresh" label="Try again" onPress={load} />
          <Button kind="secondary" icon="log-out-outline" label="Sign out" onPress={() => signOut()} />
        </Sheet>
      )}

      {open && data && (
        <Sheet visible title="Switch profile" onClose={() => setOpen(false)}>
          <Muted>Test as anyone. Add as many people as you like, in any role and any care circle. Tap a person to switch.</Muted>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.okSoft, borderRadius: 12, padding: 10 }}>
            <Icon name="people" size={18} color="#166534" />
            <Text style={{ flex: 1, fontSize: 14, color: colors.okText }}>To see working together live, tap <Text style={{ fontWeight: '800' }}>open in new window</Text> next to another person. Each window stays signed in as its own person, so you can watch their moves, cursor and typing side by side.</Text>
          </View>
          {profiles.map((p) => {
            const on = p.id === session.user.id;
            return (
              <View key={p.id} style={[st.card, on && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
                <Pressable disabled={busy} onPress={() => switchTo(p.id)} accessibilityRole="button" accessibilityLabel={`Switch to ${p.label}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar id={p.id} name={p.name} size={42} />
                  <View style={{ flex: 1 }}>
                    <Row style={{ gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{p.name}</Text>
                      {on && <Badge label="Current" tone="good" />}
                      {p.builtIn && <Badge label="Demo" />}
                      {p.unread > 0 && <Badge label={`${p.unread} unread`} tone={p.urgent ? 'bad' : 'info'} />}
                    </Row>
                    <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>{describe(p, data)}</Text>
                    <Text style={{ fontSize: 12, color: colors.faint }}>Username: {p.username}{p.customPassword ? ' · own password' : ''}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => { window.open(`/?as=${encodeURIComponent(p.id)}`, '_blank', 'noopener'); }} accessibilityRole="button" accessibilityLabel={`Open ${p.name} in a new window`} style={{ padding: 8 }}>
                  <Icon name="open-outline" size={22} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => { setEditing(p); setError(null); }} accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`} style={{ padding: 8 }}>
                  <Icon name="create-outline" size={22} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}
          <Button icon="person-add" label="Add a test profile" onPress={() => { setEditing('new'); setError(null); }} />
          <Overline>Testing tools</Overline>
          <Button kind="secondary" icon="alarm-outline" label="Run reminder checks now" onPress={() => { setOpen(false); onRunChecks(); }} />
          <Button kind="secondary" icon="mail-outline" label="Message outbox (email and WhatsApp)" onPress={async () => { try { setMail(await api.outbox()); } catch (e: any) { setError(e.message); } }} />
          {session.microsoft && <Button kind="secondary" icon="person-circle-outline" label="Use my own Microsoft account" onPress={() => switchTo('')} />}
          <Button kind="secondary" icon="log-out-outline" label="Sign out" onPress={() => signOut()} />
          <Button kind="danger" icon="refresh" label="Reset demo data (removes added profiles)" onPress={async () => { setBusy(true); await api.testReset(); await api.testAs('demo-thomas'); setBusy(false); setOpen(false); onSwitch(); load(); }} />
          <ErrorText message={error} />
        </Sheet>
      )}

      {mail && (
        <Sheet visible title="Message outbox" onClose={() => setMail(null)}>
          <Muted>Email: {mail.email === 'none' ? 'not set up (recorded only)' : mail.email === 'acs' ? 'Azure Communication Services' : 'SMTP'}. WhatsApp: {mail.whatsapp === 'none' ? 'not set up (recorded only)' : mail.whatsapp === 'acs' ? 'Azure Communication Services' : 'Meta Cloud API'}. Newest first; clears when the app restarts.</Muted>
          {!mail.messages.length && <Muted>Nothing yet. Turn on email or WhatsApp alerts in Notification settings, then trigger an alert.</Muted>}
          {mail.messages.map((m, i) => (
            <View key={i} style={st.card}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{m.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · {m.subject}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>To {m.to} · {new Date(m.at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</Text>
                <Text style={{ fontSize: 13, color: m.status === 'sent' ? colors.ok : m.status === 'failed' ? colors.danger : colors.warn }}>{m.status}{m.error ? `: ${m.error}` : ''}</Text>
              </View>
            </View>
          ))}
        </Sheet>
      )}

      {editing && !data && (
        <Sheet visible title="Add a test profile" onClose={() => setEditing(null)}>
          {loadError ? <ErrorText message={`Could not load care circles: ${loadError}`} /> : <Muted>Loading...</Muted>}
          <Button kind="secondary" icon="refresh" label="Try again" onPress={load} />
        </Sheet>
      )}

      {editing && data && (
        <ProfileEditor
          profile={editing === 'new' ? null : editing}
          data={data}
          isCurrent={editing !== 'new' && editing.id === session.user.id}
          close={() => setEditing(null)}
          saved={async (d, switchId) => { setData(d); setEditing(null); if (switchId) await switchTo(switchId); else onSwitch(); }}
        />
      )}
    </View>
  );
}

function ProfileEditor({ profile, data, isCurrent, close, saved }: {
  profile: TestProfile | null; data: Profiles; isCurrent: boolean; close: () => void; saved: (d: Profiles, switchTo?: string) => void;
}) {
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<Record<string, '' | Role>>(() => Object.fromEntries(data.circles.map((c) => [c.id, profile?.memberships.find((m) => m.circleId === c.id)?.role || ''])));
  const [circleId, setCircleId] = useState<string>(data.circles[0]?.id || '');
  const [role, setRole] = useState<Role>('family');
  const [switchAfter, setSwitchAfter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      if (!profile) {
        const r = await api.addProfile({ name, circleId: circleId || undefined, role, username: username.trim() || undefined, password: password || undefined });
        saved(r, switchAfter ? r.id : undefined);
        return;
      }
      let d: Profiles | null = null;
      const login: { name?: string; username?: string; password?: string } = {};
      if (name.trim() && name.trim() !== profile.name) login.name = name;
      if (username.trim() && username.trim().toLowerCase() !== profile.username) login.username = username;
      if (password) login.password = password;
      if (Object.keys(login).length) d = await api.editProfile(profile.id, login);
      for (const c of data.circles) {
        const before = profile.memberships.find((m) => m.circleId === c.id)?.role || '';
        if (roles[c.id] !== before) d = await api.editProfile(profile.id, { circleId: c.id, role: roles[c.id] });
      }
      saved(d || data);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Sheet visible title={profile ? `Edit ${profile.name}` : 'Add a test profile'} onClose={close}>
      <Field label="Name" value={name} onChange={setName} placeholder="For example Auntie Rosa, Helper Maria, Dad" />
      <Field label={profile ? 'Username (for signing in)' : 'Username (optional, made from the name if blank)'} value={username} onChange={setUsername} placeholder="for example maria" autoComplete="off" />
      <Field label={profile ? 'New password (leave blank to keep the current one)' : 'Password (optional, uses the standard test password if blank)'} value={password} onChange={setPassword} placeholder="At least 8 characters" secure autoComplete="new-password" />
      {profile?.customPassword && <Button small kind="ghost" icon="key-outline" label="Go back to the standard test password" onPress={async () => { try { saved(await api.editProfile(profile.id, { resetPassword: true })); } catch (e: any) { setError(e.message); } }} />}
      {!profile ? (
        <>
          <Choice label="Care circle" value={circleId} onChange={setCircleId} options={[...data.circles.map((c) => ({ value: c.id, label: c.name })), { value: '', label: 'None yet (set up a new circle)' }]} />
          {!!circleId && <Choice label="Role in this circle" value={role} onChange={setRole} options={ROLE_OPTIONS} />}
          <Choice label="After adding" value={switchAfter ? 'yes' : 'no'} onChange={(v) => setSwitchAfter(v === 'yes')} options={[{ value: 'yes', label: 'Switch to this profile' }, { value: 'no', label: 'Stay as I am' }]} />
          <Muted>Choose "None yet" to test setting up a brand-new care circle, for example for a second parent.</Muted>
        </>
      ) : (
        data.circles.map((c) => (
          <Choice key={c.id} label={`Role in ${c.name}`} value={roles[c.id]} onChange={(v) => setRoles({ ...roles, [c.id]: v })} options={IN_CIRCLE} />
        ))
      )}
      <ErrorText message={error} />
      <Button icon="checkmark" label={busy ? 'Saving...' : profile ? 'Save changes' : 'Add profile'} disabled={busy || !name.trim()} onPress={save} />
      {profile && !profile.builtIn && (
        <Button kind="danger" icon="trash-outline" label="Remove this profile" disabled={busy} onPress={async () => {
          setBusy(true); setError(null);
          try { const d = await api.removeProfile(profile.id); saved(d, isCurrent ? 'demo-thomas' : undefined); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
        }} />
      )}
      {profile?.builtIn && <Muted>Demo people cannot be removed. "Reset demo data" puts them back as they were.</Muted>}
    </Sheet>
  );
}

const st = StyleSheet.create({
  bar: { backgroundColor: colors.warnSoft, borderBottomWidth: 1, borderBottomColor: colors.warnBorder, paddingTop: 8, paddingBottom: 6, paddingHorizontal: 12, gap: 6 },
  title: { fontSize: 12, fontWeight: '800', color: colors.warnText, flex: 1 },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#D9A21B', backgroundColor: colors.card },
  manageText: { fontSize: 12, fontWeight: '700', color: colors.warnText },
  ring: { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.warnSoft },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  name: { fontSize: 11, color: colors.warnText, marginTop: 2, maxWidth: 58, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
