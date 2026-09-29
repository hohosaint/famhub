import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { CircleData, Role } from '../api';
import { colors } from '../theme';
import { Row, s } from '../ui';

export type ScreenProps = { data: CircleData; cid: string; refresh: () => Promise<void>; go: (tab: string) => void };

export const nameOf = (data: CircleData, userId: string) =>
  data.members.find((m) => m.userId === userId)?.name || (userId ? 'Former member' : '');

export const memberOptions = (data: CircleData, roles: Role[] = ['owner', 'family', 'helper']) =>
  data.members.filter((m) => roles.includes(m.role)).map((m) => ({ value: m.userId, label: m.userId === data.me.userId ? `${m.name} (me)` : m.name }));

export async function run(action: () => Promise<unknown>, refresh: () => Promise<void>, setError: (e: string | null) => void) {
  try { setError(null); await action(); await refresh(); return true; }
  catch (e: any) { setError(e?.message || String(e)); return false; }
}

// Large page title with an optional action, as in iOS apps.
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>{title}</Text>
        {!!subtitle && <Text style={s.muted}>{subtitle}</Text>}
      </View>
      {right}
    </Row>
  );
}

export const sgDayOf = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(0, 10);
export const sgTimeOf = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(11, 16);
export const greeting = () => { const h = Number(new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 13)); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
