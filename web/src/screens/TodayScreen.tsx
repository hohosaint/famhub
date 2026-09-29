import { collapseSeries } from '../RepeatPicker';
import HScroll from '../HScroll';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, photosOf, taskLocked, fmtAgo, fmtDate, fmtTime, sgd, todaySG } from '../api';
import { colors, personColor, shadow } from '../theme';
import { Avatar, Badge, Banner, Button, Card, Empty, ErrorText, Gradient, Icon, IconName, Muted, Overline, Row, s } from '../ui';
import { PhotoGrid } from '../Photos';
import { kindOf } from '../family';
import { WhoIsOnlineCard } from '../WhoIsOnline';
import { composeNext } from './UpdatesScreen';
import { greeting, nameOf, PageHeader, run, ScreenProps, sgDayOf, sgTimeOf } from './shared';

type TimelineItem = { key: string; time: string; icon: IconName; color: string; title: string; detail: string; done?: boolean; late?: boolean; action?: { label: string; onPress: () => void }; tab: string };

// The colourful welcome card at the top: greeting, how Mum is today at a glance, and the care focus.
function Hero({ props, checkedToday, lateCheckin }: { props: ScreenProps; checkedToday: boolean; lateCheckin: boolean }) {
  const { data, go } = props;
  const [tips, setTips] = useState(false);
  const parent = data.circle.parentName;
  const taken = data.dosesToday.filter((d) => d.status === 'taken').length;
  const now = new Date().toISOString();
  const next = data.appointments.find((a) => a.startsAt > now);
  const pill = (icon: IconName, text: string, onPress: () => void, warn = false) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: warn ? 'rgba(255,214,102,0.95)' : pressed ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' })}>
      <Icon name={icon} size={16} color={warn ? '#7A4B00' : '#fff'} />
      <Text style={{ color: warn ? '#7A4B00' : '#fff', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{text}</Text>
    </Pressable>
  );
  const plan = data.carePlan;
  const kind = data.circle.profile?.careFor || 'elder';
  return (
    <Gradient colors={kind === 'elder' ? undefined : kindOf(kind).gradient} style={{ borderRadius: 26, padding: 20, gap: 12, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 40, bottom: -70, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' }}>{new Date().toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{greeting()}, {data.me.name}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {data.baby ? data.baby.babies.map((b) => {
          const last = data.baby!.logs.find((l) => l.babyId === b.id && (l.kind === 'bottle' || l.kind === 'breast'));
          const mins = last ? Math.round((Date.now() - new Date(last.at).getTime()) / 60000) : -1;
          const due = !!(last && data.baby!.feedEvery && mins >= data.baby!.feedEvery * 60);
          const ml = data.baby!.logs.filter((l) => l.babyId === b.id && l.kind === 'bottle' && sgDayOf(l.at) === todaySG()).reduce((a, l) => a + (l.ml || 0), 0);
          return <View key={b.id}>{pill('water', `${b.name}: ${last ? `fed ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`} ago` : 'no feed yet'}${ml ? ` · ${ml} ml today` : ''}`, () => go('care'), due)}</View>;
        }) : !data.circle.checkinBy ? null : pill(checkedToday ? 'checkmark-circle' : 'time-outline', checkedToday ? `${parent} ${kind === 'teen' ? 'is home safe' : 'checked in'}` : lateCheckin ? `No check-in yet` : `${kind === 'teen' ? 'Home safe by' : 'Check-in by'} ${data.circle.checkinBy}`, () => go('care'), lateCheckin)}
        {data.dosesToday.length > 0 && pill('medkit', `Medicines ${taken}/${data.dosesToday.length}`, () => go('care'))}
        {next && pill('calendar', `${next.title} · ${fmtDate(sgDayOf(next.startsAt)).replace(/ \d{4}$/, '')}`, () => go('calendar'))}
      </View>
      {plan && (
        <Pressable onPress={() => setTips(!tips)} accessibilityRole="button" accessibilityLabel={`Care focus: ${plan.focus.title}. ${tips ? 'Hide' : 'Show'} tips`} style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 12, gap: 6 }}>
          <Row style={{ gap: 8, flexWrap: 'nowrap' }}>
            <Icon name="sparkles" size={18} color="#FFE08A" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, flex: 1 }}>Care focus: {plan.focus.title}</Text>
            <Icon name={tips ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
          </Row>
          {tips && plan.focus.tips.map((t, i) => <Text key={i} style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>•  {t}</Text>)}
        </Pressable>
      )}
    </Gradient>
  );
}

export default function TodayScreen(props: ScreenProps) {
  const { data, cid, refresh, go } = props;
  const [error, setError] = useState<string | null>(null);
  const today = todaySG();
  const parent = data.circle.parentName;
  const me = data.me.userId;
  const act = (fn: () => Promise<unknown>) => run(fn, refresh, setError);

  const checkedToday = data.lastCheckin && sgDayOf(data.lastCheckin.createdAt) === today;
  const nowHM = new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 16);
  const lateCheckin = !data.baby && !!data.circle.checkinBy && !checkedToday && nowHM > data.circle.checkinBy;
  const help = data.openHelp[0];

  // "Help wanted": requests nobody has taken, and appointments with no escort in the next 14 days.
  const soon = new Date(Date.now() + 14 * 86400e3).toISOString();
  const now = new Date().toISOString();
  const wanted = [
    ...collapseSeries(data.appointments.filter((a) => !a.escortUserId && a.startsAt > now && a.startsAt < soon).sort((x, y) => x.startsAt.localeCompare(y.startsAt))).map(({ item: a, more }) => ({
      key: a.id, icon: 'car-outline' as IconName, title: `Escort: ${a.title}`, when: `${fmtDate(sgDayOf(a.startsAt))}, ${fmtTime(a.startsAt)}${a.repeatText ? ` · repeats${more ? `, ${more} more` : ''}` : ''}`, label: "I'll go",
      onPress: () => act(() => api.updateAppointment(cid, a.id, { escortUserId: me })),
    })),
    ...collapseSeries(data.tasks.filter((t) => t.status !== 'done' && !t.assigneeUserId).sort((x, y) => (x.dueDate || '9').localeCompare(y.dueDate || '9'))).map(({ item: t, more }) => ({
      key: t.id, icon: 'hand-left-outline' as IconName, title: t.title, when: `${t.dueDate ? `By ${fmtDate(t.dueDate)}` : 'Any time'}${t.repeatText ? ` · repeats${more ? `, ${more} more` : ''}` : ''}`, label: "I'll do it",
      onPress: () => act(() => api.taskAction(cid, t.id, 'take')),
    })),
  ];

  // Today's timeline: medicines, appointments and tasks due, in time order.
  const items: TimelineItem[] = [
    ...data.dosesToday.map((d) => ({
      key: `d${d.medicationId}${d.time}`, time: d.time, icon: 'medkit-outline' as IconName, color: colors.info, title: d.name,
      detail: d.status === 'taken' ? `Taken ${fmtTime(d.takenAt)} · ${d.recordedBy}` : `${d.dose}${d.instructions ? `, ${d.instructions}` : ''}${d.status === 'later' ? ` · can tick from ${d.time}` : ''}`,
      done: d.status === 'taken', late: d.status === 'missed', tab: 'care',
      action: d.status !== 'taken' && d.status !== 'later' && data.can.logDoses ? { label: 'Taken', onPress: () => act(() => api.logDose(cid, d.medicationId, d.time, true)) } : undefined,
    })),
    ...data.appointments.filter((a) => sgDayOf(a.startsAt) === today).map((a) => ({
      key: `a${a.id}`, time: sgTimeOf(a.startsAt), icon: 'calendar-outline' as IconName, color: colors.primary, title: a.title,
      detail: `${a.location}${a.escortUserId ? ` · with ${nameOf(data, a.escortUserId)}` : ' · escort needed'}`, done: a.startsAt < now, tab: 'calendar',
    })),
    ...data.tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= today && (t.assigneeUserId === me || !t.assigneeUserId || data.role !== 'helper')).map((t) => ({
      key: `t${t.id}`, time: t.dueDate === today && t.dueTime ? t.dueTime : 'Due', icon: 'checkbox-outline' as IconName, color: colors.warn, title: t.title,
      detail: `${t.assigneeUserId ? nameOf(data, t.assigneeUserId) : 'Not taken'}${t.dueDate < today ? ' · overdue' : ''}${taskLocked(t) ? ` · can tick from ${t.dueTime}` : ''}`, late: t.dueDate < today, tab: 'requests',
      action: t.assigneeUserId === me && !taskLocked(t) ? { label: 'Done', onPress: () => act(() => api.taskAction(cid, t.id, 'done')) } : undefined,
    })),
  ].sort((a, b) => (a.time === 'Due' ? '99' : a.time).localeCompare(b.time === 'Due' ? '99' : b.time));

  const latest = data.notes[0];
  const owe = (data.balances || []).filter((b) => b.fromUserId === me);
  const owed = (data.balances || []).filter((b) => b.toUserId === me);

  return (
    <View style={{ gap: 18 }}>
      <Hero props={props} checkedToday={!!checkedToday} lateCheckin={lateCheckin} />
      <WhoIsOnlineCard data={data} cid={cid} go={go} />
      <ErrorText message={error} />

      {help && (
        <Banner tone="bad">
          <Row><Icon name="warning" size={24} color={colors.danger} /><Text style={{ fontSize: 19, fontWeight: '800', color: colors.danger, flex: 1 }}>{parent} needs help</Text></Row>
          <Text style={{ fontSize: 15 }}>{nameOf(data, help.recordedBy)} pressed the button {fmtAgo(help.createdAt)}. Call now, then let the others know you are on it.</Text>
          <Row>
            {!!data.circle.parentPhone && <Button icon="call" label={`Call ${parent}`} kind="danger" onPress={() => { window.location.href = `tel:${data.circle.parentPhone}`; }} />}
            <Button icon="hand-right" label="I'm handling it" onPress={() => act(() => api.resolveHelp(cid, help.id))} />
            <Button icon="close-circle-outline" kind="secondary" label="False alarm" onPress={() => act(() => api.cancelHelp(cid, help.id))} />
          </Row>
          <Muted>Pressed by mistake? "False alarm" tells everyone {parent} is OK and stops the alerts.</Muted>
        </Banner>
      )}

      {data.baby ? (
        <Card style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}><Overline>{data.baby.babies.length > 1 ? 'Babies today' : 'Baby today'}</Overline><Text style={s.link} onPress={() => go('care')}>Open the baby log</Text></Row>
          {data.baby.babies.map((b) => {
            const logs = data.baby!.logs.filter((l) => l.babyId === b.id && sgDayOf(l.at) === today);
            const ml = logs.filter((l) => l.kind === 'bottle').reduce((a2, l) => a2 + (l.ml || 0), 0);
            const kcal = logs.reduce((a2, l) => { if (l.kind === 'solids') return a2 + (l.macros ? l.macros.kcal : 0); if (l.kind !== 'bottle') return a2; const per = l.source === 'breastmilk' ? data.baby!.breastMilk : l.per100ml; return a2 + (per ? (per.kcal * (l.ml || 0)) / 100 : 0); }, 0);
            const feeds = logs.filter((l) => l.kind === 'bottle' || l.kind === 'breast').length;
            const diapers = logs.filter((l) => l.kind === 'diaper').length;
            return (
              <Row key={b.id} style={{ flexWrap: 'nowrap', gap: 10 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: b.color }} />
                <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text, minWidth: 64 }}>{b.name}</Text>
                <Text style={{ flex: 1, color: colors.muted, fontWeight: '600' }}>{feeds} feeds · {ml} ml · {Math.round(kcal)} kcal · {diapers} diapers</Text>
              </Row>
            );
          })}
          <Button icon="water" label="Log a feed" onPress={() => go('care')} />
        </Card>
      ) : !data.circle.checkinBy ? null : (
        <Card style={[{ flexDirection: 'row', gap: 14, alignItems: 'center' }, lateCheckin ? { borderColor: colors.warnBorder, backgroundColor: colors.warnSoft } : checkedToday ? { borderColor: colors.okBorder, backgroundColor: colors.okSoft } : undefined]}>
          <Avatar id={data.members.find((m) => m.role === 'parent')?.userId || 'parent'} name={parent} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: '800' }}>{parent}</Text>
            <Text style={{ fontSize: 15, color: checkedToday ? colors.ok : lateCheckin ? colors.warn : colors.muted, fontWeight: '600' }}>
              {checkedToday ? `Checked in ${fmtAgo(data.lastCheckin!.createdAt)}` : lateCheckin ? `No check-in yet (expected by ${data.circle.checkinBy})` : `${data.circle.profile?.careFor === 'teen' ? 'Home safe expected by' : 'Check-in expected by'} ${data.circle.checkinBy}`}
            </Text>
            {data.dosesToday.length > 0 && <Muted>{data.dosesToday.filter((d) => d.status === 'taken').length} of {data.dosesToday.length} medicines taken today</Muted>}
          </View>
          {!checkedToday && data.can.checkIn && <Button small label="OK" icon="checkmark" onPress={() => act(() => api.checkin(cid, 'ok'))} />}
        </Card>
      )}

      {wanted.length > 0 && (
        <View style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}><Overline>Help wanted ({wanted.length})</Overline><Text style={s.link} onPress={() => go('requests')}>See all</Text></Row>
          <HScroll gap={12} paddingRight={8}>
            {wanted.map((w) => (
              <View key={w.key} style={{ width: 230, backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border, ...shadow }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.warnSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={w.icon} size={20} color={colors.warn} /></View>
                <Text style={{ fontSize: 16, fontWeight: '700' }} numberOfLines={2}>{w.title}</Text>
                <Muted>{w.when}</Muted>
                {data.role !== 'parent' && <Button small label={w.label} onPress={w.onPress} />}
              </View>
            ))}
          </HScroll>
        </View>
      )}

      <View style={{ gap: 10 }}>
        <Overline>Today</Overline>
        <Card style={{ paddingVertical: 8 }}>
          {!items.length && <Empty icon="sunny-outline">Nothing scheduled today.</Empty>}
          {items.map((it, i) => (
            <Pressable key={it.key} onPress={() => go(it.tab)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ width: 46, fontSize: 14, fontWeight: '700', color: it.late ? colors.danger : colors.muted }}>{it.time}</Text>
              <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: it.done ? colors.okSoft : `${it.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={it.done ? 'checkmark' : it.icon} size={18} color={it.done ? colors.ok : it.color} />
                </View>
                {i < items.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 }} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: it.done ? colors.muted : colors.text, textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.title}</Text>
                <Text style={[s.small, it.late && { color: colors.danger, fontWeight: '600' }]}>{it.late && !it.done ? 'Not done yet · ' : ''}{it.detail}</Text>
              </View>
              {it.action && <Button small kind="secondary" label={it.action.label} onPress={it.action.onPress} />}
            </Pressable>
          ))}
        </Card>
      </View>

      {data.can.postNotes && (
        <Card onPress={() => { composeNext.open = true; go('updates'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>Share a photo or update</Text>
            <Muted>Take a picture or choose from your phone</Muted>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.faint} />
        </Card>
      )}

      {data.can.seeVisits && data.visits[0] && data.visits[0].date >= new Date(Date.now() - 14 * 86400e3 + 8 * 3600e3).toISOString().slice(0, 10) && (
        <Card onPress={() => go('visits')} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}><Overline>Latest visit notes</Overline><Text style={s.link}>All visit notes</Text></Row>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{data.visits[0].provider || data.visits[0].type} · {fmtDate(data.visits[0].date)}</Text>
          {!!(data.visits[0].summary || data.visits[0].instructions) && <Text style={{ fontSize: 15, lineHeight: 21 }} numberOfLines={3}>{data.visits[0].summary || data.visits[0].instructions}</Text>}
          {!!data.visits[0].medChanges && <Row style={{ gap: 6 }}><Icon name="medkit-outline" size={16} color={colors.warn} /><Text style={{ fontSize: 14, color: colors.warn, fontWeight: '700', flex: 1 }} numberOfLines={2}>{data.visits[0].medChanges}</Text></Row>}
        </Card>
      )}

      {latest && (
        <View style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}><Overline>Latest update</Overline><Text style={s.link} onPress={() => go('updates')}>All updates</Text></Row>
          <Card onPress={() => go('updates')}>
            <Row><Avatar id={latest.authorUserId} name={nameOf(data, latest.authorUserId)} size={32} /><Text style={{ fontWeight: '700', fontSize: 15 }}>{nameOf(data, latest.authorUserId)}</Text><Muted>· {fmtAgo(latest.createdAt)}</Muted>{latest.urgent && <Badge label="Urgent" tone="bad" />}</Row>
            {!!latest.text && <Text style={{ fontSize: 16, lineHeight: 22 }} numberOfLines={3}>{latest.text}</Text>}
            <PhotoGrid ids={photosOf(latest).slice(0, 4)} height={180} />
            <Row><Icon name="heart" size={16} color={colors.danger} /><Muted>{Object.keys(latest.reactions || {}).length} thanks · {(latest.comments || []).length} comments</Muted></Row>
          </Card>
        </View>
      )}

      {data.balances && (owe.length > 0 || owed.length > 0) && (
        <Card onPress={() => go('costs')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="wallet-outline" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            {owe.map((b) => <Text key={b.toUserId} style={{ fontSize: 16 }}>You owe <Text style={{ fontWeight: '700', color: personColor(b.toUserId) }}>{b.toName}</Text> {sgd(b.amount)}</Text>)}
            {owed.map((b) => <Text key={b.fromUserId} style={{ fontSize: 16 }}><Text style={{ fontWeight: '700', color: personColor(b.fromUserId) }}>{b.fromName}</Text> owes you {sgd(b.amount)}</Text>)}
          </View>
          <Icon name="chevron-forward" size={18} color={colors.faint} />
        </Card>
      )}
    </View>
  );
}
