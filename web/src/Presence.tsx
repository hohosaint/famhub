import { createElement, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { colors, personColor } from './theme';
import { Avatar, Button, Muted, Sheet } from './ui';
import { authUrl } from './api';
import { doingListeners, getCursor, getDoing, getScroll, isTyping } from './doing';

// Live presence ("co-author mode"), in real time.
// - This app sends where the person is (page, open form, typing, scroll position) as soon as it changes,
//   checked every 200 ms.
// - The server pushes everyone else's position back at once over a live stream (/api/live), and also
//   tells the app when any data changed so it reloads straight away.
// - If the live stream cannot connect, the app asks for everyone's position every 200 ms instead.

export type Move = { tab: string; doing: string; at: string };
export type Present = { userId: string; name: string; role: string; tab: string; doing: string; typing: boolean; scroll: number; cursor: { x: number; y: number; kind: 'move' | 'tap' | 'scroll'; at: string } | null; at: string; since: string; trail: Move[] };

export const PAGE_LABEL: Record<string, string> = {
  home: 'Today', calendar: 'Calendar', care: 'Care', requests: 'Requests', updates: 'Updates', more: 'More',
  inbox: 'Notifications', notify: 'Notification settings', costs: 'Costs', docs: 'Documents', renewals: 'Renewals',
  circle: 'Circle and people', activity: 'Activity log', me: 'My profile', photos: 'Photos', repeats: 'Repeating items', visits: 'Visit notes', launch: 'Setting up someone new', profile: 'Care profile', appearance: 'Appearance', babyreport: 'Baby reports',
};
export const NAV_KEYS = ['home', 'calendar', 'care', 'requests', 'updates', 'more'];
// Pages reached from More count as "More" in the bottom bar.
export const navKeyOf = (tab: string) => (NAV_KEYS.includes(tab) ? tab : 'more');
const where = (tab: string, doing: string) => `${PAGE_LABEL[tab] || tab}${doing ? ` › ${doing}` : ''}`;
export const describe = (p: Present) => `${where(p.tab, p.doing)}${p.typing ? ' (typing...)' : ''}`;

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
}

// Re-render every second so "12s ago" keeps counting.
function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

// One id per open page (not stored), so every window, even a copy of another, counts separately.
const PAGE_CLIENT_ID = Math.random().toString(36).slice(2, 12);
function clientId() { return PAGE_CLIENT_ID; }

export type LiveState = { people: Present[]; connected: boolean; lastMove: { name: string; userId: string; text: string; at: number } | null };

export function usePresence(cid: string | null, tab: string, enabled: boolean, onChanged: () => void, selfId = ''): LiveState {
  const [people, setPeople] = useState<Present[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastMove, setLastMove] = useState<LiveState['lastMove']>(null);
  const id = useRef(Platform.OS === 'web' ? clientId() : 'app');
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;
  const prev = useRef<Record<string, string>>({});

  // Notice moves ("Mei Ling → Calendar") to show briefly in the LIVE pill.
  const self = useRef(selfId);
  self.current = selfId;
  const take = (all: Present[]) => {
    // Never show yourself (for example right after switching person in this window).
    const list = all.filter((p) => p.userId !== self.current);
    for (const p of list) {
      const now = `${p.tab}|${p.doing}`;
      if (prev.current[p.userId] && prev.current[p.userId] !== now) setLastMove({ name: p.name, userId: p.userId, text: where(p.tab, p.doing), at: Date.now() });
      prev.current[p.userId] = now;
    }
    setPeople(list);
  };

  useEffect(() => {
    if (!cid || !enabled || Platform.OS !== 'web') { setPeople([]); setConnected(false); return; }
    let stopped = false;
    let live = false;
    let lastSent = '';
    let lastSentAt = 0;
    let inFlight = false;

    const payload = (away = false) => ({ tab: tabRef.current, doing: getDoing(), typing: isTyping(), scroll: getScroll(), cursor: getCursor(), clientId: id.current, away });
    const send = async (away = false, force = false) => {
      const body = payload(away);
      const sig = JSON.stringify({ ...body, clientId: '' });
      // With the live stream on, send only when something changed (plus a keep-alive every 10 s).
      // Without it, send every 200 ms so the answer brings everyone's latest position.
      if (!away && !force && live && sig === lastSent && Date.now() - lastSentAt < 10000) return;
      if (inFlight && !away) return;
      inFlight = true; lastSent = sig; lastSentAt = Date.now();
      try {
        const res = await fetch(`/api/circles/${cid}/presence`, { method: 'POST', credentials: 'include', keepalive: away, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!stopped && res.ok && !live) take((await res.json()).people || []);
      } catch { /* offline */ } finally { inFlight = false; }
    };

    // The live stream.
    let es: EventSource | null = null;
    try {
      es = new EventSource(authUrl(`/api/live?cid=${encodeURIComponent(cid)}&clientId=${encodeURIComponent(id.current)}`), { withCredentials: true });
      es.addEventListener('open', () => { live = true; setConnected(true); send(false, true); });
      es.addEventListener('presence', (e: MessageEvent) => { try { take(JSON.parse(e.data).people || []); } catch { /* ignore */ } });
      es.addEventListener('changed', () => changedRef.current());
      es.addEventListener('error', () => { live = false; setConnected(false); });
    } catch { es = null; }

    send(false, true);
    const tick = setInterval(() => { if (!document.hidden) send(); }, 200);
    const changed = () => send();
    doingListeners.add(changed);
    const vis = () => send(document.hidden, true);
    const leave = () => send(true);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', leave);
    return () => {
      stopped = true; clearInterval(tick); doingListeners.delete(changed);
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', leave);
      es?.close(); send(true);
    };
  }, [cid, enabled, selfId]);

  return { people, connected, lastMove };
}

const Dot = ({ pulse }: { pulse?: boolean }) => (
  <View style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.card, ...(pulse ? ({ animationName: 'famhubPulse', animationDuration: '1.6s', animationIterationCount: 'infinite' } as any) : {}) }} />
);

