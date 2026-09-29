// All calls from the app to the server.

export type Role = 'owner' | 'family' | 'helper' | 'parent';
export type Member = { userId: string; name: string; role: Role; paynow: string; placeholder: boolean; demo: boolean };
export type Appointment = { id: string; title: string; startsAt: string; location: string; notes: string; escortUserId: string; outcome: string; createdBy: string; seriesId?: string; repeatText?: string; fileIds?: string[] };
export type TaskStatus = 'open' | 'accepted' | 'done';
export type Task = { id: string; title: string; category: string; dueDate: string; dueTime?: string; fileIds?: string[]; seriesId?: string; repeatText?: string; repeat?: any; assigneeUserId: string; status: TaskStatus; createdBy: string; createdAt: string; doneBy: string; doneAt: string };
export type Comment = { id: string; userId: string; text: string; createdAt: string };
export type Note = { id: string; authorUserId: string; text: string; fileId: string; fileIds?: string[]; urgent: boolean; createdAt: string; reactions: Record<string, string>; comments: Comment[] };
export type SplitMode = 'equal' | 'ratio' | 'fixed';
export type Expense = { id: string; item: string; category: string; amount: number; paidByUserId: string; spentOn: string; splitMode: SplitMode; shares: Record<string, number>; receiptFileId: string; settlement: boolean };
export type Transfer = { fromUserId: string; toUserId: string; fromName: string; toName: string; amount: number; toHasPayNow: boolean };
export type Medication = { id: string; name: string; dose: string; times: string[]; instructions: string; active: boolean; supply: number | null; perDose: number; refillAt: number; startDate?: string; repeat?: any; repeatText?: string; fileIds?: string[] };
export type Dose = { medicationId: string; name: string; dose: string; instructions: string; time: string; status: 'taken' | 'due' | 'missed' | 'later'; takenAt: string; recordedBy: string };
export type Doc = { id: string; title: string; category: string; fileId: string; shareWithHelper: boolean; uploadedBy: string; uploadedAt: string };
export type Renewal = { id: string; title: string; dueDate: string; notes: string; doneAt: string; fileIds?: string[] };
export type Checkin = { id: string; recordedBy: string; kind: 'ok' | 'help'; createdAt: string; resolvedAt?: string; resolvedBy?: string };
export type NotificationAction = { id: string; label: string };
export type Notice = { id: string; circleId: string; circleName: string; category: string; priority: 'urgent' | 'important' | 'normal'; title: string; body: string; tab: string; itemId: string; actions: NotificationAction[]; createdAt: string; readAt: string; digest: boolean };
export type Inbox = { unread: number; urgentUnread: number; items: Notice[] };
export type NotifyMode = 'push' | 'inbox' | 'digest' | 'off';
export type Prefs = { categories: Record<string, NotifyMode>; quietStart: string; quietEnd: string; digestTime: string; catalogue: Record<string, { label: string; help: string; locked?: boolean }>; modes: NotifyMode[]; devices: number;
  email: { address: string; on: boolean; categories: string[] }; emailSetup: 'acs' | 'smtp' | 'none';
  whatsapp: { number: string; on: boolean; categories: string[] }; whatsappSetup: 'acs' | 'meta' | 'none' };
export type Alert = { kind: string; level: 'urgent' | 'high' | 'info'; text: string; tab: string; checkinId?: string };
export type Activity = { id: string; userId: string; text: string; createdAt: string; unread: boolean };
export type Invite = { code: string; role: Role; createdBy: string; expiresAt: string };
export type Circle = { id: string; name: string; parentName: string; parentPhone: string; checkinBy: string; emergencyContacts: { name: string; phone: string; relation: string }[]; profile?: CareProfile };
export type Can = Record<
  'seeMoney' | 'editMoney' | 'editAppointments' | 'addTasks' | 'editMedications' | 'logDoses' | 'seeAllDocuments' | 'editDocuments' | 'editRenewals' | 'seeRenewals' | 'invite' | 'manageMembers' | 'editCircle' | 'checkIn' | 'postNotes' | 'seePayNow' | 'seeVisits' | 'editVisits',
  boolean
