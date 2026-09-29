import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtDate } from './api';
import DatePicker from './DatePicker';
import { cleanRule, DAY_NAMES, describeRule, expandRule, Freq, MONTH_NAMES, RepeatRule } from './recur';
import { colors } from './theme';
import { Button, Choice, Icon, Muted, Sheet, s } from './ui';

export type RepeatValue = { freq: Freq; every?: number; weekdays?: number[]; monthDays?: number[]; months?: number[]; until?: string };
export const NO_REPEAT: RepeatValue = { freq: 'none' };

const FREQ_OPTIONS: { value: Freq; label: string }[] = [
  { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' },
];
const UNIT: Record<string, [string, string]> = { daily: ['day', 'days'], weekly: ['week', 'weeks'], monthly: ['month', 'months'], yearly: ['year', 'years'] };

// A tick box.
function Box({ label, on, onPress, wide }: { label: string; on: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: wide ? 10 : 6, borderRadius: 10, borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.card, minWidth: wide ? 70 : 42, justifyContent: 'center' }}>
      <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: on ? colors.primary : colors.faint, backgroundColor: on ? colors.primary : colors.card, alignItems: 'center', justifyContent: 'center' }}>
        {on && <Icon name="checkmark" size={12} color="#fff" />}
      </View>
      <Text style={{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? colors.primary : colors.text }}>{label}</Text>
    </Pressable>
  );
}

const toggle = (list: number[], n: number) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b));

