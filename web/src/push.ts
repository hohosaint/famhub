// Device notifications in the browser (Web Push). Works in Chrome, Edge and Firefox on
// computers and Android, and on iPhone (iOS 16.4 or later) once Famhub is added to the Home Screen.
import { api } from './api';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

function toBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js'); } catch { return null; }
}

// Adds the manifest and icons so the site can be installed to the Home Screen.
export function addInstallTags() {
  if (typeof document === 'undefined' || document.querySelector('link[rel="manifest"]')) return;
  const add = (tag: string, attrs: Record<string, string>) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); };
  add('link', { rel: 'manifest', href: '/manifest.webmanifest' });
  add('link', { rel: 'apple-touch-icon', href: '/icon-192.png' });
  add('meta', { name: 'theme-color', content: '#0E7C6B' });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Famhub' });
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  if (!pushSupported()) throw new Error(isIos() && !isStandalone() ? 'On iPhone, first add Famhub to your Home Screen (Share, then Add to Home Screen), open it from there, and try again.' : 'This browser does not support notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in the browser settings, then try again.');
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushKey();
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) }));
  const device = `${/android/i.test(navigator.userAgent) ? 'Android' : isIos() ? 'iPhone' : /windows/i.test(navigator.userAgent) ? 'Windows' : /mac/i.test(navigator.userAgent) ? 'Mac' : 'Device'} browser`;
  await api.pushSubscribe(sub.toJSON(), device);
  return true;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) { await api.pushUnsubscribe(sub.endpoint); await sub.unsubscribe(); }
}
