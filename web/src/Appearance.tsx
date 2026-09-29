import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, getTheme, isDark, Mode, onThemeChange, PALETTES, setTheme } from './theme';
import { Card, Icon, IconName, Muted, Overline } from './ui';

// Appearance: light, dark or follow the phone, and a colour theme. Saved on this device.
export function useThemeChoice() {
  const [t, setT] = useState(getTheme());
  useEffect(() => onThemeChange(() => setT(getTheme())), []);
  return t;
}

export function DarkToggle({ size = 22 }: { size?: number }) {
  const t = useThemeChoice();
  const dark = isDark(t);
  return (
    <Pressable onPress={() => setTheme({ ...t, mode: dark ? 'light' : 'dark' })} accessibilityRole="switch" accessibilityState={{ checked: dark }} accessibilityLabel="Dark mode"
      style={({ pressed }) => ({ padding: 8, borderRadius: 14, backgroundColor: pressed ? colors.surfaceAlt2 : 'transparent' })}>
      <Icon name={dark ? 'sunny-outline' : 'moon-outline'} size={size} color={colors.text} />
    </Pressable>
  );
}

export default function AppearanceSettings({ big }: { big?: boolean }) {
  const t = useThemeChoice();
  const modes: { id: Mode; label: string; icon: IconName }[] = [
    { id: 'system', label: 'Same as phone', icon: 'phone-portrait-outline' },
    { id: 'light', label: 'Light', icon: 'sunny-outline' },
    { id: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];
  const fs = big ? 20 : 15;
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <Overline>Mode</Overline>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
          {modes.map((m) => {
            const on = t.mode === m.id;
            return (
              <Pressable key={m.id} onPress={() => setTheme({ ...t, mode: m.id })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label}
                style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: big ? 16 : 12, borderRadius: 16, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.card }}>
                <Icon name={m.icon} size={big ? 28 : 22} color={on ? colors.primary : colors.muted} />
                <Text style={{ fontWeight: '800', fontSize: fs - 2, color: on ? colors.primary : colors.text, textAlign: 'center' }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Muted>"Same as phone" switches to dark automatically at night if your phone does.</Muted>
      </Card>
      <Card style={{ gap: 10 }}>
        <Overline>Colour theme</Overline>
        {PALETTES.map((p) => {
          const on = t.palette === p.id;
          const tone = isDark(t) ? p.dark : p.light;
          return (
            <Pressable key={p.id} onPress={() => setTheme({ ...t, palette: p.id })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.name}: ${p.desc}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: pressed ? colors.surfaceAlt : colors.card })}>
              <View style={[{ width: 48, height: 48, borderRadius: 14 }, { backgroundImage: `linear-gradient(135deg, ${tone.grad1}, ${tone.grad2})` } as any]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: fs, color: colors.text }}>{p.name}</Text>
                <Text style={{ fontSize: fs - 3, color: colors.muted }}>{p.desc}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[tone.primary, tone.accent].map((c) => <View key={c} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c }} />)}
              </View>
              {on && <Icon name="checkmark-circle" size={24} color={colors.primary} />}
            </Pressable>
          );
        })}
        <Muted>Saved on this device only, so each person can pick their own.</Muted>
      </Card>
    </View>
  );
}