>;
export type VisitType = 'doctor' | 'dentist' | 'physio' | 'therapy' | 'specialist' | 'other';
export type Visit = {
  id: string; type: VisitType; provider: string; date: string; time: string; appointmentId: string;
  summary: string; instructions: string; medChanges: string; followUpDate: string; fileIds: string[];
  files: { id: string; name: string; type: string }[]; comments: Comment[]; createdBy: string; createdAt: string; updatedAt: string;
};
export type CareFor = 'elder' | 'baby' | 'kid' | 'teen';
export type CareProfile = { careFor: CareFor; stage: string; living: string; needs: string[]; relation: string; count?: number };
export type Macros = { kcal: number; protein: number; fat: number; carbs: number };
export type Formula = { id: string; brand: string; product: string; stage: number; stageLabel: string; type: string; per100ml: Macros; typical: boolean };
export type BabyLog = { id: string; babyId: string; kind: 'bottle' | 'breast' | 'pump' | 'solids' | 'sleep' | 'diaper' | 'weight' | 'height' | 'head'; at: string; by: string; note: string;
  ml?: number; source?: 'formula' | 'breastmilk'; formula?: string; per100ml?: Macros; milkId?: string; foodId?: string; grams?: number; macros?: Macros; side?: string; minutes?: number; food?: string; amount?: string; endAt?: string; diaper?: string; kg?: number; cm?: number };
export type BabyFormula = { id: string; name: string; brand: string; stageLabel: string; per100ml: Macros; typical: boolean };
export type Targets = { kcal: number | null; protein: number | null; fat: number | null; carbs: number | null; ml: number | null };
export type FoodItem = { id: string; kind: 'milk' | 'food'; unit: 'ml' | 'g'; name: string; brand?: string; group: string; per100: Macros; typical?: boolean; preset?: boolean; custom?: boolean };
export type Baby = { id: string; name: string; sex: string; birthDate: string; formulaId: string; per100ml: Macros | null; customName: string; color: string; formula: BabyFormula | null; targets: Targets | null };
export type BabyData = { babies: Baby[]; feedEvery: number; breastMilk: Macros; logs: BabyLog[]; myFoods: FoodItem[]; presetFoods: FoodItem[] };
export type CarePlan = { profile: CareProfile; checkinBy: string; feedEvery?: number; tasks: { key: string; title: string; category: string; days: number }[]; focus: { title: string; tips: string[] }; quietNags: boolean };
export type ProfileOption = { id: string; label: string; icon: string; desc?: string };
export type ProfileLists = { stages: ProfileOption[]; living: ProfileOption[]; needs: ProfileOption[] };
export type CircleData = {
  circle: Circle; role: Role; can: Can;
  me: { userId: string; name: string; paynow: string; email?: string; account?: boolean };
  members: Member[]; appointments: Appointment[]; tasks: Task[]; notes: Note[];
  medications: Medication[]; dosesToday: Dose[];
  lastCheckin: Checkin | null; openHelp: Checkin[]; alerts: Alert[]; activity: Activity[]; unreadCount: number;
  documents: Doc[]; visits: Visit[]; carePlan: CarePlan | null; baby: BabyData | null; expenses?: Expense[]; balances?: Transfer[]; renewals?: Renewal[]; invites?: Invite[];
};
export type Session = {
  user: { id: string; name: string; username: string; email?: string; account?: boolean; paynow: string; source: string; testingAs: string };
  microsoft: boolean;
  circles: { id: string; name: string; role: Role; careFor?: CareFor; parentName?: string }[];
  testMode: boolean;
  mode?: 'live' | 'test';
  demoUsers: { id: string; label: string }[];
};
export type Statement = {
  month: string; total: number;
  people: { userId: string; name: string; paid: number; share: number; difference: number }[];
  byCategory: { category: string; amount: number }[];
  expenses: Expense[];
};

