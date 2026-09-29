import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { CareFor, Session } from './api';
import { KINDS, kindOf } from './family';
import { colors } from './theme';
import { Gradient, Icon } from './ui';

// Tabs across the top: Parents, Infants, Kids, Teens. Flip between them in one tap; when a tab has
// several circles (Mum and Dad, or two kids) their names show as chips underneath.

type Circle = Session['circles'][number];
const LAST = 'famhub_last_circle_by_kind';
export function rememberCircle(kind: CareFor, id: string) {
  try { const m = JSON.parse(localStorage.getItem(LAST) || '{}'); m[kind] = id; localStorage.setItem(LAST, JSON.stringify(m)); } catch { /* no storage */ }
}
export function lastCircle(kind: CareFor, circles: Circle[]) {
  let id = '';
  try { id = JSON.parse(localStorage.getItem(LAST) || '{}')[kind] || ''; } catch { /* no storage */ }
  const list = circles.filter((c) => (c.careFor || 'elder') === kind);
  return (list.find((c) => c.id === id) || list[0])?.id || '';
}

export default function FamilyTabs({ circles, cid, active, onKind, onCircle, onAdd }: {
  circles: Circle[]; cid: string | null; active: CareFor;
  onKind: (k: CareFor) => void; onCircle: (id: string) => void; onAdd: (k: CareFor) => void;
}) {
  const inKind = circles.filter((c) => (c.careFor || 'elder') === active);
  const k = kindOf(active);
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 6, gap: 8 }}>
      <View accessibilityRole="tablist" style={[{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        Platform.OS === 'web' ? ({ boxShadow: '0 4px 14px rgba(16,24,40,0.06)' } as any) : null]}>
        {KINDS.map((x) => {
          const on = x.id === active;
          const n = circles.filter((c) => (c.careFor || 'elder') === x.id).length;
          const inner = (
            <>
              <View>
                <Icon name={on ? x.iconOn : x.icon} size={20} color={on ? '#fff' : x.color} />
                {n > 0 && !on && <View style={{ position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: x.color, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.card }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{n}</Text></View>}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: on ? '900' : '700', color: on ? '#fff' : colors.muted, letterSpacing: 0.2 }}>{x.tab}</Text>
            </>
          );
          return (
            <Pressable key={x.id} onPress={() => onKind(x.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${x.tab}${n ? `, ${n}` : ', none yet'}`}
              style={({ pressed }) => ({ flex: 1, borderRadius: 18, overflow: 'hidden', transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              {on
                ? <Gradient colors={x.gradient} fallback={x.color} style={{ alignItems: 'center', gap: 3, paddingVertical: 8 }}>{inner}</Gradient>
                : <View style={{ alignItems: 'center', gap: 3, paddingVertical: 8 }}>{inner}</View>}
            </Pressable>
          );
        })}
      </View>
      {inKind.length > 0 && (inKind.length > 1 || true) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {inKind.map((c) => {
            const on = c.id === cid;
            const label = c.parentName || c.name;
            return (
              <Pressable key={c.id} onPress={() => onCircle(c.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${c.name}${on ? ', open' : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999, borderWidth: 1.5, borderColor: on ? k.color : colors.border, backgroundColor: on ? colors.card : 'transparent' }}>
                <Gradient colors={k.gradient} fallback={k.color} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{label.slice(0, 1).toUpperCase()}</Text>
                </Gradient>
                <Text style={{ fontWeight: on ? '900' : '700', color: on ? colors.text : colors.muted, fontSize: 14 }} numberOfLines={1}>{label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => onAdd(active)} accessibilityRole="button" accessibilityLabel={k.setup}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong }}>
            <Icon name="add" size={16} color={colors.muted} />
            <Text style={{ fontWeight: '700', color: colors.muted, fontSize: 13 }}>Add</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

// Shown when a tab has nobody in it yet.
export function EmptyKind({ kind, onSetup }: { kind: CareFor; onSetup: () => void }) {
  const k = kindOf(kind);
  const points: Record<CareFor, string[]> = {
    elder: ['"I\'m OK" check-in and a big "I need help" button', 'Medicines ticked as they are given', 'Appointments with who is going', 'Shared costs and PayNow'],
    baby: ['Bottles with energy, protein, fat and carbs', 'Sleep, diapers and growth charts', 'Twins and triplets side by side', 'Feed-due reminders for everyone'],
    kid: ['School runs and a pick-up rota', 'CCA, classes and check-ups in one calendar', 'Allergies, medicine and school letters', 'Photos and moments for the grandparents'],
    teen: ['A simple "home safe" check-in', 'Exams, CCA and training in the calendar', 'Transport, allowance and errands', 'NRIC at 15 and NS registration reminders'],
  };
  return (
    <View style={{ gap: 16 }}>
      <Gradient colors={k.gradient} fallback={k.color} style={{ borderRadius: 28, padding: 24, gap: 12, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.14)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', right: 50, bottom: -60, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.10)' }} />
        <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}><Icon name={k.iconOn} size={34} color="#fff" /></View>
        <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{k.tab}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 16, lineHeight: 22 }}>{k.blurb}</Text>
      </Gradient>
      <View style={{ backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 }}>
        {points[kind].map((p) => (
          <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: `${k.color}22`, alignItems: 'center', justifyContent: 'center' }}><Icon name="checkmark" size={18} color={k.color} /></View>
            <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' }}>{p}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={onSetup} accessibilityRole="button" accessibilityLabel={k.setup} style={({ pressed }) => ({ borderRadius: 18, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <Gradient colors={k.gradient} fallback={k.color} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 }}>
          <Icon name="sparkles" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17 }}>{k.setup}</Text>
        </Gradient>
      </Pressable>
    </View>
  );
}
