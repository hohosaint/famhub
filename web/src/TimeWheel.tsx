import { createElement, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from './theme';

// iOS-style time picker: three spinning wheels for hour, minute and AM/PM.
// The value is always 24-hour "HH:MM" (or '' when not set).

const ROW = 40;          // height of one row
const VISIBLE = 5;       // rows visible at once
const PAD = ((VISIBLE - 1) / 2) * ROW;

const pad2 = (n: number) => String(n).padStart(2, '0');
export function to12(value: string) {
  const [h, m] = (value || '09:00').split(':').map(Number);
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: m, pm: h >= 12 };
}
export function to24(hour: number, minute: number, pm: boolean) {
  const h = (hour % 12) + (pm ? 12 : 0);
  return `${pad2(h)}:${pad2(minute)}`;
}
export function fmt12(value: string) {
  if (!value) return '';
  const t = to12(value);
  return `${t.hour}:${pad2(t.minute)} ${t.pm ? 'PM' : 'AM'}`;
}

function Wheel({ items, index, onChange, label, width, loop = false }: { items: string[]; index: number; onChange: (i: number) => void; label: string; width: number; loop?: boolean }) {
  // Hours and minutes go round and round like on an iPhone: the list is repeated and quietly re-centred.
  const n = items.length;
  const reps = loop ? 9 : 1;
  const mid = Math.floor(reps / 2) * n;
  const rows = Array.from({ length: n * reps }, (_, k) => items[k % n]);
  const ref = useRef<HTMLDivElement | null>(null);
  const timer = useRef<any>(null);
  const busy = useRef(false);       // true while the person is dragging or the wheel is gliding
  const [shown, setShown] = useState(mid + index);
  // Always use the latest value and callback (timers may fire after a re-render).
  const latest = useRef({ index, onChange });
  latest.current = { index, onChange };

  const place = (row: number) => { const el = ref.current; if (el) el.scrollTop = row * ROW; setShown(row); };

  // Line the wheel up with the value (for example after a quick-time button), without fighting a scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el || busy.current) return;
    const cur = Math.round(el.scrollTop / ROW);
    if (((cur % n) + n) % n !== index || el.scrollTop === 0 && index + mid !== 0) place(mid + index);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el || busy.current) return;
      const raw = Math.round(el.scrollTop / ROW);
      if (Math.abs(el.scrollTop - raw * ROW) > 1) { el.scrollTo({ top: raw * ROW, behavior: 'smooth' }); settle(); return; }
      const i = ((raw % n) + n) % n;
      if (loop && (raw < n || raw >= n * (reps - 1))) place(mid + i);
      if (i !== latest.current.index) latest.current.onChange(i);
    }, 140);
  };

  const onScroll = () => { const el = ref.current; if (el) setShown(Math.round(el.scrollTop / ROW)); settle(); };

  // Click-and-drag with a mouse, with a little glide when let go (touch screens do this natively).
  const onMouseDown = (e: any) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    e.preventDefault();
    busy.current = true;
    el.style.scrollSnapType = 'none';   // snapping would pull the wheel back while dragging
    let lastY = e.clientY; let lastT = performance.now(); let v = 0;
    const move = (m: MouseEvent) => {
      const now = performance.now();
      const dy = m.clientY - lastY;
      el.scrollTop -= dy;
      v = Math.max(-3, Math.min(3, -dy / Math.max(8, now - lastT)));
      lastY = m.clientY; lastT = now;
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      let prev = performance.now();
      const glide = (t: number) => {
        const dt = t - prev; prev = t;
        el.scrollTop += v * dt;
        v *= Math.pow(0.95, dt / 16);
        if (Math.abs(v) > 0.03) requestAnimationFrame(glide);
        else { busy.current = false; el.style.scrollSnapType = 'y proximity'; settle(); }
      };
      requestAnimationFrame(glide);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const pick = (row: number) => { ref.current?.scrollTo({ top: row * ROW, behavior: 'smooth' }); settle(); };

  return createElement('div', {
    ref, role: 'listbox', 'aria-label': label, 'aria-activedescendant': undefined, tabIndex: 0, onScroll, onMouseDown,
    onKeyDown: (e: any) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); pick(shown + 1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); pick(shown - 1); }
    },
    style: {
      width, height: ROW * VISIBLE, overflowY: 'scroll', scrollSnapType: 'y proximity', scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch', position: 'relative', zIndex: 1, outline: 'none', cursor: 'grab', overscrollBehavior: 'contain',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
      maskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
    },
  },
  createElement('div', { style: { height: PAD } }),
  ...rows.map((it, k) => createElement('div', {
    key: k, role: 'option', 'aria-selected': k % n === index && Math.abs(k - shown) < n, onClick: () => pick(k),
    style: {
      height: ROW, lineHeight: `${ROW}px`, textAlign: 'center', scrollSnapAlign: 'center', cursor: 'pointer', userSelect: 'none',
      fontSize: k === shown ? 22 : 19, fontWeight: k === shown ? 700 : 400, color: k === shown ? colors.text : colors.muted,
      fontVariantNumeric: 'tabular-nums', transition: 'font-size .12s', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
  }, it)),
  createElement('div', { style: { height: PAD } }));
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export function TimeWheel({ value, onChange, minuteStep = 1 }: { value: string; onChange: (v: string) => void; minuteStep?: number }) {
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad2(i * minuteStep));
  const t = to12(value || '09:00');
  const mIndex = Math.min(minutes.length - 1, Math.round(t.minute / minuteStep));
  // Each wheel changes only its own part, based on the very latest value.
  const cur = useRef(value || '09:00');
  cur.current = value || '09:00';
  const change = (part: { hour?: number; minuteIdx?: number; pm?: boolean }) => {
    const now = to12(cur.current);
    const mi = part.minuteIdx ?? Math.min(minutes.length - 1, Math.round(now.minute / minuteStep));
    const next = to24(part.hour ?? now.hour, Number(minutes[mi]), part.pm ?? now.pm);
    cur.current = next;
    onChange(next);
  };
  return (
    <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, position: 'relative' }}>
      {/* the grey band behind the selected row, as on iPhone */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: PAD, height: ROW, borderRadius: 10, backgroundColor: colors.surfaceAlt2 }} />
      <Wheel loop label="Hour" width={64} items={HOURS} index={t.hour - 1} onChange={(i) => change({ hour: i + 1 })} />
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, zIndex: 1 }}>:</Text>
      <Wheel loop label="Minute" width={64} items={minutes} index={mIndex} onChange={(i) => change({ minuteIdx: i })} />
      <Wheel label="AM or PM" width={64} items={['AM', 'PM']} index={t.pm ? 1 : 0} onChange={(i) => change({ pm: i === 1 })} />
    </View>
  );
}

