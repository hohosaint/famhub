import { createElement, ReactNode, useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, gradients, personColor, radius, shadow } from './theme';
import { TimeField } from './TimeWheel';
import { markTyping, setDoing } from './doing';
import { photoUrl } from './api';

export type IconName = keyof typeof Ionicons.glyphMap;
export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// A view with a brand gradient background (web); falls back to a solid colour elsewhere.
export function Gradient({ children, style, colors: g = gradients.brand, fallback = colors.primary }: { children?: ReactNode; style?: ViewStyle | ViewStyle[]; colors?: string; fallback?: string }) {
  if (Platform.OS !== 'web') return <View style={[{ backgroundColor: fallback }, style as any]}>{children}</View>;
  return <View style={[{ backgroundColor: fallback }, style as any, { backgroundImage: g } as any]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle | (ViewStyle | undefined | false)[]; onPress?: () => void }) {
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [s.card, style as any, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
  return <View style={[s.card, style as any]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title} accessibilityRole="header">{children}</Text>;
}

export function Overline({ children }: { children: ReactNode }) {
  return <Text style={s.overline}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={s.muted}>{children}</Text>;
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({ label, onPress, kind = 'primary', disabled, icon, small }: { label: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; icon?: IconName; small?: boolean }) {
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, kind === 'primary' && (Platform.OS === 'web' ? ({ backgroundImage: gradients.brand, boxShadow: '0 6px 16px rgba(16,24,40,0.22)' } as any) : null), small && s.btnSmall, kind === 'secondary' && s.btnSecondary, kind === 'danger' && s.btnDanger, kind === 'ghost' && s.btnGhost, pressed && { transform: [{ scale: 0.97 }] }, (pressed || disabled) && { opacity: 0.75 }]}
    >
      {icon && <Icon name={icon} size={small ? 16 : 18} color={fg} />}
      <Text style={[s.btnText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, badge, color = colors.text }: { icon: IconName; onPress: () => void; label: string; badge?: number; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.iconBtn, pressed && { backgroundColor: colors.primarySoft }]}>
      <Icon name={icon} size={24} color={color} />
      {!!badge && badge > 0 && <View style={s.badgeDot}><Text style={s.badgeDotText}>{badge > 99 ? '99+' : badge}</Text></View>}
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, multiline, keyboard, secure, autoComplete, onSubmit }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboard?: 'decimal-pad' | 'phone-pad' | 'numeric' | 'email-address'; secure?: boolean; autoComplete?: any; onSubmit?: () => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label} value={value} onChangeText={(v) => { if (!secure) markTyping(); onChange(v); }} placeholder={placeholder} placeholderTextColor={colors.faint}
        multiline={multiline} keyboardType={keyboard} secureTextEntry={secure} autoComplete={autoComplete} autoCapitalize={secure || autoComplete ? 'none' : undefined} onSubmitEditing={onSubmit} style={[s.input, multiline && { minHeight: 96, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

// Native date and time pickers in the browser.
export function DateField({ label, value, onChange, withTime, timeOnly, minuteStep, optional }: { label: string; value: string; onChange: (v: string) => void; withTime?: boolean; timeOnly?: boolean; minuteStep?: number; optional?: boolean }) {
  if (timeOnly) return <TimeField label={label} value={value} onChange={onChange} minuteStep={minuteStep} optional={optional} labelStyle={s.label} />;
  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: 6 }}>
        <Text style={s.label}>{label}</Text>
        {createElement('input', {
          type: timeOnly ? 'time' : withTime ? 'datetime-local' : 'date', value, 'aria-label': label,
          onChange: (e: any) => onChange(e.target.value),
          style: { fontSize: 16, padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, fontFamily: 'inherit', color: colors.text, background: colors.card },
        })}
      </View>
    );
  }
  return <Field label={label} value={value} onChange={onChange} />;
}

