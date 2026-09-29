import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { APP_VERSION, getWindowToken, setWindowToken, api, CircleData, Inbox, Notice, roleLabel, Session, signOut } from './src/api';
import { colors, shadow } from './src/theme';
import { Avatar, Button, ErrorText, Gradient, Icon, IconButton, IconName, Row, Sheet, ListItem } from './src/ui';
import { addInstallTags, currentSubscription, registerServiceWorker } from './src/push';
import TodayScreen from './src/screens/TodayScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import CareScreen from './src/screens/CareScreen';
import RequestsScreen from './src/screens/RequestsScreen';
import UpdatesScreen from './src/screens/UpdatesScreen';
import MoreScreen from './src/screens/MoreScreen';
import InboxScreen, { CATEGORY_ICON } from './src/screens/InboxScreen';
import NotifySettingsScreen from './src/screens/NotifySettingsScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import CostsScreen from './src/screens/CostsScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import RenewalsScreen from './src/screens/RenewalsScreen';
import CircleScreen from './src/screens/CircleScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import MeScreen from './src/screens/MeScreen';
import ProfileSwitcher from './src/ProfileSwitcher';
import LoginScreen from './src/screens/LoginScreen';
import RepeatsScreen from './src/screens/RepeatsScreen';
import VisitsScreen from './src/screens/VisitsScreen';
import { AlsoHere, LiveCursors, LivePill, NavPresenceLayer, PresenceSheet, ScrollPins, usePresence } from './src/Presence';
import { lastCursorX, setCursor, setScroll } from './src/doing';
import ParentScreen, { ParentPhotos } from './src/screens/ParentScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import BabyScreen from './src/screens/BabyScreen';
import BabyReportScreen from './src/screens/BabyReportScreen';
import LaunchWizard from './src/screens/LaunchWizard';
import AppearanceSettings, { DarkToggle } from './src/Appearance';
import FamilyTabs, { EmptyKind, lastCircle, rememberCircle } from './src/FamilyTabs';
import { kindOf } from './src/family';
import type { CareFor } from './src/api';
import { PageHeader } from './src/screens/shared';

const NAV: { key: string; label: string; icon: IconName; iconOn: IconName }[] = [
  { key: 'home', label: 'Today', icon: 'home-outline', iconOn: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconOn: 'calendar' },
  { key: 'care', label: 'Care', icon: 'medkit-outline', iconOn: 'medkit' },
  { key: 'requests', label: 'Requests', icon: 'hand-left-outline', iconOn: 'hand-left' },
  { key: 'updates', label: 'Updates', icon: 'chatbubbles-outline', iconOn: 'chatbubbles' },
  { key: 'more', label: 'More', icon: 'grid-outline', iconOn: 'grid' },
];
const SUB_TITLES: Record<string, string> = { appearance: 'Appearance', visits: 'Visit notes', repeats: 'Repeating items', costs: 'Costs', payments: 'Payments', docs: 'Documents', renewals: 'Renewals', circle: 'Circle and people', activity: 'Activity log', me: 'My profile' };

