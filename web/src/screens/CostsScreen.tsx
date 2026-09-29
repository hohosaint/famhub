import DatePicker from '../DatePicker';
import { useEffect, useState } from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { api, fmtDate, sgd, SplitMode, Statement, todaySG, Transfer } from '../api';
import { colors } from '../theme';
import { Badge, Button, Card, Choice, DateField, Empty, ErrorText, Field, FilePicker, Link, Muted, MultiChoice, Row, s, Title } from '../ui';
import { memberOptions, nameOf, run, ScreenProps } from './shared';

const CATEGORIES = [
  { value: 'medical', label: 'Medical' }, { value: 'transport', label: 'Transport' }, { value: 'supplies', label: 'Supplies' },
  { value: 'food', label: 'Food' }, { value: 'helper', label: 'Helper' }, { value: 'bills', label: 'Bills' }, { value: 'other', label: 'Other' },
];

function StatementView({ cid }: { cid: string }) {
  const [month, setMonth] = useState(todaySG().slice(0, 7));
  const [st, setSt] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.statement(cid, month).then(setSt).catch((e) => setError(e.message)); }, [cid, month]);
  const shift = (n: number) => { const d = new Date(`${month}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 7)); };
  const label = new Date(`${month}-15T00:00:00Z`).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>Monthly statement</Title>
        <Row><Link label="‹ Previous" onPress={() => shift(-1)} /><Text style={{ fontSize: 16, fontWeight: '600' }}>{label}</Text><Link label="Next ›" onPress={() => shift(1)} /></Row>
      </Row>
      <ErrorText message={error} />
      {st && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 17 }}>Total spent: <Text style={{ fontWeight: '700' }}>{sgd(st.total)}</Text></Text>
          {st.people.map((p) => (
            <Row key={p.userId} style={{ justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, flex: 1 }}>{p.name}</Text>
              <Muted>paid {sgd(p.paid)} · share {sgd(p.share)}</Muted>
              <Text style={{ fontSize: 16, fontWeight: '600', color: p.difference >= 0 ? colors.ok : colors.danger }}>{p.difference >= 0 ? '+' : ''}{sgd(p.difference)}</Text>
            </Row>
          ))}
          {st.byCategory.length > 0 && <Muted>By type: {st.byCategory.map((c) => `${CATEGORIES.find((x) => x.value === c.category)?.label || c.category} ${sgd(c.amount)}`).join(' · ')}</Muted>}
          {!st.expenses.length && <Empty>No expenses this month.</Empty>}
          <Link label="Download as a spreadsheet (CSV)" onPress={() => Linking.openURL(api.statementCsvUrl(cid, month))} />
        </View>
      )}
    </Card>
  );
}

function ExpenseForm({ data, cid, refresh }: { data: ScreenProps['data']; cid: string; refresh: () => Promise<void> }) {
  const people = memberOptions(data);
  const family = data.members.filter((m) => m.role === 'owner' || m.role === 'family').map((m) => m.userId);
  const [item, setItem] = useState('');
  const [category, setCategory] = useState('medical');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(data.me.userId);
  const [spentOn, setSpentOn] = useState(todaySG());
  const [mode, setMode] = useState<SplitMode>('equal');
  const [among, setAmong] = useState<string[]>(family);
  const [values, setValues] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixedSum = among.reduce((s2, u) => s2 + (Number(values[u]) || 0), 0);
  async function pick(f: File) {
    setBusy(true); setError(null);
    try { setReceipt(await api.upload(cid, f)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function add() {
    const shares: Record<string, number> = {};
    for (const u of among) shares[u] = mode === 'equal' ? 1 : Number(values[u]) || 0;
    const ok = await run(() => api.addExpense(cid, { item, category, amount: Number(amount), paidByUserId: paidBy, spentOn, splitMode: mode, shares, receiptFileId: receipt?.id }), refresh, setError);
    if (ok) { setItem(''); setAmount(''); setReceipt(null); setValues({}); }
  }

  return (
    <Card>
      <Title>Add an expense</Title>
      <Field label="What was it?" value={item} onChange={setItem} placeholder="Taxi to clinic" />
      <Choice label="Type" value={category} onChange={setCategory} options={CATEGORIES} />
      <Field label="Amount (S$)" value={amount} onChange={setAmount} placeholder="18.50" keyboard="decimal-pad" />
      <Choice label="Paid by" value={paidBy} onChange={setPaidBy} options={people} />
      <DatePicker label="Date" value={spentOn} onChange={setSpentOn} />
      <Choice label="How to split" value={mode} onChange={setMode} options={[{ value: 'equal', label: 'Equally' }, { value: 'ratio', label: 'By ratio' }, { value: 'fixed', label: 'Fixed amounts' }]} />
      <MultiChoice label="Shared between" values={among} onChange={setAmong} options={people} />
      {mode !== 'equal' && among.map((u) => (
        <Field key={u} label={`${nameOf(data, u)}: ${mode === 'ratio' ? 'ratio (for example 2 for a double share)' : 'amount in S$'}`} value={values[u] || ''} onChange={(v) => setValues({ ...values, [u]: v })} keyboard="decimal-pad" />
      ))}
      {mode === 'fixed' && <Muted>Fixed amounts add up to {sgd(fixedSum)}{amount ? ` of ${sgd(Number(amount) || 0)}` : ''}.</Muted>}
      <FilePicker label="Receipt photo (optional)" accept="image/*,application/pdf" onPick={pick} busy={busy} />
      {receipt && <Muted>Receipt attached: {receipt.name} <Link label="Remove" onPress={() => setReceipt(null)} /></Muted>}
      <ErrorText message={error} />
      <Button label={busy ? 'Uploading...' : 'Add expense'} onPress={add} disabled={busy} />
    </Card>
  );
}

export default function CostsScreen({ data, cid, refresh }: ScreenProps) {
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyOf = (b: Transfer) => `${b.fromUserId}>${b.toUserId}`;
  const balances = data.balances || [];
  const expenses = data.expenses || [];

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Title>Settle up</Title>
        {!balances.length && <Muted>Everyone is settled up.</Muted>}
        {balances.map((b) => (
          <View key={keyOf(b)} style={{ gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 17 }}><Text style={{ fontWeight: '600' }}>{b.fromName}</Text> pays <Text style={{ fontWeight: '600' }}>{b.toName}</Text> {sgd(b.amount)}</Text>
            <Row>
              {b.toHasPayNow
                ? <Button label={qrKey === keyOf(b) ? 'Hide PayNow QR' : 'Show PayNow QR'} kind="secondary" onPress={() => setQrKey(qrKey === keyOf(b) ? null : keyOf(b))} />
                : <Muted>{b.toName} has no PayNow mobile saved yet (Me tab).</Muted>}
              <Button label="Mark as paid" kind="secondary" onPress={() => run(() => api.settle(cid, b), refresh, setError)} />
            </Row>
            {qrKey === keyOf(b) && (
              <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
                <Image source={{ uri: api.payNowQrUrl(cid, b.toUserId, b.amount) }} style={{ width: 240, height: 240 }} accessibilityLabel={`PayNow QR code to pay ${b.toName} ${sgd(b.amount)}`} />
                <Muted>Scan with any Singapore banking app or PayLah. Check the name and amount before paying, then tap "Mark as paid".</Muted>
              </View>
            )}
          </View>
        ))}
        <ErrorText message={error} />
      </Card>

      <StatementView cid={cid} />
      <ExpenseForm data={data} cid={cid} refresh={refresh} />

      <Title>All expenses</Title>
      {!expenses.length && <Empty>No expenses yet.</Empty>}
      {expenses.map((e) => (
        <Card key={e.id} style={e.settlement ? { backgroundColor: colors.okSoft } : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[s.itemTitle, { flex: 1 }]}>{e.item}</Text>
            <Text style={s.itemTitle}>{sgd(e.amount)}</Text>
          </Row>
          <Row>
            {!e.settlement && <Badge label={CATEGORIES.find((c) => c.value === e.category)?.label || 'Other'} tone="info" />}
            <Muted>
              {e.settlement ? fmtDate(e.spentOn) : `Paid by ${nameOf(data, e.paidByUserId)} · ${fmtDate(e.spentOn)} · ${e.splitMode === 'equal' ? `split equally ${Object.keys(e.shares).length} ways` : e.splitMode === 'ratio' ? `split by ratio ${Object.entries(e.shares).map(([u, v]) => `${nameOf(data, u)} ${v}`).join(', ')}` : `fixed: ${Object.entries(e.shares).map(([u, v]) => `${nameOf(data, u)} ${sgd(v)}`).join(', ')}`}`}
            </Muted>
          </Row>
          <Row>
            {!!e.receiptFileId && <Link label="View receipt" onPress={() => Linking.openURL(api.fileUrl(e.receiptFileId))} />}
            <Link label="Delete" danger onPress={() => run(() => api.deleteExpense(cid, e.id), refresh, setError)} />
          </Row>
        </Card>
      ))}
    </View>
  );
}