export function Choice<T extends string>({ label, options, value, onChange }: { label?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={s.chips}>
        {options.map((o) => (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: value === o.value }} style={[s.chip, value === o.value && s.chipOn]}>
            <Text style={[s.chipText, value === o.value && s.chipTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MultiChoice({ label, options, values, onChange }: { label: string; options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <Pressable key={o.value} onPress={() => toggle(o.value)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[s.chip, on && s.chipOn]}>
              {on && <Icon name="checkmark" size={14} color="#fff" />}
              <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// iOS-style segmented control.
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }} style={[s.segmentItem, value === o.value && s.segmentOn]}>
          <Text style={[s.segmentText, value === o.value && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLiveRegion="polite">
      <Icon name="alert-circle" size={18} color={colors.danger} />
      <Text style={[s.error, { flex: 1 }]}>{message}</Text>
    </View>
  ) : null;
}

export function Empty({ children, icon = 'leaf-outline' }: { children: ReactNode; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
      <Icon name={icon} size={32} color={colors.faint} />
      <Text style={[s.muted, { textAlign: 'center' }]}>{children}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  const bg = { neutral: colors.surfaceAlt2, good: colors.okSoft, warn: colors.warnSoft, bad: colors.dangerSoft, info: colors.primarySoft }[tone];
  const fg = { neutral: colors.muted, good: colors.ok, warn: colors.warn, bad: colors.danger, info: colors.primary }[tone];
  return <Text style={{ backgroundColor: bg, color: fg, fontSize: 12, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, overflow: 'hidden', alignSelf: 'flex-start' }}>{label}</Text>;
}

export function Banner({ children, tone = 'bad' }: { children: ReactNode; tone?: 'bad' | 'warn' | 'good' | 'info' }) {
  const bg = { bad: colors.dangerSoft, warn: colors.warnSoft, good: colors.okSoft, info: colors.primarySoft }[tone];
  const border = { bad: colors.dangerBorder, warn: colors.warnBorder, good: colors.okBorder, info: colors.okBorder }[tone];
  return <View style={{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius, padding: 16, gap: 10 }}>{children}</View>;
}

export function Link({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Text accessibilityRole="link" onPress={onPress} style={[s.link, danger && { color: colors.danger }]}>{label}</Text>;
}

export function Toggle({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{label}</Text>
        {!!help && <Text style={s.small}>{help}</Text>}
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: value ? colors.primary : colors.borderStrong, padding: 3, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.card }} />
      </View>
    </Pressable>
  );
}

export function FilePicker({ label, accept, onPick, busy }: { label: string; accept: string; onPick: (f: File) => void; busy?: boolean }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      {createElement('input', {
        type: 'file', accept, disabled: busy, 'aria-label': label,
        onChange: (e: any) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; },
        style: { fontSize: 15, padding: 10, borderRadius: 12, border: `1px dashed ${colors.border}`, background: colors.card },
      })}
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}><Overline>{title}</Overline>{right}</Row>
      {children}
    </View>
  );
}

// Profile photos (4.9): the app registers photo file ids for people, babies and the person cared for
// ("person-<circleId>"); every Avatar with that id then shows the photo instead of initials.
const avatarPhotos: Record<string, string> = {};
export function setAvatarPhotos(map: Record<string, string | undefined>) { for (const [k, v] of Object.entries(map)) { if (v) avatarPhotos[k] = v; else delete avatarPhotos[k]; } }
export function avatarPhotoOf(id: string) { return avatarPhotos[id] || ''; }

export function Avatar({ id, name, size = 36, photo }: { id: string; name: string; size?: number; photo?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const file = photo !== undefined ? photo : avatarPhotos[id];
  const [broken, setBroken] = useState('');
  if (file && broken !== file) {
    return <Image source={{ uri: photoUrl(file) }} onError={() => setBroken(file)} accessibilityLabel={name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: personColor(id) }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: personColor(id), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{initials}</Text>
    </View>
  );
}

// Opens the phone's photo picker or camera (web).
export function pickImage(onPick: (f: File) => void) {
  if (typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = () => { const f = input.files && input.files[0]; if (f) onPick(f); };
  input.click();
}

// A tappable avatar with a camera badge for changing the photo.
export function PhotoAvatar({ id, name, size = 72, onUpload, onRemove }: { id: string; name: string; size?: number; onUpload: (f: File) => Promise<unknown>; onRemove?: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = !!avatarPhotos[id];
  const run = async (f: () => Promise<unknown>) => { setBusy(true); setError(null); try { await f(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable onPress={() => pickImage((f) => run(() => onUpload(f)))} accessibilityRole="button" accessibilityLabel={`${has ? 'Change' : 'Add'} photo of ${name}`} style={{ opacity: busy ? 0.5 : 1 }}>
        <Avatar id={id} name={name} size={size} />
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: Math.max(24, size * 0.34), height: Math.max(24, size * 0.34), borderRadius: 99, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card }}>
          <Icon name="camera" size={Math.max(13, size * 0.18)} color="#fff" />
        </View>
      </Pressable>
      {busy ? <Text style={{ fontSize: 12, color: colors.muted }}>Uploading...</Text> : has && onRemove ? <Text onPress={() => run(onRemove)} style={{ fontSize: 12, color: colors.muted, textDecorationLine: 'underline' }}>Remove photo</Text> : null}
      {!!error && <Text style={{ fontSize: 12, color: colors.danger, maxWidth: 200, textAlign: 'center' }}>{error}</Text>}
    </View>
  );
}

// A list row with a leading icon, as in iOS settings.
export function ListItem({ icon, iconColor = colors.primary, title, subtitle, right, onPress }: { icon?: IconName; iconColor?: string; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.listItem, pressed && { backgroundColor: colors.surfaceAlt }]}>
      {icon && <View style={[s.listIcon, { backgroundColor: `${iconColor}1A` }]}><Icon name={icon} size={20} color={iconColor} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600' }}>{title}</Text>
        {!!subtitle && <Text style={s.small}>{subtitle}</Text>}
      </View>
      {right}
      {onPress && <Icon name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

// A bottom sheet for forms.
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  // On phones the tap that opens a sheet can also land on the new backdrop a moment later
  // (a "ghost click"), which would close it straight away. Ignore backdrop taps for the first half second.
  const openedAt = useRef(Date.now());
  // Let the others in the circle see what this person is working on (live presence).
  useEffect(() => { if (!visible) return undefined; setDoing(title); return () => setDoing(''); }, [visible, title]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={() => { if (Date.now() - openedAt.current > 500) onClose(); }} accessibilityLabel="Close" />
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <Text style={s.title}>{title}</Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </Row>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function Fab({ label, onPress, icon = 'add' }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.fab, pressed && { backgroundColor: colors.primaryDark }]}>
      <Icon name={icon} size={22} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border, ...shadow },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  overline: { fontSize: 12, fontWeight: '800', color: colors.accent, letterSpacing: 1.2, textTransform: 'uppercase' },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  input: { fontSize: 16, padding: 13, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, color: colors.text },
  btn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 26, alignItems: 'center', justifyContent: 'center', minHeight: 48, flexDirection: 'row', gap: 8 },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12, minHeight: 36 },
  btnSecondary: { backgroundColor: colors.primarySoft },
  btnDanger: { backgroundColor: colors.dangerSoft },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  btnText: { fontSize: 16, fontWeight: '700' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { position: 'absolute', top: 4, right: 2, backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: colors.bg },
  badgeDotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, minHeight: 40, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 15 },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt2, borderRadius: 16, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.card, ...shadow },
  segmentText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 15 },
  itemTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, minHeight: 56 },
  listIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%', backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxWidth: 780, alignSelf: 'center', width: '100%' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: colors.primary, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, ...shadow, shadowOpacity: 0.2 },
});
