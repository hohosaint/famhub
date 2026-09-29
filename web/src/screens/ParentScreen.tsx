import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, fmtAgo, fmtDateTime, fmtTime, photosOf, todaySG } from '../api';
import { Photo, PhotoCapture, PhotoGrid } from '../Photos';
import { colors, shadow } from '../theme';
import { ErrorText, Icon } from '../ui';
import { DoseGroups } from './CareScreen';
import { nameOf, run, ScreenProps, sgDayOf } from './shared';

// Very large, simple view for the parent.
export default function ParentScreen(props: ScreenProps & { reminders: { id: string; title: string }[] }) {
  const { data, cid, refresh, reminders, go } = props;
  const [confirmHelp, setConfirmHelp] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date().toISOString();
  const next = data.appointments.find((a) => a.startsAt >= now);
  const last = data.lastCheckin;
  const checkedToday = last && sgDayOf(last.createdAt) === todaySG();
  const helpOpen = data.openHelp.length > 0;
  const big = { fontSize: 26, color: colors.text, textAlign: 'center' as const, lineHeight: 34 };
  const card = { width: '100%' as const, maxWidth: 560, backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 12, ...shadow };

  return (
    <View style={{ gap: 20, alignItems: 'center', paddingBottom: 30 }}>
      <Text style={{ fontSize: 40, fontWeight: '800', textAlign: 'center', color: colors.text }}>Hello {data.circle.parentName}</Text>
      {reminders.length > 0 && (
        <View style={[card, { backgroundColor: colors.warnSoft }]}>
          {reminders.slice(0, 3).map((r) => <View key={r.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Icon name="notifications" size={28} color={colors.warn} /><Text style={[big, { textAlign: 'left', flex: 1 }]}>{r.title}</Text></View>)}
        </View>
      )}
      <Pressable
        accessibilityRole="button" accessibilityLabel="I'm OK. Tell my family I am fine today."
        onPress={() => run(() => api.checkin(cid, 'ok'), refresh, setError)}
        style={({ pressed }) => ({ width: 240, height: 240, borderRadius: 120, backgroundColor: pressed ? '#0B5A2A' : colors.ok, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.25 })}
      >
        <Icon name="happy-outline" size={64} color="#fff" />
        <Text style={{ fontSize: 42, fontWeight: '800', color: '#fff' }}>I'm OK</Text>
      </Pressable>
      <Text style={big}>{checkedToday ? `Thank you. Your family knows you are OK (${fmtTime(last!.createdAt)}).` : 'Tap the green button to tell your family you are OK.'}</Text>

      {helpOpen ? null : !confirmHelp ? (
        <Pressable accessibilityRole="button" onPress={() => setConfirmHelp(true)} style={{ backgroundColor: colors.danger, borderRadius: 20, paddingVertical: 22, paddingHorizontal: 30, minWidth: 280, alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
          <Icon name="warning" size={34} color="#fff" />
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff' }}>I need help</Text>
        </Pressable>
      ) : (
        <View style={card}>
          <Text style={big}>Tell your family you need help now?</Text>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
            <Pressable accessibilityRole="button" onPress={async () => { setConfirmHelp(false); await run(() => api.checkin(cid, 'help'), refresh, setError); }} style={{ backgroundColor: colors.danger, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 26 }}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>Yes, help</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirmHelp(false)} style={{ backgroundColor: colors.surfaceAlt2, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 26 }}>
              <Text style={{ fontSize: 26, fontWeight: '700' }}>No</Text>
            </Pressable>
          </View>
        </View>
      )}
      {helpOpen && <Text style={[big, { color: colors.danger, fontWeight: '800' }]}>{data.openHelp[0].resolvedBy ? `${nameOf(data, data.openHelp[0].resolvedBy)} is coming.` : 'Your family has been told. Someone will call you.'}</Text>}
      {helpOpen && !confirmCancel && (
        <Pressable accessibilityRole="button" accessibilityLabel="I pressed it by mistake. Cancel the help call." onPress={() => setConfirmCancel(true)}
          style={({ pressed }) => ({ backgroundColor: pressed ? colors.borderStrong : colors.surfaceAlt2, borderRadius: 20, paddingVertical: 20, paddingHorizontal: 26, minWidth: 280, alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'center' })}>
          <Icon name="arrow-undo" size={30} color={colors.text} />
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>Pressed by mistake</Text>
        </Pressable>
      )}
      {helpOpen && confirmCancel && (
        <View style={card}>
          <Text style={big}>Cancel the help call and tell your family you are OK?</Text>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Pressable accessibilityRole="button" onPress={async () => { setConfirmCancel(false); await run(() => api.cancelHelp(cid, data.openHelp[0].id), refresh, setError); }} style={{ backgroundColor: colors.ok, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 26 }}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>Yes, I'm OK</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirmCancel(false)} style={{ backgroundColor: colors.danger, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 26 }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: '#fff' }}>No, I need help</Text>
            </Pressable>
          </View>
        </View>
      )}
      <ErrorText message={error} />

      <Pressable accessibilityRole="button" onPress={() => go('photos')} style={({ pressed }) => [card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: pressed ? colors.primarySoft : colors.card, borderWidth: 2, borderColor: colors.primary }]}>
        <Icon name="camera" size={40} color={colors.primary} />
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>Send a photo</Text>
      </Pressable>

      <View style={card}>
        <Text style={{ fontSize: 28, fontWeight: '800', textAlign: 'center' }}>My medicines today</Text>
        <DoseGroups props={props} big setError={setError} />
      </View>

      {next && (
        <View style={[card, { alignItems: 'center' }]}>
          <Text style={{ fontSize: 22, color: colors.muted }}>Next appointment</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', textAlign: 'center' }}>{next.title}</Text>
          <Text style={big}>{fmtDateTime(next.startsAt)}</Text>
          {!!next.location && <Text style={big}>{next.location}</Text>}
          {!!next.escortUserId && <Text style={big}>{nameOf(data, next.escortUserId)} will go with you</Text>}
        </View>
      )}

      {data.circle.emergencyContacts.length > 0 && (
        <View style={card}>
          <Text style={{ fontSize: 28, fontWeight: '800', textAlign: 'center' }}>Call my family</Text>
          {data.circle.emergencyContacts.map((c, i) => (
            <Pressable key={i} accessibilityRole="button" onPress={() => { window.location.href = `tel:${c.phone}`; }} style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              <Icon name="call" size={28} color="#fff" />
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const QUICK_WORDS = ['Hello from me', 'My meal today', 'Look at this', 'Is this OK?'];

// Parent's photo page: big buttons to take or choose a photo, then send it to the family.
export function ParentPhotos(props: ScreenProps) {
  const { data, cid, refresh } = props;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [words, setWords] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const big = { fontSize: 24, color: colors.text, textAlign: 'center' as const, lineHeight: 32 };
  const card = { width: '100%' as const, maxWidth: 560, backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 14, ...shadow };
  const withPhotos = data.notes.filter((n) => photosOf(n).length > 0).slice(0, 12);

  async function send() {
    setSending(true);
    const ok = await run(() => api.addNote(cid, { text: words, fileIds: photos.map((p) => p.id) }), refresh, setError);
    setSending(false);
    if (ok) { setPhotos([]); setWords(''); setSent(true); }
  }

  return (
    <View style={{ gap: 20, alignItems: 'center', paddingBottom: 30 }}>
      <Text style={{ fontSize: 36, fontWeight: '800', textAlign: 'center', color: colors.text }}>Photos</Text>
      <View style={card}>
        <Text style={[big, { fontWeight: '800' }]}>Send a photo to your family</Text>
        <PhotoCapture cid={cid} photos={photos} setPhotos={(p) => { setPhotos(p); setSent(false); }} max={4} big onError={setError} />
        {photos.length > 0 && (
          <>
            <Text style={[big, { fontSize: 20 }]}>Add a few words (you can skip this)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {QUICK_WORDS.map((w) => (
                <Pressable key={w} accessibilityRole="button" onPress={() => setWords(w)} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: words === w ? colors.primary : colors.primarySoft }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: words === w ? '#fff' : colors.primary }}>{w}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={words} onChangeText={setWords} placeholder="Or type here" placeholderTextColor={colors.faint} accessibilityLabel="Words to send with the photo" style={{ fontSize: 22, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 14, backgroundColor: colors.card }} />
            <Pressable accessibilityRole="button" disabled={sending} onPress={send} style={({ pressed }) => ({ backgroundColor: pressed ? '#0B5A2A' : colors.ok, borderRadius: 20, paddingVertical: 22, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12, opacity: sending ? 0.6 : 1 })}>
              <Icon name="send" size={30} color="#fff" />
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>{sending ? 'Sending...' : 'Send to my family'}</Text>
            </Pressable>
          </>
        )}
        {sent && <Text style={[big, { color: colors.ok, fontWeight: '800' }]}>Sent. Your family can see your photo now.</Text>}
        <ErrorText message={error} />
      </View>

      <View style={card}>
        <Text style={[big, { fontWeight: '800', fontSize: 28 }]}>Photos from the family</Text>
        {!withPhotos.length && <Text style={big}>No photos yet.</Text>}
        {withPhotos.map((n) => (
          <View key={n.id} style={{ gap: 8 }}>
            <Text style={{ fontSize: 20, color: colors.muted }}>{n.authorUserId === data.me.userId ? 'You' : nameOf(data, n.authorUserId)} · {fmtAgo(n.createdAt)}</Text>
            <PhotoGrid ids={photosOf(n)} height={280} />
            {!!n.text && <Text style={[big, { textAlign: 'left', fontSize: 22 }]}>{n.text}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
