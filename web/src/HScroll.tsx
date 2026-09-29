import { ReactNode, useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { colors } from './theme';
import { Icon } from './ui';

// A sideways list that also scrolls with an ordinary (up/down) mouse wheel or trackpad,
// can be dragged with the mouse, and has arrow buttons on a computer.
export default function HScroll({ children, gap = 8, step = 320, arrows = true, paddingRight = 0 }: { children: ReactNode; gap?: number; step?: number; arrows?: boolean; paddingRight?: number }) {
  const ref = useRef<any>(null);
  const fine = Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const el: HTMLElement | null = ref.current?.getScrollableNode?.() || null;
    if (!el) return undefined;
    // Up/down wheel moves the list left/right.
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    // Click and drag with the mouse.
    let down = false; let startX = 0; let startLeft = 0; let moved = false;
    const md = (e: MouseEvent) => { if (e.button !== 0) return; down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft; };
    const mm = (e: MouseEvent) => { if (!down) return; const dx = e.clientX - startX; if (Math.abs(dx) > 4) { moved = true; el.scrollLeft = startLeft - dx; el.style.cursor = 'grabbing'; } };
    const mu = () => { down = false; el.style.cursor = ''; };
    const click = (e: MouseEvent) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('wheel', wheel); el.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); el.removeEventListener('click', click, true);
    };
  }, []);

  const nudge = (dir: number) => {
    const el: HTMLElement | null = ref.current?.getScrollableNode?.() || null;
    el?.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  const arrow = (dir: number) => (
    <Pressable onPress={() => nudge(dir)} accessibilityRole="button" accessibilityLabel={dir < 0 ? 'Scroll left' : 'Scroll right'}
      style={{ width: 32, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Icon name={dir < 0 ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.primary} />
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 6 }}>
      {fine && arrows && arrow(-1)}
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={!fine} style={{ flex: 1 }} contentContainerStyle={{ gap, paddingRight }}>
        {children}
      </ScrollView>
      {fine && arrows && arrow(1)}
    </View>
  );
}
