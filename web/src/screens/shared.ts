import { CircleData, Role } from '../api';

export type ScreenProps = { data: CircleData; cid: string; refresh: () => Promise<void>; go: (tab: string) => void };

export const nameOf = (data: CircleData, userId: string) =>
  data.members.find((m) => m.userId === userId)?.name || (userId ? 'Former member' : '');

export const memberOptions = (data: CircleData, roles: Role[] = ['owner', 'family', 'helper']) =>
  data.members.filter((m) => roles.includes(m.role)).map((m) => ({ value: m.userId, label: m.userId === data.me.userId ? `${m.name} (me)` : m.name }));

// Runs an action, shows its error, and reloads the data.
export async function run(action: () => Promise<unknown>, refresh: () => Promise<void>, setError: (e: string | null) => void) {
  try {
    setError(null);
    await action();
    await refresh();
    return true;
  } catch (e: any) {
    setError(e?.message || String(e));
    return false;
  }
}
