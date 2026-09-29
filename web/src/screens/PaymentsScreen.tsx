import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Text, View } from 'react-native';
import DatePicker from '../DatePicker';
import { api, fmtDate, Payment, PayKind, PayMethod, PaymentsView, PayPlan, sgd, todaySG } from '../api';
import { colors } from '../theme';
import { Avatar, Badge, Button, Card, Choice, Empty, ErrorText, Field, Icon, Muted, Overline, Row, Segmented, Sheet, Title, Toggle } from '../ui';
import { ScreenProps } from './shared';

// Payments with PayNow or PayLah! (4.8). Famhub never holds money: it shows the PayNow QR code of the person
// being paid (PayLah! and every Singapore banking app can scan it) and keeps a record of who paid whom.

const SUBS: Record<PayKind, { value: string; label: string }[]> = {
  request: [{ value: 'reimburse', label: 'Pay me back' }, { value: 'pocket', label: 'Pocket money' }, { value: 'share', label: 'Share of a cost' }, { value: 'other', label: 'Other' }],
  helper: [{ value: 'salary', label: 'Salary' }, { value: 'topup', label: 'Top-up' }, { value: 'reimburse', label: 'Reimbursement' }, { value: 'bonus', label: 'Bonus' }, { value: 'other', label: 'Other' }],
  allowance: [{ value: 'monthly', label: 'Monthly allowance' }, { value: 'pocket', label: 'Pocket money' }, { value: 'transport', label: 'Transport' }, { value: 'school', label: 'School' }, { value: 'other', label: 'Other' }],
};
const KIND_TITLE: Record<PayKind, string> = { request: 'Request money', helper: 'Pay the helper', allowance: 'Give an allowance' };
const METHOD: Record<PayMethod, string> = { paynow: 'PayNow', paylah: 'PayLah!', bank: 'Bank transfer', cash: 'Cash' };
const STATUS: Record<string, { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }> = {
  due: { label: 'Waiting for payment', tone: 'warn' }, paid: { label: 'Paid, waiting for "Got it"', tone: 'info' },
  received: { label: 'Received', tone: 'good' }, declined: { label: 'Declined', tone: 'bad' }, cancelled: { label: 'Cancelled', tone: 'neutral' },
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const copy = (t: string) => { try { navigator.clipboard?.writeText(t); } catch { /* not allowed */ } };

function Copyable({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
        <Text selectable style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{value}</Text>
      </View>
      <Button small kind="ghost" icon={done ? 'checkmark' : 'copy-outline'} label={done ? 'Copied' : 'Copy'} onPress={() => { copy(value); setDone(true); setTimeout(() => setDone(false), 1500); }} />
    </Row>
  );
}

// The "Pay" sheet: QR code, the details to type into PayLah! or a bank app, then "I have paid".
function PaySheet({ cid, p, onClose, onDone }: { cid: string; p: Payment; onClose: () => void; onDone: () => Promise<void> }) {
  const [det, setDet] = useState<{ mobile: string; name: string; amount: number; ref: string } | null>(null);
  const [method, setMethod] = useState<PayMethod>('paynow');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.paymentDetails(cid, p.id).then(setDet).catch((e) => setError(e.message)); }, [cid, p.id]);
  const phone = det?.mobile ? det.mobile.replace(/^\+65/, '').replace(/(\d{4})(\d{4})/, '$1 $2') : '';
  async function paid() {
    setBusy(true); setError(null);
    try { await api.paymentAction(cid, p.id, 'paid', { method }); await onDone(); onClose(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet visible title={`Pay ${p.toName} ${sgd(p.amount)}`} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Muted>{p.label}</Muted>
        {p.toHasPayNow ? (
          <>
            <View style={{ alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <View style={{ backgroundColor: '#7C1A78', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>PayNow</Text></View>
                <View style={{ backgroundColor: '#E2231A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>PayLah!</Text></View>
              </View>
              <Image source={{ uri: api.paymentQrUrl(cid, p.id) }} style={{ width: 240, height: 240 }} accessibilityLabel={`PayNow QR code to pay ${p.toName} ${sgd(p.amount)}`} />
              <Text style={{ color: '#101828', fontWeight: '800' }}>{p.toName} · {sgd(p.amount)}</Text>
            </View>
            <Button kind="secondary" icon="download-outline" label="Save QR image to scan from your phone" onPress={() => Linking.openURL(api.paymentQrUrl(cid, p.id, true))} />
            <Card style={{ gap: 4, backgroundColor: colors.surfaceAlt }}>
              <Overline>How to pay</Overline>
              <Muted>PayLah!: tap Scan, then scan this code (or choose the saved image from your gallery). Check the name and amount, then pay.</Muted>
              <Muted>Bank app (DBS, OCBC, UOB and others): choose PayNow, Scan QR, and scan this code or the saved image.</Muted>
              <Muted>On the same phone? Copy the mobile number below and use "Pay to mobile" in PayLah! or your bank app.</Muted>
            </Card>
            {det && (
              <View>
                <Copyable label="PayNow / PayLah! mobile" value={phone} />
                <Copyable label="Amount (S$)" value={det.amount.toFixed(2)} />
                <Copyable label="Reference" value={det.ref} />
              </View>
            )}
          </>
        ) : (
          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <Muted>{p.toName} has not saved a PayNow mobile yet, so there is no QR code. Ask them to add it (More, My profile{p.toId === 'person' ? ', or Payments for the owner' : ''}), or pay by bank transfer or cash and record it below.</Muted>
          </Card>
        )}
        <Choice label="How did you pay?" value={method} onChange={setMethod} options={(Object.keys(METHOD) as PayMethod[]).map((k) => ({ value: k, label: METHOD[k] }))} />
        <ErrorText message={error} />
        <Button icon="checkmark-circle-outline" label={busy ? 'Saving...' : 'I have paid'} onPress={paid} disabled={busy} />
        <Muted>{p.toName} gets a message and taps "Got it" when the money arrives.</Muted>
      </View>
    </Sheet>
  );
}

function PayCard({ cid, p, meId, onPay, reload }: { cid: string; p: Payment; meId: string; onPay: (p: Payment) => void; reload: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const act = async (a: 'received' | 'decline' | 'cancel' | 'remind') => {
    setError(null); setNote(null);
    try { await api.paymentAction(cid, p.id, a); if (a === 'remind') setNote(`Reminder sent to ${p.fromName}.`); await reload(); } catch (e: any) { setError(e.message); }
  };
  const st = STATUS[p.status];
  const overdue = p.status === 'due' && p.dueOn < todaySG();
  const toMe = p.toId === meId;
  return (
    <Card style={{ gap: 8 }}>
      <Row style={{ flexWrap: 'nowrap', gap: 10 }}>
        <Avatar id={p.fromId} name={p.fromName} size={34} />
        <Icon name="arrow-forward" size={18} color={colors.faint} />
        <Avatar id={p.toId === 'person' ? `person-${cid}` : p.toId} name={p.toName} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }} numberOfLines={1}>{p.fromId === meId ? 'You' : p.fromName} → {toMe ? 'you' : p.toName}</Text>
          <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={2}>{p.label}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>{sgd(p.amount)}</Text>
      </Row>
      <Row>
        <Badge label={overdue ? 'Overdue' : st.label} tone={overdue ? 'bad' : st.tone} />
        <Muted>{p.status === 'due' ? `Due ${fmtDate(p.dueOn)}` : p.status === 'declined' ? `Declined${p.declineNote ? `: ${p.declineNote}` : ''}` : p.paidAt ? `${METHOD[p.method as PayMethod] || ''} · ${fmtDate(p.paidAt.slice(0, 10))}` : fmtDate(p.dueOn)}</Muted>
        {!!p.planId && <Badge label="Repeats" tone="info" />}
        {p.addToCosts && <Badge label="In shared costs" tone="neutral" />}
      </Row>
      {(p.canPay || p.canConfirm || p.canDecline || p.canCancel || p.canRemind) && (
        <Row>
          {p.canPay && <Button small icon="qr-code-outline" label="Pay with PayNow or PayLah!" onPress={() => onPay(p)} />}
          {p.canConfirm && <Button small icon="checkmark-done-outline" label="Got it" onPress={() => act('received')} />}
          {p.canRemind && <Button small kind="secondary" icon="notifications-outline" label="Remind" onPress={() => act('remind')} />}
          {p.canDecline && <Button small kind="ghost" label="Decline" onPress={() => act('decline')} />}
          {p.canCancel && <Button small kind="ghost" label="Cancel" onPress={() => act('cancel')} />}
        </Row>
      )}
      {!!note && <Muted>{note}</Muted>}
      <ErrorText message={error} />
    </Card>
  );
}

function NewPayment({ cid, kind, v, data, onClose, onDone }: { cid: string; kind: PayKind; v: PaymentsView; data: ScreenProps['data']; onClose: () => void; onDone: () => Promise<void> }) {
  const meId = data.me.userId;
  const careFor = data.circle.profile?.careFor || 'elder';
  const family = v.members.filter((m) => m.role === 'owner' || m.role === 'family');
  const helpers = v.members.filter((m) => m.role === 'helper');
  const personOpt = { value: 'person', label: `${v.person.name}${v.person.hasPayNow ? '' : ' (no PayNow yet)'}` };
  const parentMembers = v.members.filter((m) => m.role === 'parent');
  const allowanceTo = parentMembers.length ? parentMembers.map((m) => ({ value: m.id, label: `${m.name}${m.hasPayNow ? '' : ' (no PayNow yet)'}` })) : [personOpt];
  const defaultAllowanceTo = allowanceTo[0].value;
  const canForPerson = ['owner', 'family', 'parent'].includes(data.role);
  const askable = v.members.filter((m) => m.id !== meId && !m.placeholder);
  const [fromId, setFromId] = useState(kind === 'request' ? (askable.find((m) => m.role === 'owner') || askable[0])?.id || '' : family.some((m) => m.id === meId) ? meId : family[0]?.id || '');
  const [toId, setToId] = useState(kind === 'helper' ? helpers[0]?.id || '' : kind === 'allowance' ? defaultAllowanceTo : meId);
  const [sub, setSub] = useState(kind === 'helper' ? 'salary' : kind === 'allowance' ? (careFor === 'elder' ? 'monthly' : 'pocket') : data.role === 'helper' ? 'reimburse' : careFor === 'kid' || careFor === 'teen' ? 'pocket' : 'reimburse');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [dueOn, setDueOn] = useState(todaySG());
  const [every, setEvery] = useState<'none' | 'week' | 'month'>(kind === 'helper' ? 'month' : kind === 'allowance' ? (careFor === 'elder' ? 'month' : 'week') : 'none');
  const [addToCosts, setAddToCosts] = useState(kind === 'helper');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wd = new Date(`${dueOn}T12:00:00Z`).getUTCDay();
  const md = Number(dueOn.slice(8, 10));
  async function save() {
    setBusy(true); setError(null);
    try {
      await api.addPayment(cid, { kind, sub, fromId, toId, amount: Number(amount), reason, dueOn, addToCosts, repeat: kind !== 'request' && every !== 'none' ? { every, day: every === 'week' ? wd : md } : null });
      await onDone(); onClose();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet visible title={KIND_TITLE[kind]} onClose={onClose}>
      <View style={{ gap: 12 }}>
        {kind === 'request' && (
          <>
            <Choice label="Ask who to pay?" value={fromId} onChange={setFromId} options={askable.map((m) => ({ value: m.id, label: m.name }))} />
            {canForPerson && <Choice label="Money goes to" value={toId} onChange={setToId} options={[{ value: meId, label: 'Me' }, personOpt]} />}
          </>
        )}
        {kind === 'helper' && (helpers.length
          ? <Choice label="Helper" value={toId} onChange={setToId} options={helpers.map((m) => ({ value: m.id, label: `${m.name}${m.hasPayNow ? '' : ' (no PayNow yet)'}` }))} />
          : <Muted>There is no helper in this circle yet. Invite the helper or nanny first (More, Circle and people).</Muted>)}
        {kind === 'allowance' && <Choice label="Allowance for" value={toId} onChange={setToId} options={allowanceTo} />}
        {kind !== 'request' && <Choice label="Paid by" value={fromId} onChange={setFromId} options={family.map((m) => ({ value: m.id, label: m.id === meId ? `${m.name} (me)` : m.name }))} />}
        <Choice label="What for" value={sub} onChange={setSub} options={SUBS[kind]} />
        <Field label="Amount (S$)" value={amount} onChange={setAmount} placeholder={kind === 'helper' ? '750' : '20'} keyboard="decimal-pad" />
        <Field label="Note (optional)" value={reason} onChange={setReason} placeholder={kind === 'request' ? 'Grab to the clinic' : kind === 'helper' ? 'October salary' : 'Weekly pocket money'} />
        <DatePicker label={every === 'none' ? 'Pay by' : 'First payment'} value={dueOn} onChange={setDueOn} />
        {kind !== 'request' && (
          <>
            <View style={{ gap: 6 }}>
              <Overline>Repeat</Overline>
              <Segmented value={every} onChange={setEvery} options={[{ value: 'none', label: 'Once' }, { value: 'week', label: 'Every week' }, { value: 'month', label: 'Every month' }]} />
              {every !== 'none' && <Muted>{every === 'week' ? `Every ${DAYS[wd]}` : `On day ${md} of every month${md > 28 ? ' (the last day in shorter months)' : ''}`}. Famhub reminds {family.find((m) => m.id === fromId)?.name || 'the payer'} on the day with the QR code ready.</Muted>}
            </View>
            <Toggle label="Also add to shared costs" value={addToCosts} onChange={setAddToCosts} help="When paid, it is added to Costs and split equally among the family." />
          </>
        )}
        <ErrorText message={error} />
        <Button label={busy ? 'Saving...' : kind === 'request' ? 'Send request' : every === 'none' ? 'Save payment' : 'Save repeating payment'} onPress={save} disabled={busy || (kind === 'helper' && !helpers.length)} />
      </View>
    </Sheet>
  );
}

function PlanRow({ cid, plan, reload }: { cid: string; plan: PayPlan; reload: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const run = async (f: () => Promise<unknown>) => { setError(null); try { await f(); await reload(); } catch (e: any) { setError(e.message); } };
  return (
    <View style={{ gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: colors.text }}>{plan.label}: {sgd(plan.amount)}</Text>
          <Muted>{plan.fromName} → {plan.toName} · {plan.every === 'week' ? `every ${DAYS[plan.day]}` : `day ${plan.day} of each month`}{plan.active && plan.next ? ` · next ${fmtDate(plan.next)}` : ''}</Muted>
        </View>
        <Badge label={plan.active ? 'On' : 'Paused'} tone={plan.active ? 'good' : 'neutral'} />
      </Row>
      <Row>
        <Button small kind="secondary" label={plan.active ? 'Pause' : 'Resume'} onPress={() => run(() => api.updatePlan(cid, plan.id, { active: !plan.active }))} />
        <Button small kind="ghost" label="Stop and delete" onPress={() => run(() => api.deletePlan(cid, plan.id))} />
      </Row>
      <ErrorText message={error} />
    </View>
  );
}

function PayNowSetup({ cid, v, data, refresh, reload }: { cid: string; v: PaymentsView; data: ScreenProps['data']; refresh: () => Promise<void>; reload: () => Promise<void> }) {
  const [mine, setMine] = useState(data.me.paynow ? data.me.paynow.replace(/^\+65/, '') : '');
  const [person, setPerson] = useState(v.person.paynow ? v.person.paynow.replace(/^\+65/, '') : '');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canPerson = ['owner', 'family', 'parent'].includes(data.role);
  const save = async (f: () => Promise<unknown>) => { setError(null); setMsg(null); try { await f(); await refresh(); await reload(); setMsg('Saved.'); } catch (e: any) { setError(e.message); } };
  return (
    <Card style={{ gap: 10 }}>
      <Title>PayNow and PayLah! numbers</Title>
      <Muted>PayLah! uses PayNow, so one mobile number works for both. It must be registered for PayNow with your bank or in PayLah!.</Muted>
      <Row style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}><Field label="My PayNow / PayLah! mobile" value={mine} onChange={setMine} placeholder="9123 4567" keyboard="phone-pad" /></View>
        <Button small label="Save" onPress={() => save(() => api.updateMe({ paynow: mine }))} />
      </Row>
      {canPerson && (
        <Row style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
          <View style={{ flex: 1 }}><Field label={`${v.person.name}'s PayNow / PayLah! mobile (for allowances)`} value={person} onChange={setPerson} placeholder="Optional" keyboard="phone-pad" /></View>
          <Button small label="Save" onPress={() => save(() => api.setPersonPayNow(cid, person))} />
        </Row>
      )}
      {!!msg && <Muted>{msg}</Muted>}
      <ErrorText message={error} />
    </Card>
  );
}

export default function PaymentsScreen({ data, cid, refresh }: ScreenProps) {
  const [v, setV] = useState<PaymentsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Payment | null>(null);
  const [making, setMaking] = useState<PayKind | null>(null);
  const [show, setShow] = useState<'open' | 'history'>('open');
  const reload = useCallback(async () => { try { setV(await api.payments(cid)); setError(null); } catch (e: any) { setError(e.message); } }, [cid]);
  useEffect(() => { reload(); }, [reload, data]);
  const both = async () => { await reload(); await refresh(); };
  const meId = data.me.userId;
  const family = data.can.editMoney;
  if (!v) return <View style={{ gap: 12 }}><ErrorText message={error} />{!error && <Muted>Loading payments...</Muted>}</View>;

  const open = v.payments.filter((p) => p.status === 'due' || p.status === 'paid');
  const history = v.payments.filter((p) => !(p.status === 'due' || p.status === 'paid'));
  const mineToPay = open.filter((p) => p.status === 'due' && p.fromId === meId);
  const toConfirm = open.filter((p) => p.canConfirm);
  const others = open.filter((p) => !mineToPay.includes(p) && !toConfirm.includes(p));
  const noPayNow = !data.me.paynow;

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Overline>You need to pay</Overline>
            <Text style={{ fontSize: 26, fontWeight: '900', color: v.totals.toPay ? colors.danger : colors.text }}>{sgd(v.totals.toPay)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Overline>Coming to you</Overline>
            <Text style={{ fontSize: 26, fontWeight: '900', color: v.totals.toReceive ? colors.ok : colors.text }}>{sgd(v.totals.toReceive)}</Text>
          </View>
        </Row>
        <Row>
          <Button small icon="hand-left-outline" label="Request money" onPress={() => setMaking('request')} />
          {family && <Button small kind="secondary" icon="briefcase-outline" label="Pay the helper" onPress={() => setMaking('helper')} />}
          {family && <Button small kind="secondary" icon="gift-outline" label="Allowance" onPress={() => setMaking('allowance')} />}
        </Row>
        {noPayNow && (
          <Muted>Add your PayNow / PayLah! mobile below so others can pay you by QR code.</Muted>
        )}
      </Card>

      <ErrorText message={error} />
      <Segmented value={show} onChange={setShow} options={[{ value: 'open', label: `Open (${open.length})` }, { value: 'history', label: `History (${history.length})` }]} />

      {show === 'open' && (
        <>
          {!open.length && <Empty icon="wallet-outline">Nothing to pay or confirm.</Empty>}
          {mineToPay.length > 0 && <Overline>To pay</Overline>}
          {mineToPay.map((p) => <PayCard key={p.id} cid={cid} p={p} meId={meId} onPay={setPaying} reload={both} />)}
          {toConfirm.length > 0 && <Overline>Check your account, then tap "Got it"</Overline>}
          {toConfirm.map((p) => <PayCard key={p.id} cid={cid} p={p} meId={meId} onPay={setPaying} reload={both} />)}
          {others.length > 0 && <Overline>Waiting</Overline>}
          {others.map((p) => <PayCard key={p.id} cid={cid} p={p} meId={meId} onPay={setPaying} reload={both} />)}
        </>
      )}
      {show === 'history' && (
        <>
          {!history.length && <Empty icon="time-outline">No finished payments yet.</Empty>}
          {history.map((p) => <PayCard key={p.id} cid={cid} p={p} meId={meId} onPay={setPaying} reload={both} />)}
        </>
      )}

      {family && (
        <Card style={{ gap: 0 }}>
          <Title>Repeating payments</Title>
          <Muted>Salary, allowances and pocket money that come round every week or month.</Muted>
          {!v.plans.length && <View style={{ paddingTop: 8 }}><Muted>None yet. Use "Pay the helper" or "Allowance" and choose Every week or Every month.</Muted></View>}
          {v.plans.map((pl) => <PlanRow key={pl.id} cid={cid} plan={pl} reload={both} />)}
        </Card>
      )}

      <PayNowSetup cid={cid} v={v} data={data} refresh={refresh} reload={reload} />
      <Muted>Famhub does not move or hold money. It shows the PayNow QR code of the person being paid and keeps a record. Always check the name shown in your banking app before you pay.</Muted>

      {paying && <PaySheet cid={cid} p={paying} onClose={() => setPaying(null)} onDone={both} />}
      {making && <NewPayment cid={cid} kind={making} v={v} data={data} onClose={() => setMaking(null)} onDone={both} />}
    </View>
  );
}
