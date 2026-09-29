import WhoIsOnline from '../WhoIsOnline';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, fmtDate, Role, roleLabel } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, Choice, Empty, ErrorText, Field, Link, Muted, Row, s, Title } from '../ui';
import { run, ScreenProps } from './shared';

const ROLE_HELP: Record<Role, string> = {
  owner: 'Everything, including settings and members',
  family: 'Everything except settings and members; can invite',
  helper: 'Calendar, tasks, medicines, notes, shared documents; no money',
  parent: 'Simple large view: I\'m OK, I need help, medicines, next appointment',
};

export default function CircleScreen({ data, cid, refresh }: ScreenProps) {
  const c = data.circle;
  const [name, setName] = useState(c.name);
  const [parentName, setParentName] = useState(c.parentName);
  const [parentPhone, setParentPhone] = useState(c.parentPhone);
  const [checkinBy, setCheckinBy] = useState(c.checkinBy);
  const [contacts, setContacts] = useState(c.emergencyContacts.map((x) => ({ ...x })));
  const [inviteRole, setInviteRole] = useState<Role>('family');
  const [newPerson, setNewPerson] = useState('');
  const [newRole, setNewRole] = useState<Role>('helper');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = data.can.manageMembers;

  async function saveSettings() {
    setSaved(false);
    if (await run(() => api.updateCircle(cid, { name, parentName, parentPhone, checkinBy, emergencyContacts: contacts }), refresh, setError)) setSaved(true);
  }

  return (
    <View style={{ gap: 12 }}>
      <ErrorText message={error} />
      <Card>
        <Title>Emergency contacts</Title>
        {c.parentPhone ? <Text style={{ fontSize: 16 }}>{c.parentName}: <Link label={c.parentPhone} onPress={() => { window.location.href = `tel:${c.parentPhone}`; }} /></Text> : null}
        {c.emergencyContacts.map((x, i) => (
          <Text key={i} style={{ fontSize: 16 }}>{x.name} ({x.relation}): <Link label={x.phone} onPress={() => { window.location.href = `tel:${x.phone}`; }} /></Text>
        ))}
        {!c.emergencyContacts.length && !c.parentPhone && <Empty>None added yet.</Empty>}
      </Card>

      <WhoIsOnline data={data} cid={cid} />

      <Card>
        <Title>Members ({data.members.length})</Title>
        {data.members.map((m) => (
          <View key={m.userId} style={{ gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, flex: 1 }}>{m.name}{m.userId === data.me.userId ? ' (you)' : ''}{m.placeholder ? ' · no sign-in' : ''}</Text>
              <Badge label={roleLabel[m.role]} tone={m.role === 'owner' ? 'info' : 'neutral'} />
            </Row>
            {owner && m.userId !== data.me.userId && (
              <Row>
                <Link label="Change role" onPress={() => setEditingRole(editingRole === m.userId ? null : m.userId)} />
                <Link label="Remove" danger onPress={() => run(() => api.removeMember(cid, m.userId), refresh, setError)} />
              </Row>
            )}
            {editingRole === m.userId && (
              <Choice label="Role" value={m.role} onChange={(r) => { setEditingRole(null); run(() => api.setRole(cid, m.userId, r), refresh, setError); }} options={(['owner', 'family', 'helper', 'parent'] as Role[]).map((r) => ({ value: r, label: roleLabel[r] }))} />
            )}
          </View>
        ))}
        <Muted>What each role can do:</Muted>
        {(Object.keys(ROLE_HELP) as Role[]).map((r) => <Muted key={r}>• {roleLabel[r]}: {ROLE_HELP[r]}</Muted>)}
      </Card>

      {data.can.invite && (
        <Card>
          <Title>Invite someone</Title>
          <Muted>Create a code and send it by chat. The person signs in, chooses "Join with an invite code" and enters it. Codes last 7 days and work once.</Muted>
          <Choice label="They will join as" value={inviteRole} onChange={setInviteRole} options={(data.role === 'owner' ? ['family', 'helper', 'parent', 'owner'] : ['family', 'helper', 'parent']).map((r) => ({ value: r as Role, label: roleLabel[r as Role] }))} />
          <Button label="Create invite code" onPress={() => run(() => api.createInvite(cid, inviteRole), refresh, setError)} />
          {(data.invites || []).map((i) => (
            <Row key={i.code} style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 22, fontWeight: '700', letterSpacing: 3 }}>{i.code}</Text>
              <Muted>{roleLabel[i.role]} · until {fmtDate(i.expiresAt.slice(0, 10))}</Muted>
              <Link label="Cancel" danger onPress={() => run(() => api.deleteInvite(cid, i.code), refresh, setError)} />
            </Row>
          ))}
        </Card>
      )}

      {owner && (
        <Card>
          <Title>Add someone who will not sign in</Title>
          <Muted>For example a helper without a smartphone, so tasks and escorts can still be assigned to them.</Muted>
          <Field label="Name" value={newPerson} onChange={setNewPerson} placeholder="Auntie Rosa" />
          <Choice label="Role" value={newRole} onChange={setNewRole} options={(['family', 'helper', 'parent'] as Role[]).map((r) => ({ value: r, label: roleLabel[r] }))} />
          <Button label="Add" onPress={async () => { if (await run(() => api.addPerson(cid, { name: newPerson, role: newRole }), refresh, setError)) setNewPerson(''); }} />
        </Card>
      )}

      {data.can.editCircle && (
        <Card>
          <Title>Circle settings</Title>
          <Field label="Circle name" value={name} onChange={setName} />
          <Field label="Parent's name (as shown in the app)" value={parentName} onChange={setParentName} />
          <Field label="Parent's phone" value={parentPhone} onChange={setParentPhone} keyboard="phone-pad" />
          <Field label="Expect a check-in by (24-hour time)" value={checkinBy} onChange={setCheckinBy} placeholder="10:00" />
          <Text style={s.label}>Emergency contacts</Text>
          {contacts.map((x, i) => (
            <View key={i} style={{ gap: 6, padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
              <Field label="Name" value={x.name} onChange={(v) => setContacts(contacts.map((y, j) => (j === i ? { ...y, name: v } : y)))} />
              <Field label="Phone" value={x.phone} onChange={(v) => setContacts(contacts.map((y, j) => (j === i ? { ...y, phone: v } : y)))} keyboard="phone-pad" />
              <Field label="Relation" value={x.relation} onChange={(v) => setContacts(contacts.map((y, j) => (j === i ? { ...y, relation: v } : y)))} />
              <Link label="Remove contact" danger onPress={() => setContacts(contacts.filter((_, j) => j !== i))} />
            </View>
          ))}
          {contacts.length < 5 && <Link label="+ Add contact" onPress={() => setContacts([...contacts, { name: '', phone: '', relation: '' }])} />}
          {saved && <Muted>Saved.</Muted>}
          <Button label="Save settings" onPress={saveSettings} />
        </Card>
      )}

      <Card>
        <Title>Leave this circle</Title>
        <Muted>You will no longer see this circle. An owner can invite you back.</Muted>
        <Button label="Leave circle" kind="danger" onPress={() => run(() => api.removeMember(cid, data.me.userId), refresh, setError)} />
      </Card>
    </View>
  );
}