// "Repeat" section for a new request, appointment or medicine.
export default function RepeatPicker({ start, value, onChange, openEnded = false }: { start: string; value: RepeatValue; onChange: (v: RepeatValue) => void; openEnded?: boolean }) {
  const s0 = new Date(`${start}T00:00:00Z`);
  const setFreq = (freq: Freq) => {
    if (freq === 'none') return onChange(NO_REPEAT);
    onChange({
      freq, every: 1, until: value.until || '',
      weekdays: freq === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : freq === 'weekly' ? [s0.getUTCDay()] : [],
      monthDays: freq === 'monthly' ? [s0.getUTCDate()] : [],
      months: freq === 'yearly' ? [s0.getUTCMonth() + 1] : [],
    });
  };
  const rule: RepeatRule | null = value.freq === 'none' ? null : cleanRule(value, start, openEnded);
  const days = rule && !openEnded ? expandRule(start, rule) : [];
  const every = value.every || 1;
  const unit = UNIT[value.freq] || ['', ''];
  const noneTicked = (value.freq === 'daily' || value.freq === 'weekly') ? !(value.weekdays || []).length
    : value.freq === 'monthly' ? !(value.monthDays || []).length : value.freq === 'yearly' ? !(value.months || []).length : false;

  return (
    <View style={{ gap: 10 }}>
      <Choice label="Repeat" value={value.freq} onChange={setFreq} options={FREQ_OPTIONS} />
      {value.freq !== 'none' && (
        <View style={{ gap: 12, backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.label}>Every</Text>
            <Pressable onPress={() => onChange({ ...value, every: Math.max(1, every - 1) })} accessibilityRole="button" accessibilityLabel="Less often" style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}><Icon name="remove" size={18} color={colors.primary} /></Pressable>
            <Text accessibilityLabel={`Every ${every} ${every === 1 ? unit[0] : unit[1]}`} style={{ fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'center' }}>{every}</Text>
            <Pressable onPress={() => onChange({ ...value, every: Math.min(99, every + 1) })} accessibilityRole="button" accessibilityLabel="More apart" style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}><Icon name="add" size={18} color={colors.primary} /></Pressable>
            <Text style={{ fontSize: 16, color: colors.text }}>{every === 1 ? unit[0] : unit[1]}</Text>
          </View>

          {(value.freq === 'daily' || value.freq === 'weekly') && (
            <View style={{ gap: 6 }}>
              <Text style={s.label}>On these days</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {DAY_NAMES.map((d, i) => <Box key={d} label={d} wide on={(value.weekdays || []).includes(i)} onPress={() => onChange({ ...value, weekdays: toggle(value.weekdays || [], i) })} />)}
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Text accessibilityRole="button" onPress={() => onChange({ ...value, weekdays: [0, 1, 2, 3, 4, 5, 6] })} style={{ color: colors.primary, fontWeight: '700' }}>Every day</Text>
                <Text accessibilityRole="button" onPress={() => onChange({ ...value, weekdays: [1, 2, 3, 4, 5] })} style={{ color: colors.primary, fontWeight: '700' }}>Weekdays</Text>
                <Text accessibilityRole="button" onPress={() => onChange({ ...value, weekdays: [0, 6] })} style={{ color: colors.primary, fontWeight: '700' }}>Weekends</Text>
              </View>
            </View>
          )}

          {value.freq === 'monthly' && (
            <View style={{ gap: 6 }}>
              <Text style={s.label}>On these days of the month</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <Box key={d} label={String(d)} on={(value.monthDays || []).includes(d)} onPress={() => onChange({ ...value, monthDays: toggle(value.monthDays || [], d) })} />)}
              </View>
              <Muted>Months without a ticked day (for example the 31st) are skipped.</Muted>
            </View>
          )}

          {value.freq === 'yearly' && (
            <View style={{ gap: 6 }}>
              <Text style={s.label}>In these months (on day {s0.getUTCDate()})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {MONTH_NAMES.map((m, i) => <Box key={m} label={m} wide on={(value.months || []).includes(i + 1)} onPress={() => onChange({ ...value, months: toggle(value.months || [], i + 1) })} />)}
              </View>
            </View>
          )}

          {openEnded ? (
            <View style={{ gap: 6 }}>
              <Box wide label="Keep repeating until the medicine is stopped" on={!value.until} onPress={() => onChange({ ...value, until: value.until ? '' : start })} />
              {!!value.until && <DatePicker label="Last day" value={value.until} onChange={(v) => onChange({ ...value, until: v || '' })} minDate={start} />}
            </View>
          ) : (
            <DatePicker label="Repeat until" value={value.until || rule?.until || ''} onChange={(v) => onChange({ ...value, until: v })} minDate={start} />
          )}

          {noneTicked ? (
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Tick at least one {value.freq === 'yearly' ? 'month' : 'day'}.</Text>
          ) : rule && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="repeat" size={18} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
                <Text style={{ fontWeight: '800' }}>{describeRule(rule)}</Text>
                {openEnded ? (value.until ? `, until ${fmtDate(rule.until)}` : ', until stopped') : `, until ${fmtDate(rule.until)} · ${days.length} time${days.length === 1 ? '' : 's'}${days.length ? ` (first: ${days.slice(0, 3).map((d) => fmtDate(d).replace(/ \d{4}$/, '')).join('; ')}${days.length > 3 ? '...' : ''})` : ''}`}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// Keep only the first of each repeating series (the list stays short); the rest are counted.
export function collapseSeries<T extends { id: string; seriesId?: string }>(items: T[]): { item: T; more: number }[] {
  const seen = new Map<string, { item: T; more: number }>();
  const out: { item: T; more: number }[] = [];
  for (const it of items) {
    if (!it.seriesId) { out.push({ item: it, more: 0 }); continue; }
    const got = seen.get(it.seriesId);
    if (got) got.more += 1;
    else { const row = { item: it, more: 0 }; seen.set(it.seriesId, row); out.push(row); }
  }
  return out;
}

// "Delete a repeating ...": just this one, this and the later ones, or all of them.
export function SeriesDelete({ what, onDelete, close, onChoose }: { what: string; onDelete: (series: '' | 'later' | 'all') => void; close: () => void; onChoose?: () => void }) {
  return (
    <Sheet visible title={`Delete repeating ${what}`} onClose={close}>
      <Muted>This {what} repeats. What would you like to delete?</Muted>
      <Button kind="secondary" icon="remove-circle-outline" label="Only this one" onPress={() => { close(); onDelete(''); }} />
      <Button kind="secondary" icon="play-forward-outline" label="This one and the later ones" onPress={() => { close(); onDelete('later'); }} />
      {onChoose && <Button kind="secondary" icon="checkbox-outline" label="Choose dates to delete..." onPress={() => { close(); onChoose(); }} />}
      <Button kind="danger" icon="trash-outline" label="All of them" onPress={() => { close(); onDelete('all'); }} />
      <Button kind="ghost" label="Cancel" onPress={close} />
    </Sheet>
  );
}

export function RepeatBadge({ text, more, onPress }: { text?: string; more?: number; onPress?: () => void }) {
  if (!text) return null;
  const inner = (
    <>
      <Icon name="repeat" size={13} color={colors.primary} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{text}{more ? ` · ${more} more` : ''}</Text>
      {onPress && <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, textDecorationLine: 'underline' }}> Manage</Text>}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' as const };
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Repeats: ${text}${more ? `, ${more} more to come` : ''}. Manage repeats`} style={style}>{inner}</Pressable>
    : <View accessibilityLabel={`Repeats: ${text}${more ? `, ${more} more to come` : ''}`} style={style}>{inner}</View>;
}

// "Save changes to": only this one, this one and the later ones, or all of them.
export function SeriesScope({ what, onPick, close }: { what: string; onPick: (scope: '' | 'later' | 'all') => void; close: () => void }) {
  return (
    <Sheet visible title={`Change repeating ${what}`} onClose={close}>
      <Muted>This {what} repeats. Which ones should get the change?</Muted>
      <Button kind="secondary" icon="remove-circle-outline" label="Only this one" onPress={() => { close(); onPick(''); }} />
      <Button kind="secondary" icon="play-forward-outline" label="This one and the later ones" onPress={() => { close(); onPick('later'); }} />
      <Button icon="repeat" label="All of them" onPress={() => { close(); onPick('all'); }} />
      <Button kind="ghost" label="Cancel" onPress={close} />
    </Sheet>
  );
}

// Manage repeats: every date in the series with a tick box; delete the ticked ones or the whole series.
export type SeriesRow = { id: string; day: string; label: string; done?: boolean };
export function SeriesManager({ what, title, rule, rows, onDelete, close }: {
  what: string; title: string; rule?: string; rows: SeriesRow[]; onDelete: (ids: string[]) => Promise<boolean>; close: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const upcoming = rows.filter((r) => r.day >= today).map((r) => r.id);
  const flip = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const fromFirst = () => { const first = rows.findIndex((r) => picked.includes(r.id)); if (first >= 0) setPicked(rows.slice(first).map((r) => r.id)); };
  const del = async (ids: string[]) => { if (!ids.length) return; setBusy(true); const ok = await onDelete(ids); setBusy(false); if (ok) { setPicked([]); if (ids.length === rows.length) close(); } };
  return (
    <Sheet visible title="Manage repeats" onClose={close}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{title}</Text>
      {!!rule && <RepeatBadge text={rule} />}
      <Muted>{rows.length} {what}{rows.length === 1 ? '' : 's'} in this series. Tick the dates to delete.</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Text accessibilityRole="button" onPress={() => setPicked(rows.map((r) => r.id))} style={{ color: colors.primary, fontWeight: '700' }}>Tick all</Text>
        <Text accessibilityRole="button" onPress={() => setPicked(upcoming)} style={{ color: colors.primary, fontWeight: '700' }}>Tick upcoming</Text>
        <Text accessibilityRole="button" onPress={fromFirst} style={{ color: colors.primary, fontWeight: '700' }}>Tick from the first ticked on</Text>
        <Text accessibilityRole="button" onPress={() => setPicked([])} style={{ color: colors.primary, fontWeight: '700' }}>Clear</Text>
      </View>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card }}>
        {rows.map((r, i) => {
          const on = picked.includes(r.id);
          return (
            <Pressable key={r.id} onPress={() => flip(r.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${r.label}${r.done ? ', done' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: on ? colors.dangerSoft : r.day < today ? colors.surfaceAlt : colors.card }}>
              <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: on ? colors.danger : colors.faint, backgroundColor: on ? colors.danger : colors.card, alignItems: 'center', justifyContent: 'center' }}>
                {on && <Icon name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: r.day < today ? colors.muted : colors.text, textDecorationLine: r.done ? 'line-through' : 'none' }}>{r.label}</Text>
              {r.done && <Text style={{ fontSize: 12, color: colors.ok, fontWeight: '700' }}>Done</Text>}
              {r.day === today && <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>Today</Text>}
            </Pressable>
          );
        })}
      </View>
      <Button kind="danger" icon="trash-outline" disabled={busy || !picked.length} label={picked.length ? `Delete ${picked.length} ticked` : 'Tick dates to delete'} onPress={() => del(picked)} />
      <Button kind="secondary" icon="trash-bin-outline" disabled={busy} label={`Delete the whole series (${rows.length})`} onPress={() => del(rows.map((r) => r.id))} />
    </Sheet>
  );
}
