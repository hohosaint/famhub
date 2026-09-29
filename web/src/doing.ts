// What this person is doing right now (for example the form they have open), for live presence.
// Sheets set it automatically from their title; test-only sheets are kept private.
let doingNow = '';
export const doingListeners = new Set<() => void>();
const PRIVATE = ['Switch profile', 'Add a test profile', 'Message outbox', 'Online now', 'Your care circles'];
export const getDoing = () => doingNow;
export function setDoing(text: string) {
  const v = PRIVATE.some((x) => text.startsWith(x)) || text.startsWith('Edit ') && text.length < 3 ? '' : text;
  if (v === doingNow) return;
  doingNow = v;
  doingListeners.forEach((f) => f());
}

// Typing: set while the person is typing in a form, cleared 3 seconds after the last key.
let typingUntil = 0;
let typingTimer: any = null;
export const isTyping = () => Date.now() < typingUntil;
export function markTyping() {
  const was = isTyping();
  typingUntil = Date.now() + 3000;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => doingListeners.forEach((f) => f()), 3050);
  if (!was) doingListeners.forEach((f) => f());
}

// How far down the page this person has scrolled (0 = top, 1 = bottom).
let scrollNow = 0;
export const getScroll = () => scrollNow;
export function setScroll(ratio: number) {
  const v = Math.max(0, Math.min(1, Math.round(ratio * 100) / 100));
  if (v === scrollNow) return;
  scrollNow = v;
  doingListeners.forEach((f) => f());
}

// The pointer: where this person last moved the mouse, tapped or scrolled to on the page.
// x is a share of the page column width, y is in page pixels from the top of the page content,
// so it lines up for others even when their window is a different size or scrolled.
export type CursorKind = 'move' | 'tap' | 'scroll';
let cursorNow: { x: number; y: number; kind: CursorKind } | null = null;
export const getCursor = () => cursorNow;
export function setCursor(c: { x: number; y: number } | null, kind: CursorKind = 'move') {
  const v = c ? { x: Math.round(c.x * 1000) / 1000, y: Math.round(c.y), kind } : null;
  if (JSON.stringify(v) === JSON.stringify(cursorNow)) return;
  cursorNow = v;
  doingListeners.forEach((f) => f());
}
export const lastCursorX = () => (cursorNow ? cursorNow.x : 0.5);
