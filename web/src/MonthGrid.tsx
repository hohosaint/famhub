import { Pressable, Text, View } from 'react-native';
import { colors } from './theme';
import { Icon } from './ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const todayYMD = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

function shiftMonth(month: string, by: number) {
  const d = new Date(`${month}-15T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

// A month calendar for picking a date. Dots show days that already have appointments.
export default function MonthGrid({ month, onMonthChange, selected, onSelect, marks = {}, minDate }: {
  month: string; onMonthChange: (m: string) => void; selected: string; onSelect: (ymd: string) => void;
  marks?: Record<string, string[]>; minDate?: string;
}) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const startDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(startDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const today = todayYMD();
  const title = first.toLocaleDateString('en-SG', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => onMonthChange(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month" style={{ padding: 8 }}><Icon name="chevron-back" size={22} color={colors.primary} /></Pressable>
        <Text style={{ fontSize: 17, fontWeight: '800' }}>{title}</Text>
        <Pressable onPress={() => onMonthChange(shiftMonth(month, 1))} accessibilityRole="button" accessibilityLabel="Next month" style={{ padding: 8 }}><Icon name="chevron-forward" size={22} color={colors.primary} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.muted }}>{w}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={{ flex: 1, height: 46 }} />;
            const on = d === selected;
            const disabled = Boolean(minDate && d < minDate);
            const dots = marks[d] || [];
            return (
              <Pressable key={d} disabled={disabled} onPress={() => onSelect(d)} accessibilityRole="button" accessibilityState={{ selected: on, disabled }} accessibilityLabel={d}
                style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: on ? colors.primary : 'transparent', opacity: disabled ? 0.35 : 1 }}>
                <Text style={{ fontSize: 16, fontWeight: d === today || on ? '800' : '500', color: on ? '#fff' : d === today ? colors.primary : colors.text }}>{Number(d.slice(8))}</Text>
                <View style={{ flexDirection: 'row', gap: 2, height: 5, marginTop: 2 }}>
                  {dots.slice(0, 3).map((c, j) => <View key={j} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? '#fff' : c }} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
