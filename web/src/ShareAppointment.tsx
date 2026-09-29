import { useState } from 'react';
import { Text } from 'react-native';
import { Appointment, authUrl, CircleData, fmtDateTime } from './api';
import { colors } from './theme';
import { ListItem, Muted, Sheet } from './ui';

// Share an appointment: the phone's own share sheet (iPhone and Android), add to a calendar,
// email, WhatsApp, or copy the details.
export function appointmentText(a: Appointment, data: CircleData) {
  const escort = a.escortUserId ? data.members.find((m) => m.userId === a.escortUserId)?.name || 'Someone' : '';
  return [
    `${a.title} (${data.circle.parentName})`,
    `When: ${fmtDateTime(a.startsAt)}`,
    a.location ? `Where: ${a.location}` : '',
    escort ? `Going with ${data.circle.parentName}: ${escort}` : 'Escort still needed',
    a.notes ? `Notes: ${a.notes}` : '',
  ].filter(Boolean).join('\n');
}

const gcalTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export default function ShareAppointment({ a, data, cid, close }: { a: Appointment; data: CircleData; cid: string; close: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const text = appointmentText(a, data);
  const subject = `${a.title} (${data.circle.parentName}), ${fmtDateTime(a.startsAt)}`;
  const icsUrl = `/api/circles/${cid}/appointments/${a.id}.ics`;
  const canShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  async function nativeShare() {
    try {
      let files: File[] | undefined;
      try {
        const res = await fetch(icsUrl, { credentials: 'include' });
        if (res.ok) {
          const f = new File([await res.blob()], 'appointment.ics', { type: 'text/calendar' });
          if ((navigator as any).canShare?.({ files: [f] })) files = [f];
        }
      } catch { /* share text only */ }
      await (navigator as any).share({ title: subject, text, ...(files ? { files } : {}) });
      close();
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMsg('Sharing is not available here. Use one of the options below.');
    }
  }

  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${a.title} (${data.circle.parentName})`)}&dates=${gcalTime(a.startsAt)}/${gcalTime(new Date(new Date(a.startsAt).getTime() + 3600e3).toISOString())}&location=${encodeURIComponent(a.location || '')}&details=${encodeURIComponent(text)}`;

  return (
    <Sheet visible title="Share appointment" onClose={close}>
      <Muted>{text}</Muted>
      {canShare && <ListItem icon="share-outline" title="Share..." subtitle="Opens your phone's share options: Messages, WhatsApp, Mail, Telegram and more" onPress={nativeShare} />}
      <ListItem icon="calendar-outline" iconColor={colors.info} title="Add to my calendar" subtitle="iPhone, Android, Outlook (opens a calendar file)" onPress={() => { window.location.href = authUrl(icsUrl); }} />
      <ListItem icon="logo-google" iconColor="#4285F4" title="Add to Google Calendar" subtitle="Opens Google Calendar with the details filled in" onPress={() => { window.open(gcal, '_blank', 'noopener'); }} />
      <ListItem icon="mail-outline" iconColor={colors.danger} title="Email" subtitle="Opens your email app with the details" onPress={() => { window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`; }} />
      <ListItem icon="logo-whatsapp" iconColor="#25D366" title="WhatsApp" subtitle="Send the details in a WhatsApp chat" onPress={() => { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); }} />
      <ListItem icon="copy-outline" iconColor={colors.muted} title="Copy details" subtitle="Paste them anywhere" onPress={async () => {
        try { await navigator.clipboard.writeText(text); setMsg('Copied.'); } catch { setMsg('Could not copy on this device.'); }
      }} />
      <ListItem icon="download-outline" iconColor={colors.muted} title="Download calendar file (.ics)" subtitle="To attach to an email yourself" onPress={() => { window.location.href = authUrl(`${icsUrl}?download=1`); }} />
      {!!msg && <Text style={{ color: colors.primary, fontWeight: '700' }}>{msg}</Text>}
    </Sheet>
  );
}