// Adds the small CSS animations once (pulsing live dot, typing dots).
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('famhub-live-css')) {
  const st = document.createElement('style');
  st.id = 'famhub-live-css';
  st.textContent = '@keyframes famhubPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}'
    + '@keyframes famhubType{0%,80%,100%{opacity:.25}40%{opacity:1}}'
    + '@keyframes famhubFlashRed{0%,100%{background-color:#B42318}50%{background-color:#F04438}}'
    + '@keyframes famhubFlashAmber{0%,100%{background-color:#B54708}50%{background-color:#F79009}}'
    + '@media (prefers-reduced-motion: reduce){*{animation-duration:3s!important}}';
  document.head.appendChild(st);
}

function TypingDots({ color = '#fff', size = 4 }: { color?: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2].map((i) => <View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, animationName: 'famhubType', animationDuration: '1s', animationIterationCount: 'infinite', animationDelay: `${i * 0.15}s` } as any} />)}
    </View>
  );
}

// "LIVE" pill in the top bar: pulsing dot, faces, and the latest move for a few seconds.
export function LivePill({ live, onPress }: { live: LiveState; onPress: () => void }) {
  useTick(1000);
  const { people, lastMove, connected } = live;
  if (!people.length) return null;
  const recent = lastMove && Date.now() - lastMove.at < 4000 ? lastMove : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`Live: ${people.length} online. ${people.map((p) => `${p.name} on ${describe(p)}`).join('. ')}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 8, paddingRight: 6, borderRadius: 18, backgroundColor: colors.okSoft, borderWidth: 1, borderColor: colors.okBorder, maxWidth: '46%', flexShrink: 1 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? '#22C55E' : '#F59E0B', animationName: 'famhubPulse', animationDuration: '1.6s', animationIterationCount: 'infinite' } as any} />
      {recent ? (
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: colors.okText, flexShrink: 1 }}>{recent.name} → {recent.text}</Text>
      ) : (
        <Text style={{ fontSize: 11, fontWeight: '900', color: colors.okText, letterSpacing: 0.5 }}>LIVE</Text>
      )}
      <View style={{ flexDirection: 'row' }}>
        {people.slice(0, 3).map((p, i) => (
          <View key={p.userId} style={{ marginLeft: i ? -9 : 0, borderRadius: 14, borderWidth: 2, borderColor: colors.okSoft }}>
            <Avatar id={p.userId} name={p.name} size={24} />
            <Dot />
          </View>
        ))}
        {people.length > 3 && <Text style={{ marginLeft: 2, fontWeight: '800', color: colors.muted, fontSize: 12 }}>+{people.length - 3}</Text>}
      </View>
    </Pressable>
  );
}

// Live panel: everyone online, where they are, what they are doing, and their last moves. Updates as they move.
export function PresenceSheet({ live, close, go }: { live: LiveState; close: () => void; go: (tab: string) => void }) {
  useTick(1000);
  const { people, connected } = live;
  return (
    <Sheet visible title="Live now" onClose={close}>
      <Muted>{connected ? 'Updating live as people move around Famhub.' : 'Reconnecting... positions are being checked every 200 ms.'}</Muted>
      {!people.length && <Muted>Nobody else is online right now.</Muted>}
      {people.map((p) => (
        <View key={p.userId} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, gap: 8, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View><Avatar id={p.userId} name={p.name} size={40} /><Dot pulse /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{p.name}<Text style={{ fontWeight: '400', color: colors.muted }}>{p.role ? `  ${p.role}` : ''}</Text></Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: personColor(p.userId) }}>{where(p.tab, p.doing)}</Text>
                {p.typing && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warnSoft, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: colors.warnText, fontWeight: '700' }}>typing</Text><TypingDots color="#92400E" size={3} /></View>}
              </View>
              <Text style={{ fontSize: 12, color: colors.faint }}>here for {ago(p.since).replace(' ago', '')}{p.scroll > 0.02 ? ` · scrolled ${Math.round(p.scroll * 100)}% down` : ''}</Text>
            </View>
            <Button small kind="secondary" icon="navigate-outline" label="Go there" onPress={() => { close(); go(p.tab); }} />
          </View>
          {p.trail.length > 1 && (
            <View style={{ gap: 2, paddingLeft: 50 }}>
              {p.trail.slice(0, 5).map((m, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === 0 ? personColor(p.userId) : colors.border }} />
                  <Text style={{ fontSize: 12, color: i === 0 ? colors.text : colors.muted, flex: 1 }} numberOfLines={1}>{where(m.tab, m.doing)}</Text>
                  <Text style={{ fontSize: 11, color: colors.faint }}>{ago(m.at)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </Sheet>
  );
}

// A line at the top of a page: who else is on the same page, and what they are doing.
export function AlsoHere({ people, tab }: { people: Present[]; tab: string }) {
  const here = people.filter((p) => p.tab === tab);
  if (!here.length) return null;
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.okSoft, borderRadius: 16, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, maxWidth: '100%' }}>
      <View style={{ flexDirection: 'row' }}>
        {here.slice(0, 3).map((p, i) => <View key={p.userId} style={{ marginLeft: i ? -8 : 0, borderRadius: 13, borderWidth: 1.5, borderColor: colors.okSoft }}><Avatar id={p.userId} name={p.name} size={22} /></View>)}
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.okText, flexShrink: 1 }}>
        {here.map((p) => (p.typing ? `${p.name} is typing in "${p.doing || 'a form'}"` : p.doing ? `${p.name} has "${p.doing}" open` : `${p.name} is here too`)).join(' · ')}
      </Text>
      {here.some((p) => p.typing) && <TypingDots color="#166534" />}
    </View>
  );
}

// Faces that glide along the bottom menu to the tab each person is on.
export function NavPresenceLayer({ people, width, keys = NAV_KEYS }: { people: Present[]; width: number; keys?: string[] }) {
  if (!width || !people.length) return null;
  const slot = width / keys.length;
  const count: Record<string, number> = {};
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -12, left: 0, right: 0, height: 24 }}>
      {people.map((p) => {
        const k = navKeyOf(p.tab);
        const idx = Math.max(0, keys.indexOf(k));
        const n = (count[k] = (count[k] || 0) + 1) - 1;
        const x = idx * slot + slot / 2 - 24 + n * 14;
        return (
          <View key={p.userId} accessibilityLabel={`${p.name} on ${describe(p)}`}
            style={{ position: 'absolute', left: x, top: 0, transitionProperty: 'left', transitionDuration: '450ms', transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' } as any}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: personColor(p.userId), borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{p.name[0]?.toUpperCase()}</Text>
            </View>
            {(p.typing || !!p.doing) && (
              <View style={{ position: 'absolute', right: -8, top: -6, minWidth: 14, height: 12, borderRadius: 6, paddingHorizontal: 2, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.card }}>
                {p.typing ? <TypingDots size={2} /> : <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>✎</Text>}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// On the same page: a marker on the right edge showing how far down each person is looking.
export function ScrollPins({ people, tab, height }: { people: Present[]; tab: string; height: number }) {
  const here = people.filter((p) => p.tab === tab);
  if (!height || !here.length) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', right: 2, top: 0, bottom: 0, width: 26 }}>
      {here.map((p, i) => (
        <View key={p.userId} accessibilityLabel={`${p.name} is ${Math.round(p.scroll * 100)}% down this page`}
          style={{ position: 'absolute', right: i * 6, top: 8 + p.scroll * Math.max(0, height - 48), transitionProperty: 'top', transitionDuration: '220ms', transitionTimingFunction: 'ease-out' } as any}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderRightWidth: 6, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: personColor(p.userId) }} />
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: personColor(p.userId), borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{p.name[0]?.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// Other people's pointers on the page you share: where they are moving the mouse now, or where they
// last tapped, clicked or scrolled to, with how long ago. Off-screen ones show at the top or bottom edge;
// tap one to jump there.
export function LiveCursors({ people, tab, width, scrollY, height, onJump }: { people: Present[]; tab: string; width: number; scrollY: number; height: number; onJump: (y: number) => void }) {
  useTick(1000);
  if (Platform.OS !== 'web' || !width) return null;
  const now = Date.now();
  const here = people.filter((p) => p.tab === tab && p.cursor && now - new Date(p.cursor.at).getTime() < 10 * 60e3);
  if (!here.length) return null;
  const above: Present[] = [];
  const below: Present[] = [];
  const onScreen: Present[] = [];
  for (const p of here) {
    const top = p.cursor!.y - scrollY;
    if (top < 0) above.push(p); else if (top > height - 30) below.push(p); else onScreen.push(p);
  }
  const verb = (p: Present) => {
    const age = (now - new Date(p.cursor!.at).getTime()) / 1000;
    if (p.cursor!.kind === 'move' && age < 4) return '';
    const what = p.cursor!.kind === 'tap' ? 'tapped' : p.cursor!.kind === 'scroll' ? 'scrolled here' : 'pointer';
    return ` · ${what} ${ago(p.cursor!.at)}`;
  };
  const edge = (list: Present[], side: 'top' | 'bottom') => list.length > 0 && (
    <View style={{ position: 'absolute', [side]: 6, left: 0, right: 0, alignItems: 'center', gap: 4 } as any} pointerEvents="box-none">
      {list.map((p) => (
        <Pressable key={p.userId} onPress={() => onJump(p.cursor!.y)} accessibilityRole="button" accessibilityLabel={`${p.name} is ${side === 'top' ? 'above' : 'below'}; go to where they are`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: personColor(p.userId), borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{side === 'top' ? '↑' : '↓'} {p.name}{verb(p)}</Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 5 }}>
      {onScreen.map((p) => {
        const c = p.cursor!;
        const left = Math.min(c.x * width, width - 20);
        const top = c.y - scrollY;
        const age = (now - new Date(c.at).getTime()) / 1000;
        const fade = age < 5 ? 1 : age < 60 ? 0.8 : 0.5;
        const color = personColor(p.userId);
        return (
          <View key={p.userId} pointerEvents="none" accessibilityLabel={`${p.name}'s pointer${verb(p)}`}
            style={{ position: 'absolute', left, top, opacity: fade, transitionProperty: 'left, top, opacity', transitionDuration: '200ms', transitionTimingFunction: 'linear' } as any}>
            {c.kind === 'tap' && age < 3 && <View style={{ position: 'absolute', left: -14, top: -14, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: color, animationName: 'famhubPulse', animationDuration: '1s', animationIterationCount: 'infinite' } as any} />}
            {c.kind === 'scroll'
              ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 2, borderColor: colors.card }} />
              : createElement('svg', { width: 18, height: 22, viewBox: '0 0 18 22', style: { display: 'block', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.35))' } },
                createElement('path', { d: 'M1 1 L1 17 L5.5 13 L8.5 20.5 L11.5 19.2 L8.6 12 L15 12 Z', fill: color, stroke: '#fff', strokeWidth: 1.5, strokeLinejoin: 'round' }))}
            <View style={{ marginLeft: 12, marginTop: -4, alignSelf: 'flex-start', backgroundColor: color, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>{p.name}{verb(p)}</Text>
            </View>
          </View>
        );
      })}
      {edge(above, 'top')}
      {edge(below, 'bottom')}
    </View>
  );
}