// ---------- per-window sign-in ----------
// Each browser window (tab) remembers who is signed in there, so two windows can be two different
// people (for trying co-working). The token rides on every request to /api as a header, and on
// picture/stream links as ?t=. Without one, the browser-wide cookie is used.
const TOKEN_KEY = 'famhub-session';
export function getWindowToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
export function setWindowToken(t: string) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } }
export function authUrl(u: string) {
  const t = getWindowToken();
  return t ? `${u}${u.includes('?') ? '&' : '?'}t=${encodeURIComponent(t)}` : u;
}
if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !(window as any).__famhubFetch) {
  const orig = window.fetch.bind(window);
  (window as any).__famhubFetch = true;
  window.fetch = (input: any, init: any = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const t = getWindowToken();
    if (t && (url.startsWith('/api') || url.startsWith(`${window.location.origin}/api`))) {
      const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
      if (!headers.has('x-famhub-session')) headers.set('x-famhub-session', t);
      init = { ...init, headers };
    }
    return orig(input, init);
  };
}

// Must match the server version (server/server.js /api/health).
export const APP_VERSION = '4.5';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method, credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; throw e; }
  return data as T;
}

const c = (id: string, rest = '') => `/api/circles/${id}${rest}`;

export const api = {
  session: () => call<Session>('GET', '/api/session'),
  authOptions: () => call<AuthOptions>('GET', '/api/auth/options'),
  login: async (username: string, password: string) => { const r = await call<{ ok: boolean; name: string; token: string }>('POST', '/api/auth/login', { username, password }); setWindowToken(r.token); return r; },
  register: async (body: { name: string; username?: string; password: string; email?: string }) => { const r = await call<{ ok: boolean; name: string; username: string; token: string }>('POST', '/api/auth/register', body); setWindowToken(r.token); return r; },
  forgotPassword: (email: string) => call('POST', '/api/auth/forgot', { email }),
  resetPassword: async (token: string, password: string) => { const r = await call<{ ok: boolean; token: string }>('POST', '/api/auth/reset', { token, password }); setWindowToken(r.token); return r; },
  changePassword: (current: string, password: string) => call('POST', '/api/me/password', { current, password }),
  people: (id: string) => call<{ people: PersonStatus[]; at: string }>('GET', c(id, '/people')),
  resetLink: (id: string, userId: string) => call<{ link: string; name: string; expiresIn: string }>('POST', c(id, `/members/${userId}/reset-link`), {}),
  continueMicrosoft: async () => { const r = await call<{ ok: boolean; token: string }>('POST', '/api/auth/microsoft', {}); setWindowToken(r.token); return r; },
  logout: (everywhere = false) => call<{ ok: boolean; microsoftLogout: boolean }>('POST', '/api/auth/logout', { everywhere }),
  testAs: async (userId: string) => { const r = await call<{ ok: boolean; token: string }>('POST', '/api/test/user', { userId }); setWindowToken(r.token); return r; },
  testReset: () => call('POST', '/api/test/reset', {}),
  profiles: () => call<Profiles>('GET', '/api/test/profiles'),
  addProfile: (body: { name: string; circleId?: string; role?: string; username?: string; password?: string }) => call<Profiles & { id: string }>('POST', '/api/test/profiles', body),
  editProfile: (id: string, body: { name?: string; circleId?: string; role?: string; username?: string; password?: string; resetPassword?: boolean }) => call<Profiles>('PATCH', `/api/test/profiles/${id}`, body),
  removeProfile: (id: string) => call<Profiles>('DELETE', `/api/test/profiles/${id}`),
  updateMe: (body: { name?: string; paynow?: string }) => call('PATCH', '/api/me', body),
  createCircle: (body: { name?: string; parentName?: string; withDemoData?: boolean; profile?: Partial<CareProfile>; tasks?: string[]; checkinBy?: string; birthDate?: string; sex?: string; formulaId?: string; babies?: { name: string; sex: string }[] }) => call<{ id: string }>('POST', '/api/circles', body),
  acceptInvite: (code: string) => call<{ circleId: string }>('POST', '/api/invites/accept', { code }),

  circle: (id: string) => call<CircleData>('GET', c(id)),
  updateCircle: (id: string, body: Partial<Circle>) => call('PATCH', c(id), body),
  seen: (id: string) => call('POST', c(id, '/seen'), {}),
  createInvite: (id: string, role: Role) => call<Invite>('POST', c(id, '/invites'), { role }),
  deleteInvite: (id: string, code: string) => call('DELETE', c(id, `/invites/${code}`)),
  addPerson: (id: string, body: { name: string; role: Role }) => call('POST', c(id, '/people'), body),
  setRole: (id: string, userId: string, role: Role) => call('PATCH', c(id, `/members/${encodeURIComponent(userId)}`), { role }),
  removeMember: (id: string, userId: string) => call('DELETE', c(id, `/members/${encodeURIComponent(userId)}`)),

  addAppointment: (id: string, body: Partial<Appointment>) => call('POST', c(id, '/appointments'), body),
  updateAppointment: (id: string, aid: string, body: Partial<Appointment> & { series?: string }) => call('PATCH', c(id, `/appointments/${aid}`), body),
  deleteAppointment: (id: string, aid: string, series: '' | 'later' | 'all' = '') => call('DELETE', c(id, `/appointments/${aid}${series ? `?series=${series}` : ''}`)),

  addTask: (id: string, body: Partial<Task>) => call('POST', c(id, '/tasks'), body),
  taskAction: (id: string, tid: string, action: string, extra: Record<string, unknown> = {}) => call('PATCH', c(id, `/tasks/${tid}`), { action, ...extra }),
  deleteRepeats: (id: string, kind: 'task' | 'appointment', ids: string[]) => call<{ deleted: number }>('POST', c(id, '/series/delete'), { kind, ids }),
  deleteTask: (id: string, tid: string, series: '' | 'later' | 'all' = '') => call('DELETE', c(id, `/tasks/${tid}${series ? `?series=${series}` : ''}`)),

  addNote: (id: string, body: { text: string; fileId?: string; fileIds?: string[]; urgent?: boolean }) => call('POST', c(id, '/notes'), body),
  deleteNote: (id: string, nid: string) => call('DELETE', c(id, `/notes/${nid}`)),

  addExpense: (id: string, body: Record<string, unknown>) => call('POST', c(id, '/expenses'), body),
  deleteExpense: (id: string, eid: string) => call('DELETE', c(id, `/expenses/${eid}`)),
  settle: (id: string, t: Transfer) => call('POST', c(id, '/settlements'), { fromUserId: t.fromUserId, toUserId: t.toUserId, amount: t.amount }),
  statement: (id: string, month: string) => call<Statement>('GET', c(id, `/statement?month=${month}`)),
  statementCsvUrl: (id: string, month: string) => authUrl(c(id, `/statement?month=${month}&format=csv`)),
  payNowQrUrl: (id: string, to: string, amount: number) => authUrl(c(id, `/paynow-qr?to=${encodeURIComponent(to)}&amount=${amount.toFixed(2)}`)),

  upload: async (id: string, original: File) => {
    const file = await shrinkPhoto(original);
    const res = await fetch(c(id, '/files'), { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data as { id: string; name: string; type: string };
  },
  fileUrl: (fileId: string) => authUrl(`/api/files/${fileId}`),
  profileCatalogue: () => call<{ stages: ProfileOption[]; living: ProfileOption[]; needs: ProfileOption[]; baby: ProfileLists; kid: ProfileLists; teen: ProfileLists }>('GET', '/api/profile/catalogue'),
  formulas: () => call<{ formulas: Formula[]; breastMilk: Macros }>('GET', '/api/formulas'),
  updateBaby: (id: string, body: Record<string, unknown>) => call('PATCH', c(id, '/baby'), body),
  addBabyLog: (id: string, body: Record<string, unknown>) => call<BabyLog>('POST', c(id, '/baby/logs'), body),
  updateBabyLog: (id: string, lid: string, body: Record<string, unknown>) => call('PATCH', c(id, `/baby/logs/${lid}`), body),
  deleteBabyLog: (id: string, lid: string) => call('DELETE', c(id, `/baby/logs/${lid}`)),
  addBaby: (id: string, body: { name: string; sex?: string; birthDate?: string }) => call<Baby>('POST', c(id, '/baby/babies'), body),
  removeBaby: (id: string, babyId: string) => call('DELETE', c(id, `/baby/babies/${babyId}`)),
  addFood: (id: string, body: Record<string, unknown>) => call<FoodItem>('POST', c(id, '/baby/foods'), body),
  updateFood: (id: string, fid: string, body: Record<string, unknown>) => call<FoodItem>('PATCH', c(id, `/baby/foods/${encodeURIComponent(fid)}`), body),
  deleteFood: (id: string, fid: string) => call('DELETE', c(id, `/baby/foods/${encodeURIComponent(fid)}`)),
  profilePlan: (profile: Partial<CareProfile>) => call<CarePlan>('POST', '/api/profile/plan', { profile }),
  setProfile: (id: string, body: { profile: Partial<CareProfile>; checkinBy?: string; tasks?: string[] }) => call('POST', c(id, '/profile'), body),
  addVisit: (id: string, body: Record<string, unknown>) => call<Visit>('POST', c(id, '/visits'), body),
  updateVisit: (id: string, vid: string, body: Record<string, unknown>) => call<Visit>('PATCH', c(id, `/visits/${vid}`), body),
  deleteVisit: (id: string, vid: string) => call('DELETE', c(id, `/visits/${vid}`)),
  commentVisit: (id: string, vid: string, text: string) => call('POST', c(id, `/visits/${vid}/comments`), { text }),
  addDocument: (id: string, body: { title: string; category: string; fileId: string; shareWithHelper: boolean }) => call('POST', c(id, '/documents'), body),
  updateDocument: (id: string, did: string, body: Partial<Doc>) => call('PATCH', c(id, `/documents/${did}`), body),
  deleteDocument: (id: string, did: string) => call('DELETE', c(id, `/documents/${did}`)),

  addMedication: (id: string, body: Record<string, unknown>) => call('POST', c(id, '/medications'), body),
  updateMedication: (id: string, mid: string, body: Record<string, unknown>) => call('PATCH', c(id, `/medications/${mid}`), body),
  deleteMedication: (id: string, mid: string) => call('DELETE', c(id, `/medications/${mid}`)),
  logDose: (id: string, medicationId: string, time: string, taken: boolean) => call('POST', c(id, '/doses'), { medicationId, time, taken }),

  addRenewal: (id: string, body: { title: string; dueDate: string; notes: string }) => call('POST', c(id, '/renewals'), body),
  updateRenewal: (id: string, rid: string, body: Record<string, unknown>) => call('PATCH', c(id, `/renewals/${rid}`), body),
  deleteRenewal: (id: string, rid: string) => call('DELETE', c(id, `/renewals/${rid}`)),

  checkin: (id: string, kind: 'ok' | 'help') => call('POST', c(id, '/checkins'), { kind }),
  react: (id: string, nid: string) => call('POST', c(id, `/notes/${nid}/react`), {}),
  comment: (id: string, nid: string, text: string) => call('POST', c(id, `/notes/${nid}/comments`), { text }),

  inbox: () => call<Inbox>('GET', '/api/notifications'),
  markRead: (ids?: string[]) => call('POST', '/api/notifications/read', ids ? { ids } : {}),
  prefs: () => call<Prefs>('GET', '/api/prefs'),
  savePrefs: (body: Partial<Prefs>) => call<Prefs>('PUT', '/api/prefs', body),
  emailTest: (address: string) => call<{ status: string; error: string; to: string }>('POST', '/api/email/test', { address }),
  whatsappTest: (number: string) => call<{ status: string; error: string; to: string }>('POST', '/api/whatsapp/test', { number }),
  outbox: () => call<{ email: string; whatsapp: string; messages: { channel: 'email' | 'whatsapp'; id: string; to: string; subject: string; at: string; status: string; via: string; error: string }[] }>('GET', '/api/test/outbox'),
  pushKey: () => call<{ publicKey: string }>('GET', '/api/push/key'),
  pushSubscribe: (subscription: unknown, device: string) => call('POST', '/api/push/subscribe', { subscription, device }),
  pushUnsubscribe: (endpoint: string) => call('POST', '/api/push/unsubscribe', { endpoint }),
  pushTest: () => call<{ devices: number }>('POST', '/api/push/test', {}),
  runChecks: () => call('POST', '/api/test/run-checks', {}),
  resolveHelp: (id: string, cid: string) => call('POST', c(id, `/checkins/${cid}/resolve`), {}),
  cancelHelp: (id: string, cid: string) => call('POST', c(id, `/checkins/${cid}/cancel`), {}),
};

// Formatting in Singapore time.
const TZ = 'Asia/Singapore';
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-SG', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const fmtDate = (ymd: string) => (ymd ? new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString('en-SG', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-SG', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const fmtAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return fmtDateTime(iso);
};
export const sgd = (n: number) => `S$${n.toFixed(2)}`;
export const todaySG = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
export const toLocalInput = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16);
export const daysUntil = (ymd: string) => Math.round((new Date(`${ymd}T12:00:00+08:00`).getTime() - Date.now()) / 86400000);
export const slotOf = (hm: string) => (hm < '12:00' ? 'Morning' : hm < '17:00' ? 'Afternoon' : hm < '21:00' ? 'Evening' : 'Night');
export const roleLabel: Record<Role, string> = { owner: 'Owner', family: 'Family', helper: 'Helper', parent: 'Parent' };

