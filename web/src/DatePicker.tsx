import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtDate } from './api';
import MonthGrid, { todayYMD } from './MonthGrid';
import { colors } from './theme';
import { Icon, s } from './ui';

// A date field: tap it and a month calendar opens right underneath. Tap a day to choose it.
export default function DatePicker({ label, value, onChange, optional, marks, minDate }: {
  label: string; value: string; onChange: (v: string) => void; optional?: boolean; marks?: Record<string, string[]>; minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || todayYMD()).slice(0, 7));
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable onPress={() => { setMonth((value || todayYMD()).slice(0, 7)); setOpen(!open); }} accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? fmtDate(value) : 'not set'}. ${open ? 'Close' : 'Open'} calendar`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: open ? colors.primary : colors.border, backgroundColor: colors.card }}>
        <Icon name="calendar" size={20} color={colors.primary} />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: value ? colors.text : colors.faint }}>{value ? fmtDate(value) : 'Tap to choose a date'}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
      </Pressable>
      {open && (
        <View style={{ gap: 6 }}>
          <MonthGrid month={month} onMonthChange={setMonth} selected={value} onSelect={(d) => { onChange(d); setOpen(false); }} marks={marks} minDate={minDate} />
          {optional && !!value && <Text accessibilityRole="button" onPress={() => { onChange(''); setOpen(false); }} style={{ color: colors.danger, fontWeight: '700', textAlign: 'center', padding: 6 }}>Clear date</Text>}
        </View>
      )}
    </View>
  );
}