// Test mode: act as any demo person to try each role.
// Shows a system notification from the open app when alerts are allowed, so an urgent alert
// is seen even if this browser has no push subscription (for example while testing on a PC).
async function showDeviceAlert(n: Notice) {
  try {
    if (Platform.OS !== 'web' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (n.priority !== 'urgent' && !document.hidden) return;
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts: NotificationOptions & { renotify?: boolean; requireInteraction?: boolean } = { body: n.body, tag: `famhub-${n.id}`, icon: '/icon-192.png', requireInteraction: n.priority === 'urgent', data: { url: `/?open=${n.id}` } };
    if (reg) await reg.showNotification(n.title, opts);
    else new Notification(n.title, opts);
  } catch { /* not allowed on this device */ }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [health, setHealth] = useState<{ version?: string; builtAt?: string; startedAt?: string; mode?: string } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  useEffect(() => { fetch('/api/health').then((r) => r.json()).then((h) => { setHealth(h); setServerVersion(String(h.version || '?')); }).catch(() => {}); }, []);
  const versionBanner = serverVersion && serverVersion !== APP_VERSION ? (
    <View style={{ backgroundColor: colors.danger, padding: 10 }}>
      <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>This page is Famhub {APP_VERSION} but the server is still running {serverVersion}. Stop the server and start it again (on Azure, deploy again), then refresh.</Text>
    </View>
  ) : null;
  const [cid, setCid] = useState<string | null>(null);
  const [data, setData] = useState<CircleData | null>(null);
  const [tab, setTab] = useState('home');
  const [emptyKind, setEmptyKind] = useState<CareFor | null>(null);
  const [launchKind, setLaunchKind] = useState<CareFor | undefined>(undefined);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  // Alerts waiting in the header: they keep flashing until Dismiss (or an action) is tapped.
  const [alerts, setAlerts] = useState<Notice[]>([]);
  const toast = alerts[0] || null;
  const setToast = (v: Notice | null | ((cur: Notice | null) => Notice | null)) => {
    if (v === null) { setAlerts([]); return; }
    if (typeof v !== 'function') setAlerts((cur) => (cur.some((x) => x.id === v.id) ? cur : [v, ...cur]));
  };
  const queueAlerts = (list: Notice[]) => setAlerts((cur) => {
    const ids = new Set(cur.map((x) => x.id));
    const merged = [...cur, ...list.filter((n) => !ids.has(n.id))];
    return merged.sort((a, b) => Number(b.priority === 'urgent') - Number(a.priority === 'urgent') || b.createdAt.localeCompare(a.createdAt));
  });
  const dismissAlert = async (n: Notice) => {
    setAlerts((cur) => cur.filter((x) => x.id !== n.id));
    if (!n.readAt) await api.markRead([n.id]).catch(() => {});
    loadInboxRef.current();
  };
  const loadInboxRef = useRef(() => {});
  const [pushOn, setPushOn] = useState(true);
  const [circlePicker, setCirclePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const scroller = useRef<ScrollView>(null);

  const go = useCallback((k: string) => { setEmptyKind(null); setTab(k); setScroll(0); setCursor(null); scroller.current?.scrollTo({ y: 0, animated: false }); }, []);

  const loadSessionRef = useRef<() => Promise<Session | null>>(async () => null);
  const loadSession = useCallback(async (): Promise<Session | null> => {
    try {
      const s = await api.session();
      setSession(s); setError(null); setSignedOut(false);
      setCid((cur) => (cur && s.circles.some((c) => c.id === cur) ? cur : s.circles[0]?.id || null));
      return s;
    } catch (e: any) {
      if (e?.status === 401) { if (getWindowToken()) { setWindowToken(''); return loadSessionRef.current(); } setSignedOut(true); setSession(null); setData(null); setInbox(null); setToast(null); seenIds.current = null; return null; }
      setError(e?.message || String(e)); return null;
    }
  }, []);
  loadSessionRef.current = loadSession;

  const refresh = useCallback(async () => {
    if (!cid) return;
    try { setData(await api.circle(cid)); setError(null); }
    catch (e: any) { setData(null); await loadSession(); setError(e?.message || String(e)); }
  }, [cid, loadSession]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // New notifications appear as a banner at the top of the screen.
  const loadInbox = useCallback(async () => {
    loadInboxRef.current = () => { loadInbox(); };
    try {
      const box = await api.inbox();
      setInbox(box);
      const fresh = box.items.filter((n) => !n.readAt && !n.digest);
      let show: Notice[] = [];
      if (seenIds.current) {
        // Everything new since the last check goes to the header, urgent first.
        show = fresh.filter((n) => !seenIds.current!.has(n.id));
        show.forEach((n) => showDeviceAlert(n));
      } else {
        // First load (or after switching person): surface unread urgent alerts straight away.
        show = fresh.filter((n) => n.priority === 'urgent' && Date.now() - new Date(n.createdAt).getTime() < 6 * 3600e3);
      }
      if (show.some((n) => n.priority === 'urgent')) refreshRef.current();
      if (show.length) queueAlerts(show);
      // Alerts read elsewhere (another device, the inbox) leave the header.
      const unreadIds = new Set(fresh.map((n) => n.id));
      setAlerts((cur) => cur.filter((x) => unreadIds.has(x.id)));
      seenIds.current = new Set(box.items.map((n) => n.id));
    } catch { /* ignore while offline */ }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      addInstallTags();
      registerServiceWorker().then(() => currentSubscription()).then((sub) => setPushOn(Boolean(sub))).catch(() => setPushOn(false));
      navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => { if (e.data?.type === 'open') openFromUrl(e.data.url); });
      // "Open in a new window as ..." (test mode): this window signs in as that person only.
      const as = new URLSearchParams(window.location.search).get('as');
      if (as) {
        window.history.replaceState({}, '', '/');
        api.testAs(as).catch(() => {}).finally(() => loadSession());
        return;
      }
    }
    loadSession();
  }, [loadSession]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); if (cid) { refresh(); loadInbox(); } }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const c = session?.circles.find((x) => x.id === cid); if (c) rememberCircle(c.careFor || 'elder', c.id); }, [cid, session]);
  useEffect(() => { const t = setInterval(() => { refresh(); }, 20000); return () => clearInterval(t); }, [refresh]);
  // Check for new alerts every 8 seconds, and straight away when the app comes back into view.
  useEffect(() => {
    const t = setInterval(() => { loadInbox(); }, 8000);
    const onFocus = () => { loadInbox(); refresh(); };
    if (Platform.OS === 'web') { window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus); }
    return () => { clearInterval(t); if (Platform.OS === 'web') { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); } };
  }, [refresh, loadInbox]);
  // Real-time: when anyone saves a change, reload data and notifications straight away.
  const onLiveChange = useRef(() => {});
  onLiveChange.current = () => { refresh(); loadInbox(); };
  const live = usePresence(session && !signedOut ? cid : null, tab, !!session && !signedOut, () => onLiveChange.current(), session?.user.id || '');
  const people = live.people;
  const [navWidth, setNavWidth] = useState(0);
  const [viewHeight, setViewHeight] = useState(0);
  const [viewWidth, setViewWidth] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const scrollYRef = useRef(0);
  const pageBox = useRef<any>(null);
  // Share where this person's pointer is: mouse moves on a computer, and taps and clicks on any device.
  // The last position stays (with its time) so others can see where they last touched or scrolled.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const at = (e: MouseEvent | PointerEvent) => {
      const el = pageBox.current as HTMLElement | null;
      if (!el?.getBoundingClientRect) return null;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
      return { x: (e.clientX - r.left) / r.width, y: e.clientY - r.top + scrollYRef.current };
    };
    const fine = window.matchMedia?.('(pointer: fine)').matches;
    const move = (e: MouseEvent) => { const p = at(e); if (p) setCursor(p, 'move'); };
    const down = (e: PointerEvent) => { const p = at(e); if (p) setCursor(p, 'tap'); };
    if (fine) window.addEventListener('mousemove', move);
    window.addEventListener('pointerdown', down, true);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('pointerdown', down, true); };
  }, []);
  const [presenceOpen, setPresenceOpen] = useState(false);

  // Tapping a device notification opens the matching notification.
  const openFromUrl = (url: string) => { const id = new URL(url, window.location.origin).searchParams.get('open'); if (id) api.inbox().then((box) => { const n = box.items.find((x) => x.id === id); if (n) openNotice(n); }); };
  useEffect(() => { if (Platform.OS === 'web' && session) { const q = new URLSearchParams(window.location.search).get('open'); if (q) { openFromUrl(window.location.href); window.history.replaceState({}, '', '/'); } } }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openNotice(n: Notice) {
    setAlerts((cur) => cur.filter((x) => x.id !== n.id));
    if (!n.readAt) await api.markRead([n.id]).catch(() => {});
    if (n.circleId && n.circleId !== cid) setCid(n.circleId);
    go(n.tab === 'inbox' ? 'inbox' : n.tab);
    loadInbox();
  }

  async function doAction(n: Notice, actionId: string) {
    const c = n.circleId;
    const me = session!.user.id;
    if (actionId === 'dose-taken') { const [mid, time] = n.itemId.split('|'); await api.logDose(c, mid, time, true); }
    if (actionId === 'checkin-ok') await api.checkin(c, 'ok');
    if (actionId === 'help-handle') await api.resolveHelp(c, n.itemId);
    if (actionId === 'help-cancel') await api.cancelHelp(c, n.itemId);
    if (actionId === 'appt-go') await api.updateAppointment(c, n.itemId, { escortUserId: me });
    if (actionId === 'task-accept') await api.taskAction(c, n.itemId, 'accept');
    if (actionId === 'task-decline') await api.taskAction(c, n.itemId, 'decline');
    if (actionId === 'task-done') await api.taskAction(c, n.itemId, 'done');
    if (actionId === 'task-take') await api.taskAction(c, n.itemId, 'take');
    await api.markRead([n.id]);
    setAlerts((cur) => cur.filter((x) => x.id !== n.id));
    await Promise.all([refresh(), loadInbox()]);
  }

  const switched = async () => { setData(null); setToast(null); setInbox(null); setTab('home'); seenIds.current = null; const s = await loadSession(); if (s && s.circles[0]) { setCid(s.circles[0].id); setData(await api.circle(s.circles[0].id).catch(() => null)); } loadInbox(); };

  if (signedOut) return <View style={{ flex: 1 }}>{versionBanner}<LoginScreen onSignedIn={async () => { const s = await loadSession(); if (s?.circles[0]) setCid(s.circles[0].id); go('home'); }} /></View>;

  if (!session) {
    return <View style={[styles.outer, styles.center]}>{error ? <><ErrorText message={`Could not start Famhub: ${error}`} /><Button label="Try again" onPress={loadSession} /></> : <ActivityIndicator size="large" color={colors.primary} />}</View>;
  }

  const unread = inbox?.unread || 0;
  const header = (
    <View style={styles.appBar}>
      <Pressable onPress={() => data && data.role !== 'parent' && setCirclePicker(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="button" accessibilityLabel="Switch circle">
        <Gradient style={styles.logo}><Icon name="home" size={20} color="#fff" /></Gradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand} numberOfLines={1}>Famhub</Text>
          <Text style={styles.circleName} numberOfLines={1}>{emptyKind ? kindOf(emptyKind).tab : data ? data.circle.name : 'Welcome'}{data && data.role !== 'parent' ? ' ▾' : ''}</Text>
        </View>
      </Pressable>
      <LivePill live={live} onPress={() => setPresenceOpen(true)} />
      <DarkToggle />
      {data && <IconButton icon={unread ? 'notifications' : 'notifications-outline'} label={`Notifications, ${unread} unread`} badge={unread} onPress={() => go('inbox')} color={inbox?.urgentUnread ? colors.danger : colors.text} />}
      <Pressable onPress={() => setAboutOpen(true)} accessibilityRole="button" accessibilityLabel={`${session.user.name}. Famhub version ${APP_VERSION}. Open profile and version`}
        style={({ pressed }) => ({ alignItems: 'center', gap: 2, paddingHorizontal: 2, opacity: pressed ? 0.7 : 1 })}>
        <Avatar id={session.user.id} name={session.user.name || '?'} size={32} />
        <Text style={{ fontSize: 10, fontWeight: '800', color: serverVersion && serverVersion !== APP_VERSION ? colors.danger : colors.muted, letterSpacing: 0.3 }}>v{APP_VERSION}</Text>
      </Pressable>
    </View>
  );
  const fmtStamp = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not known');
  const aboutSheet = aboutOpen && (
    <Sheet visible title="Profile and version" onClose={() => setAboutOpen(false)}>
      <Row style={{ gap: 12, flexWrap: 'nowrap' }}>
        <Avatar id={session.user.id} name={session.user.name || '?'} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{session.user.name}</Text>
          {!!session.user.email && <Text style={{ color: colors.muted }}>{session.user.email}</Text>}
        </View>
      </Row>
      <View style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: colors.surfaceAlt }}>
        <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>Famhub {APP_VERSION}</Text>
        <Text style={{ color: colors.muted }}>This page: {APP_VERSION}</Text>
        <Text style={{ color: serverVersion && serverVersion !== APP_VERSION ? colors.danger : colors.muted }}>Server: {serverVersion || 'checking...'}{serverVersion && serverVersion !== APP_VERSION ? ' (different: refresh the page after the deploy finishes)' : ''}</Text>
        <Text style={{ color: colors.muted }}>Updated: {fmtStamp(health?.builtAt)}</Text>
        <Text style={{ color: colors.muted }}>Server started: {fmtStamp(health?.startedAt)}</Text>
        {health?.mode === 'test' && <Text style={{ color: colors.warn, fontWeight: '700' }}>Test mode</Text>}
      </View>
      <Row>
        <Button icon="person-circle-outline" label="My profile" onPress={() => { setAboutOpen(false); go(data?.role === 'parent' ? 'notify' : 'me'); }} />
        <Button kind="secondary" icon="refresh" label="Reload page" onPress={() => window.location.reload()} />
      </Row>
    </Sheet>
  );

  const toastView = toast && (() => {
    const cat = CATEGORY_ICON[toast.category] || CATEGORY_ICON.updates;
    const urgent = toast.priority === 'urgent';
    const more = alerts.length - 1;
    return (
      <View accessibilityRole="alert" accessibilityLiveRegion="assertive"
        style={[styles.alertBar, { animationName: urgent ? 'famhubFlashRed' : 'famhubFlashAmber', animationDuration: urgent ? '0.9s' : '1.4s', animationIterationCount: 'infinite' } as any]}>
        <Pressable onPress={() => openNotice(toast)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="button" accessibilityLabel={`Open alert: ${toast.title}`}>
          <Icon name={urgent ? 'warning' : cat.icon} size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: '#fff' }} numberOfLines={1}>{toast.title}</Text>
            {!!toast.body && <Text style={{ fontSize: 13, color: '#fff' }} numberOfLines={2}>{toast.body}</Text>}
            {more > 0 && <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700', opacity: 0.9 }}>+{more} more alert{more === 1 ? '' : 's'}</Text>}
          </View>
        </Pressable>
        <View style={{ gap: 6, alignItems: 'stretch' }}>
          {toast.actions.slice(0, 2).map((a) => <Button key={a.id} small kind="secondary" label={a.label} onPress={() => { setAlerts((cur) => cur.filter((x) => x.id !== toast.id)); doAction(toast, a.id); }} />)}
          <Pressable onPress={() => dismissAlert(toast)} accessibilityRole="button" accessibilityLabel="Dismiss alert"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' }}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    );
  })();

  const currentKind: CareFor = session.circles.find((c) => c.id === cid)?.careFor || 'elder';
  const activeKind: CareFor = emptyKind || currentKind;
  const onKind = (k: CareFor) => {
    const id = lastCircle(k, session.circles);
    if (!id) { setEmptyKind(k); scroller.current?.scrollTo({ y: 0, animated: false }); return; }
    setEmptyKind(null);
    if (id !== cid) { setCid(id); if (!['home', 'calendar', 'care', 'requests', 'updates', 'more'].includes(tab)) setTab('home'); }
  };
  const addKind = (k?: CareFor) => { setLaunchKind(k); go('launch'); };
  const familyBar = data && data.role !== 'parent' && session.circles.length > 0 && tab !== 'launch'
    ? <FamilyTabs circles={session.circles} cid={emptyKind ? null : cid} active={activeKind} onKind={onKind} onCircle={(id) => { setEmptyKind(null); setCid(id); }} onAdd={addKind} />
    : null;

  const page = (content: React.ReactNode, nav?: React.ReactNode) => (
    <View style={styles.outer}>
      {versionBanner}
      <ProfileSwitcher session={session} onSwitch={switched} onRunChecks={async () => { await api.runChecks().catch(() => {}); loadInbox(); refresh(); }} />
      <View style={styles.page}>
        {toastView}
        {header}
        {familyBar}
        <View ref={pageBox} style={{ flex: 1 }} onLayout={(e) => { setViewHeight(e.nativeEvent.layout.height); setViewWidth(e.nativeEvent.layout.width); }}>
        <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" scrollEventThrottle={100}
          onScroll={(e) => { const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent; const room = contentSize.height - layoutMeasurement.height; setScroll(room > 0 ? contentOffset.y / room : 0); scrollYRef.current = contentOffset.y; setScrollY(contentOffset.y); setCursor({ x: lastCursorX(), y: contentOffset.y + layoutMeasurement.height * 0.4 }, 'scroll'); }}>
          <ErrorText message={error} />
          <AlsoHere people={people} tab={tab} />
          {content}
        </ScrollView>
        <ScrollPins people={people} tab={tab} height={viewHeight} />
        <LiveCursors people={people} tab={tab} width={viewWidth} scrollY={scrollY} height={viewHeight} onJump={(y) => scroller.current?.scrollTo({ y: Math.max(0, y - viewHeight * 0.4), animated: true })} />
        </View>
        {nav}
      </View>
      {aboutSheet}
      {presenceOpen && <PresenceSheet live={live} close={() => setPresenceOpen(false)} go={go} />}
      {circlePicker && (
        <Sheet visible title="Your care circles" onClose={() => setCirclePicker(false)}>
          {session.circles.map((c) => <ListItem key={c.id} icon={c.id === cid ? 'radio-button-on' : 'radio-button-off'} title={c.name} subtitle={roleLabel[c.role]} onPress={() => { setCirclePicker(false); setCid(c.id); go('home'); }} />)}
          <ListItem icon="add-circle-outline" iconColor="#F45B8D" title="Set up someone new" subtitle="An older parent, a newborn, baby, twins or triplets" onPress={() => { setCirclePicker(false); addKind(undefined); }} />
        </Sheet>
      )}
      <StatusBar style="dark" />
    </View>
  );

  if (!session.circles.length || !cid) return page(<OnboardingScreen name={session.user.name} live={session.mode === 'live'} onDone={async (id) => { await loadSession(); setCid(id); go('home'); }} />);
  if (!data) return page(<ActivityIndicator size="large" color={colors.primary} />);

  const props = { data, cid, refresh, go };
  const inboxScreen = <InboxScreen inbox={inbox} reload={loadInbox} onOpen={openNotice} onAction={doAction} onMarkAll={async () => { await api.markRead(); loadInbox(); }} pushOn={pushOn} goSettings={() => go('notify')} multiCircle={session.circles.length > 1} />;

  if (data.role === 'parent') {
    const reminders = (inbox?.items || []).filter((n) => !n.readAt && (n.category === 'medicine' || n.category === 'appointments')).map((n) => ({ id: n.id, title: n.title }));
    return page(tab === 'inbox' ? inboxScreen : tab === 'notify' ? <View style={{ gap: 16 }}><NotifySettingsScreen onPushChange={setPushOn} /><AppearanceSettings big /><Button kind="secondary" icon="log-out-outline" label="Sign out" onPress={() => signOut()} /></View> : tab === 'photos' || tab === 'updates' ? <ParentPhotos {...props} /> : <ParentScreen {...props} reminders={reminders} />,
      <View style={styles.nav}>
        {[{ key: 'home', label: 'Home', icon: 'home' as IconName }, { key: 'photos', label: 'Photos', icon: 'camera' as IconName }, { key: 'inbox', label: 'Reminders', icon: 'notifications' as IconName }, { key: 'notify', label: 'Settings', icon: 'settings' as IconName }].map((n) => (
          <Pressable key={n.key} onPress={() => go(n.key)} style={styles.navItem}><Icon name={n.icon} size={28} color={(tab === 'updates' ? 'photos' : tab) === n.key ? colors.primary : colors.faint} /><Text style={[styles.navText, { fontSize: 14 }, (tab === 'updates' ? 'photos' : tab) === n.key && styles.navTextOn]}>{n.label}</Text></Pressable>
        ))}
      </View>);
  }

  const back = (title: string) => (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => go('more')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="link"><Icon name="chevron-back" size={20} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>More</Text></Pressable>
      <PageHeader title={title} />
    </View>
  );
  const allowed = new Set(['home', 'calendar', 'care', 'requests', 'updates', 'more', 'inbox', 'notify', 'docs', 'circle', 'activity', 'me', 'repeats', 'visits', 'launch', 'profile', 'appearance', 'payments', ...(data.baby ? ['babyreport'] : []), ...(data.can.seeMoney ? ['costs'] : []), ...(data.can.seeRenewals ? ['renewals'] : [])]);
  const current = allowed.has(tab) ? tab : 'home';
  const screens: Record<string, React.ReactNode> = {
    home: <TodayScreen {...props} />, calendar: <CalendarScreen {...props} />, care: data.baby ? <BabyScreen {...props} /> : <CareScreen {...props} />, requests: <RequestsScreen {...props} />,
    updates: <UpdatesScreen {...props} />, more: <MoreScreen {...props} />, inbox: inboxScreen, notify: <NotifySettingsScreen onPushChange={setPushOn} />,
    costs: <CostsScreen {...props} />, payments: <PaymentsScreen {...props} />, docs: <DocumentsScreen {...props} />, renewals: <RenewalsScreen {...props} />, circle: <CircleScreen key={cid} {...props} />,
    activity: <ActivityScreen {...props} />, me: <MeScreen {...props} />, repeats: <RepeatsScreen {...props} />, visits: <VisitsScreen {...props} />,
    appearance: <AppearanceSettings />,
    babyreport: data.baby ? <BabyReportScreen {...props} /> : null,
    launch: <LaunchWizard key={launchKind || 'any'} initialKind={launchKind} onCancel={() => go('home')} onDone={async (id) => { await loadSession(); setLaunchKind(undefined); setCid(id); go('home'); }} />,
    profile: <LaunchWizard edit={{ cid, profile: data.circle.profile || null, checkinBy: data.circle.checkinBy, name: data.circle.parentName }} onCancel={() => go('more')} onDone={async () => { await refresh(); go('home'); }} />,
  };
  const navKey = NAV.some((n) => n.key === current) ? current : ['inbox'].includes(current) ? '' : 'more';
  const content = emptyKind ? <EmptyKind kind={emptyKind} onSetup={() => addKind(emptyKind)} /> : SUB_TITLES[current] ? <View style={{ gap: 16 }}>{back(SUB_TITLES[current])}{screens[current]}</View> : current === 'notify' ? <View style={{ gap: 6 }}><Pressable onPress={() => go('more')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="chevron-back" size={20} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>More</Text></Pressable>{screens.notify}</View> : screens[current];

  return page(content,
    <View style={styles.nav} accessibilityRole="tablist" onLayout={(e) => setNavWidth(e.nativeEvent.layout.width)}>
      <NavPresenceLayer people={people} width={navWidth} />
      {NAV.map((n) => {
        const on = navKey === n.key;
        const count = n.key === 'requests' ? data.tasks.filter((t) => t.status === 'open' && t.assigneeUserId === data.me.userId).length : n.key === 'care' && !data.baby ? data.dosesToday.filter((d) => d.status === 'missed' || d.status === 'due').length : 0;
        const kk = kindOf(currentKind);
        const label = n.key === 'care' ? (data.baby && data.baby.babies.length > 1 ? 'Babies' : kk.careTab) : n.label;
        const ic = n.key === 'care' ? { icon: kk.careIcon, iconOn: kk.careIconOn } : n;
        return (
          <Pressable key={n.key} onPress={() => go(n.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} style={[styles.navItem, on && styles.navItemOn]}>
            <View>
              <Icon name={on ? ic.iconOn : ic.icon} size={24} color={on ? colors.primary : colors.faint} />
              {count > 0 && <View style={styles.navDot}><Text style={styles.navDotText}>{count}</Text></View>}
            </View>
            <Text style={[styles.navText, on && styles.navTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>);
}

const styles = StyleSheet.create({
  outer: { flex: 1, height: '100%', backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  page: { flex: 1, width: '100%', maxWidth: 780, alignSelf: 'center' },
  appBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 8 },
  logo: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.18 },
  brand: { fontSize: 12, fontWeight: '900', color: colors.accent, letterSpacing: 1.5, textTransform: 'uppercase' },
  circleName: { fontSize: 17, fontWeight: '800', color: colors.text },
  body: { padding: 16, paddingBottom: 32, gap: 16 },
  nav: { flexDirection: 'row', backgroundColor: colors.card, marginHorizontal: 10, marginBottom: 10, borderRadius: 24, paddingVertical: 6, paddingHorizontal: 4, ...shadow, shadowOpacity: 0.12 },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 5, minHeight: 54, justifyContent: 'center', borderRadius: 18 },
  navItemOn: { backgroundColor: colors.primarySoft },
  navText: { fontSize: 11, color: colors.faint, fontWeight: '600' },
  navTextOn: { color: colors.primary, fontWeight: '800' },
  navDot: { position: 'absolute', top: -4, right: -10, backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  navDotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  alertBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.danger },
  toast: { marginHorizontal: 12, marginBottom: 6, backgroundColor: colors.card, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, ...shadow, shadowOpacity: 0.15 },
  testBar: { backgroundColor: colors.warnSoft, borderBottomWidth: 1, borderBottomColor: colors.warnBorder, paddingVertical: 8, paddingHorizontal: 12, gap: 6 },
  testTitle: { fontSize: 12, fontWeight: '800', color: colors.warnText },
  testChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: '#D9A21B', backgroundColor: colors.card },
  testChipOn: { backgroundColor: '#B7791F', borderColor: '#B7791F' },
  testChipText: { fontSize: 13, color: colors.warnText },
});
