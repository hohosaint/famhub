import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, NotifyMode, Prefs } from '../api';
import { colors } from '../theme';
import { Badge, Banner, Button, Card, DateField, ErrorText, Field, Icon, MultiChoice, Muted, Overline, Row, Segmented, Toggle, s } from '../ui';
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from '../push';
import { PageHeader } from './shared';

const MODE_LABEL: Record<NotifyMode, string> = { push: 'Alert', inbox: 'Inbox', digest: 'Summary', off: 'Off' };

export default function NotifySettingsScreen({ onPushChange }: { onPushChange: (on: boolean) => void }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [deviceOn, setDeviceOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.prefs().then(setPrefs).catch((e) => setError(e.message));
    currentSubscription().then((sub) => setDeviceOn(Boolean(sub) && typeof Notification !== 'undefined' && Notification.permission === 'granted')).catch(() => {});
  }, []);

  async function toggleDevice() {
    setBusy(true); setError(null); setMsg(null);
    try {
      if (deviceOn) { await disablePush(); setDeviceOn(false); onPushChange(false); setMsg('Notifications turned off on this device.'); }
      else { await enablePush(); setDeviceOn(true); onPushChange(true); setMsg('Done. This device will now get Famhub alerts.'); }
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function save(next: Partial<Prefs>) {
    if (!prefs) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    try { setError(null); setPrefs({ ...merged, ...(await api.savePrefs({ categories: merged.categories, quietStart: merged.quietStart, quietEnd: merged.quietEnd, digestTime: merged.digestTime, ...(next.email ? { email: next.email } : {}), ...(next.whatsapp ? { whatsapp: next.whatsapp } : {}) })) }); setMsg('Saved.'); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <View style={{ gap: 16 }}>
      <PageHeader title="Notification settings" subtitle="Choose what reaches you, and how" />
      <ErrorText message={error} />
      {!!msg && <Text style={{ color: colors.ok, fontWeight: '600' }}>{msg}</Text>}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row><Icon name="phone-portrait-outline" size={22} color={colors.primary} /><Text style={s.itemTitle}>This device</Text></Row>
          <Badge label={deviceOn ? 'Alerts on' : 'Alerts off'} tone={deviceOn ? 'good' : 'neutral'} />
        </Row>
        <Muted>Alerts pop up on this phone or computer even when Famhub is closed.</Muted>
        {pushSupported() ? (
          <Row>
            <Button label={deviceOn ? 'Turn off on this device' : 'Turn on alerts on this device'} kind={deviceOn ? 'ghost' : 'primary'} icon={deviceOn ? 'notifications-off-outline' : 'notifications-outline'} disabled={busy} onPress={toggleDevice} />
            {deviceOn && <Button kind="secondary" label="Send a test" icon="paper-plane-outline" onPress={async () => { const r = await api.pushTest(); setMsg(`Test sent to ${r.devices} device${r.devices === 1 ? '' : 's'}.`); }} />}
          </Row>
        ) : (
          <Banner tone="warn">
            <Text style={{ fontSize: 15 }}>{isIos() && !isStandalone() ? 'On iPhone: tap Share, then "Add to Home Screen". Open Famhub from the Home Screen and come back here to turn alerts on.' : 'This browser does not support alerts. Try Chrome, Edge, Firefox or Safari.'}</Text>
          </Banner>
        )}
        {prefs && prefs.devices > 0 && <Muted>{prefs.devices} device{prefs.devices === 1 ? '' : 's'} set up for your account.</Muted>}
      </Card>

      {prefs && <WhatsAppCard prefs={prefs} save={save} setMsg={setMsg} setError={setError} />}
      {prefs && <EmailCard prefs={prefs} save={save} setMsg={setMsg} setError={setError} />}

      {prefs && (
        <>
          <Overline>What to receive</Overline>
          <Muted>Alert: pop-up plus inbox. Inbox: quietly in the app. Summary: one daily summary. Off: nothing.</Muted>
          <Card style={{ gap: 16 }}>
            {Object.entries(prefs.catalogue).map(([key, cat]) => (
              <View key={key} style={{ gap: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', flex: 1 }}>{cat.label}</Text>
                  {cat.locked && <Badge label="Always on" tone="bad" />}
                </Row>
                <Text style={s.small}>{cat.help}</Text>
                {!cat.locked && (
                  <Segmented value={prefs.categories[key] || 'inbox'} onChange={(v) => save({ categories: { ...prefs.categories, [key]: v } })} options={prefs.modes.map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
                )}
              </View>
            ))}
          </Card>

          <Overline>Quiet hours</Overline>
          <Card>
            <Muted>During quiet hours, alerts wait until the morning. Emergencies still come through.</Muted>
            <Row style={{ flexWrap: 'nowrap' }}>
              <View style={{ flex: 1 }}><DateField timeOnly label="From" value={prefs.quietStart} onChange={(v) => save({ quietStart: v })} /></View>
              <View style={{ flex: 1 }}><DateField timeOnly label="Until" value={prefs.quietEnd} onChange={(v) => save({ quietEnd: v })} /></View>
            </Row>
            <DateField timeOnly label="Send my daily summary at" value={prefs.digestTime} onChange={(v) => save({ digestTime: v })} />
          </Card>

          <Overline>How Famhub escalates</Overline>
          <Card>
            {[
              ['medkit-outline', 'Medicines: the helper and parent are reminded at the dose time. If nobody ticks it within 30 minutes, the family is told.'],
              ['sunny-outline', 'Check-in: if there is no "I\'m OK" by the expected time, family and helper are told. After another hour it becomes an emergency.'],
              ['warning-outline', '"I need help": everyone is alerted at once and again every 5 minutes until someone taps "I\'m handling it".'],
              ['calendar-outline', 'Appointments: the escort and parent get a reminder the evening before and an hour before. If nobody is going 48 hours before, family is asked.'],
            ].map(([icon, text]) => (
              <Row key={text} style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><Icon name={icon as any} size={20} color={colors.primary} /><Text style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{text}</Text></Row>
            ))}
          </Card>
        </>
      )}
    </View>
  );
}

// Email alerts: sent at the same moment as the app alert, for the chosen categories.
function EmailCard({ prefs, save, setMsg, setError }: { prefs: Prefs; save: (p: Partial<Prefs>) => Promise<void>; setMsg: (m: string | null) => void; setError: (m: string | null) => void }) {
  const [address, setAddress] = useState(prefs.email.address);
  const options = Object.entries(prefs.catalogue).filter(([k]) => k !== 'emergency').map(([value, c]) => ({ value, label: c.label }));
  const email = (patch: Partial<Prefs['email']>) => save({ email: { ...prefs.email, address: address.trim(), ...patch } });
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row><Icon name="mail-outline" size={22} color={colors.primary} /><Text style={s.itemTitle}>Email alerts</Text></Row>
        <Badge label={prefs.email.on ? 'Email on' : 'Email off'} tone={prefs.email.on ? 'good' : 'neutral'} />
      </Row>
      <Muted>Get an email at the same time as the app alert, for example when a medicine or task is due, or when help is needed. Emergencies are always emailed when this is on.</Muted>
      <Field label="Email address" value={address} onChange={setAddress} placeholder="you@example.com" keyboard="email-address" autoComplete="email" />
      <Toggle label="Send me email alerts" value={prefs.email.on} onChange={(on) => email({ on })} />
      {prefs.email.on && <MultiChoice label="Also email me about" options={options} values={prefs.email.categories.filter((c) => c !== 'emergency')} onChange={(v) => email({ categories: ['emergency', ...v] })} />}
      <Row>
        <Button small kind="secondary" icon="save-outline" label="Save address" onPress={() => email({})} />
        <Button small kind="secondary" icon="paper-plane-outline" label="Send a test email" onPress={async () => {
          try { const r = await api.emailTest(address.trim()); setError(null); setMsg(r.status === 'sent' ? `Test email sent to ${r.to}.` : `Test email ${r.status}${r.error ? `: ${r.error}` : ''}.`); } catch (e: any) { setError(e.message); }
        }} />
      </Row>
      {prefs.emailSetup === 'none' && <Banner tone="warn"><Text style={{ fontSize: 14 }}>Email sending is not set up on the server yet, so emails are only recorded in the test Email outbox. See the deployment guide, "Email and WhatsApp alerts".</Text></Banner>}
    </Card>
  );
}

// WhatsApp alerts to a mobile phone: sent at the same moment as the app alert, for the chosen categories.
function WhatsAppCard({ prefs, save, setMsg, setError }: { prefs: Prefs; save: (p: Partial<Prefs>) => Promise<void>; setMsg: (m: string | null) => void; setError: (m: string | null) => void }) {
  const [number, setNumber] = useState(prefs.whatsapp.number);
  const options = Object.entries(prefs.catalogue).filter(([k]) => k !== 'emergency').map(([value, c]) => ({ value, label: c.label }));
  const wa = (patch: Partial<Prefs['whatsapp']>) => save({ whatsapp: { ...prefs.whatsapp, number: number.trim(), ...patch } });
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row><Icon name="logo-whatsapp" size={22} color="#25D366" /><Text style={s.itemTitle}>WhatsApp alerts</Text></Row>
        <Badge label={prefs.whatsapp.on ? 'WhatsApp on' : 'WhatsApp off'} tone={prefs.whatsapp.on ? 'good' : 'neutral'} />
      </Row>
      <Muted>Get a WhatsApp message on your mobile phone at the same time as the app alert, for example when a medicine or task is due, or when help is needed. Emergencies are always sent when this is on.</Muted>
      <Field label="Mobile number on WhatsApp" value={number} onChange={setNumber} placeholder="9123 4567" keyboard="phone-pad" autoComplete="tel" />
      <Toggle label="Send me WhatsApp alerts" value={prefs.whatsapp.on} onChange={(on) => wa({ on })} />
      {prefs.whatsapp.on && <MultiChoice label="Also send me WhatsApp messages about" options={options} values={prefs.whatsapp.categories.filter((c) => c !== 'emergency')} onChange={(v) => wa({ categories: ['emergency', ...v] })} />}
      <Row>
        <Button small kind="secondary" icon="save-outline" label="Save number" onPress={() => wa({})} />
        <Button small kind="secondary" icon="paper-plane-outline" label="Send a test message" onPress={async () => {
          try { const r = await api.whatsappTest(number.trim()); setError(null); setMsg(r.status === 'sent' ? `Test message sent to ${r.to}.` : `Test message ${r.status}${r.error ? `: ${r.error}` : ''}.`); } catch (e: any) { setError(e.message); }
        }} />
      </Row>
      {prefs.whatsappSetup === 'none' && <Banner tone="warn"><Text style={{ fontSize: 14 }}>WhatsApp sending is not set up on the server yet, so messages are only recorded in the test Message outbox. See the deployment guide, "Email and WhatsApp alerts".</Text></Banner>}
    </Card>
  );
}