// Photos attached to an update (older updates have a single fileId).
export const photosOf = (n: Note) => (n.fileIds && n.fileIds.length ? n.fileIds : n.fileId ? [n.fileId] : []);

// Phone cameras make large files. Resize photos to at most 1600 px and save as JPEG
// before uploading, so they upload quickly and stay under the 8 MB limit.
// If the browser cannot read the photo (for example HEIC on some PCs), the original is sent.
export async function shrinkPhoto(file: File): Promise<File> {
  if (typeof document === 'undefined' || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new window.Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    URL.revokeObjectURL(url);
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 1.5e6 && file.type !== 'image/heic' && file.type !== 'image/heif') return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export type TestProfile = { id: string; name: string; username: string; customPassword: boolean; builtIn: boolean; label: string; memberships: { circleId: string; role: Role }[]; unread: number; urgent: boolean };
export type Profiles = { profiles: TestProfile[]; circles: { id: string; name: string; parentName: string }[] };

export type PersonStatus = { userId: string; name: string; role: Role; online: boolean; where: string; doing: string; elsewhere: boolean; lastSeenAt: string; joinedAt: string; account: boolean };
export type AuthOptions = { testMode: boolean; mode?: 'live' | 'test'; emailReset?: boolean; signedIn: boolean; microsoft: { name: string; email: string } | null; accounts: { username: string; name: string; label: string }[] };

// Signs out and reloads the app, which then shows the sign-in page.
// Without test mode, Microsoft sign-in is also ended.
export function signOut(everywhere = false) {
  // Forget this window's sign-in, then a normal page load: the server clears the cookie and shows the sign-in page.
  setWindowToken('');
  window.location.assign(`/api/auth/logout${everywhere ? '?everywhere=1' : ''}`);
}

// A task can be ticked Done only from its date and time (00:00 if no time is set).
export const taskOpensAt = (t: Task) => (t.dueDate ? new Date(`${t.dueDate}T${t.dueTime || '00:00'}:00+08:00`).getTime() : 0);
export const taskLocked = (t: Task) => t.status !== 'done' && !!t.dueDate && Date.now() < taskOpensAt(t);
export const taskWhen = (t: Task) => (t.dueDate ? `${fmtDate(t.dueDate)}${t.dueTime ? ` ${t.dueTime}` : ''}` : '');