// A time field: shows the time (for example "2:30 PM"); tap it to open the wheels underneath.
export function TimeField({ label, value, onChange, minuteStep = 1, optional, labelStyle }: {
  label: string; value: string; onChange: (v: string) => void; minuteStep?: number; optional?: boolean; labelStyle?: any;
}) {
  const [open, setOpen] = useState(false);
  if (Platform.OS !== 'web') return <View style={{ gap: 6 }}><Text style={labelStyle}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder="HH:MM" /></View>;
  return (
    <View style={{ gap: 6 }}>
      <Text style={labelStyle}>{label}</Text>
      <Pressable
        onPress={() => { if (!open && !value) onChange('09:00'); setOpen(!open); }}
        accessibilityRole="button" accessibilityLabel={`${label}: ${value ? fmt12(value) : 'not set'}. ${open ? 'Close' : 'Change'} time`}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: open ? colors.primary : colors.border, backgroundColor: colors.card }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: value ? colors.text : colors.faint }}>{value ? fmt12(value) : 'Tap to choose a time'}</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{open ? 'Done' : 'Change'}</Text>
      </Pressable>
      {open && (
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingVertical: 8, gap: 6 }}>
          <TimeWheel value={value || '09:00'} onChange={onChange} minuteStep={minuteStep} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, paddingBottom: 4 }}>
            {optional && !!value && <Text accessibilityRole="button" onPress={() => { onChange(''); setOpen(false); }} style={{ color: colors.danger, fontWeight: '700', padding: 6 }}>Clear</Text>}
            <Text accessibilityRole="button" onPress={() => setOpen(false)} style={{ color: colors.primary, fontWeight: '800', padding: 6 }}>Done</Text>
          </View>
        </View>
      )}
    </View>
  );
}
