import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, APP_VERSION, AuthOptions } from '../api';
import { colors, personColor } from '../theme';
import { Button, Card, ErrorText, Field, Gradient, Icon, Muted, Overline } from '../ui';
import { DarkToggle } from '../Appearance';

// Sign-in page. Test accounts use a username and password; on Azure a person signed in
// with Microsoft can continue as themselves.
export default function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [opts, setOpts] = useState<AuthOptions | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('reset') || '' : '';
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot' | 'reset'>(resetToken ? 'reset' : 'signin');
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password2, setPassword2] = useState('');

  useEffect(() => { api.authOptions().then(setOpts).catch((e) => setError(e.message)); }, []);

  const live = opts?.mode === 'live';
  async function signIn() {
    if (!username.trim() || !password) { setError(live ? 'Enter your email and password.' : 'Enter your username and password.'); return; }
    setBusy(true); setError(null);
    try { await api.login(username.trim(), password); onSignedIn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function register() {
    if (!name.trim()) { setError('Enter your name.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== password2) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError(null);
    try { await api.register({ name: name.trim(), username: username.trim(), password, email: email.trim() }); onSignedIn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function forgot() {
    if (!email.trim()) { setError('Enter your email.'); return; }
    setBusy(true); setError(null);
    try { await api.forgotPassword(email.trim()); setNotice(`If ${email.trim()} has a Famhub account, a link to choose a new password is on its way. Check your inbox (and junk folder).`); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function reset() {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== password2) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError(null);
    try { await api.resetPassword(resetToken, password); window.history.replaceState({}, '', '/'); onSignedIn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const to = (m: typeof mode) => { setMode(m); setError(null); setNotice(null); setPassword(''); setPassword2(''); };
  const link = (label: string, onPress: () => void) => <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }} accessibilityRole="button" onPress={onPress}>{label}</Text>;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 18, backgroundColor: colors.bg }}>
      <View style={{ position: 'absolute', top: 12, right: 12 }}><DarkToggle /></View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Gradient style={{ width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="home" size={36} color="#fff" />
        </Gradient>
        <Text style={{ fontSize: 32, fontWeight: '900', color: colors.text }}>Famhub</Text>
        <Muted>Care for the whole family, together.</Muted>
      </View>

      <Card style={{ width: '100%', maxWidth: 420, gap: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{mode === 'register' ? 'Create an account' : mode === 'forgot' ? 'Forgot password' : mode === 'reset' ? 'Choose a new password' : 'Sign in'}</Text>
        {live && mode === 'signin' && (
          <>
            <Field label="Email" value={username} onChange={setUsername} placeholder="you@example.com" keyboard="email-address" autoComplete="email" onSubmit={signIn} />
            <Field label="Password" value={password} onChange={setPassword} secure autoComplete="current-password" onSubmit={signIn} />
            <ErrorText message={error} />
            <Button icon="log-in-outline" label={busy ? 'Signing in...' : 'Sign in'} disabled={busy} onPress={signIn} />
            {link('Forgot password?', () => { setEmail(username); to('forgot'); })}
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <Muted>New to Famhub? Create an account, then set up your family or join with an invite code.</Muted>
            <Button kind="secondary" icon="person-add-outline" label="Create an account" onPress={() => to('register')} />
          </>
        )}
        {live && mode === 'register' && (
          <>
            <Field label="Your name" value={name} onChange={setName} placeholder="Thomas Koh" autoComplete="name" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" autoComplete="email" />
            <Field label="Password (at least 8 characters)" value={password} onChange={setPassword} secure autoComplete="new-password" />
            <Field label="Password again" value={password2} onChange={setPassword2} secure autoComplete="new-password" onSubmit={register} />
            <ErrorText message={error} />
            <Button icon="person-add-outline" label={busy ? 'Creating...' : 'Create account'} disabled={busy} onPress={register} />
            {link('I already have an account: sign in', () => to('signin'))}
          </>
        )}
        {mode === 'forgot' && (
          <>
            <Muted>{opts?.emailReset === false ? 'Password reset by email is not set up yet. Ask the owner of your family circle for a reset link (Circle and people > your name), or ask the Famhub admin.' : 'Enter the email you signed up with. We will send a link to choose a new password.'}</Muted>
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" autoComplete="email" onSubmit={forgot} />
            <ErrorText message={error} />
            {notice ? <Muted>{notice}</Muted> : <Button icon="mail-outline" label={busy ? 'Sending...' : 'Send the link'} disabled={busy || opts?.emailReset === false} onPress={forgot} />}
            {link('Back to sign in', () => to('signin'))}
          </>
        )}
        {mode === 'reset' && (
          <>
            <Field label="New password (at least 8 characters)" value={password} onChange={setPassword} secure autoComplete="new-password" />
            <Field label="New password again" value={password2} onChange={setPassword2} secure autoComplete="new-password" onSubmit={reset} />
            <ErrorText message={error} />
            <Button icon="key-outline" label={busy ? 'Saving...' : 'Save and sign in'} disabled={busy} onPress={reset} />
            {link('Back to sign in', () => { window.history.replaceState({}, '', '/'); to('signin'); })}
          </>
        )}
        {opts && !opts.testMode && !live && (
          <>
            <Muted>Sign in with your Microsoft account to continue.</Muted>
            <Button icon="log-in-outline" label="Sign in with Microsoft" onPress={() => { window.location.href = '/.auth/login/aad?post_login_redirect_uri=/'; }} />
          </>
        )}
        {opts?.testMode && mode === 'register' && (
          <>
            <Muted>Create your own test account. Next, you set up a care circle (an older parent, a newborn, twins or triplets) or join one with an invite code.</Muted>
            <Field label="Your name" value={name} onChange={setName} placeholder="Thomas Koh" autoComplete="name" />
            <Field label="Username (optional)" value={username} onChange={setUsername} placeholder="Made from your name if left empty" autoComplete="username" />
            <Field label="Email (optional, for email alerts)" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" autoComplete="email" />
            <Field label="Password (at least 8 characters)" value={password} onChange={setPassword} secure autoComplete="new-password" />
            <Field label="Password again" value={password2} onChange={setPassword2} secure autoComplete="new-password" onSubmit={register} />
            <ErrorText message={error} />
            <Button icon="person-add-outline" label={busy ? 'Creating...' : 'Create account'} disabled={busy} onPress={register} />
            <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }} accessibilityRole="button" onPress={() => { setMode('signin'); setError(null); }}>I already have an account: sign in</Text>
          </>
        )}
        {opts?.testMode && mode === 'signin' && (
          <>
            <Field label="Username" value={username} onChange={setUsername} placeholder="for example siti" autoComplete="username" onSubmit={signIn} />
            <Field label="Password" value={password} onChange={setPassword} placeholder="Password" secure autoComplete="current-password" onSubmit={signIn} />
            <ErrorText message={error} />
            <Button icon="log-in-outline" label={busy ? 'Signing in...' : 'Sign in'} disabled={busy} onPress={signIn} />
            <Button kind="secondary" icon="person-add-outline" label="Create a new account" onPress={() => { setMode('register'); setError(null); setUsername(''); setPassword(''); }} />
          </>
        )}
        {opts?.microsoft && opts.testMode && (
          <>
            <Overline>Or</Overline>
            <Button kind="secondary" icon="person-circle-outline" label={`Continue as ${opts.microsoft.name} (Microsoft)`} onPress={async () => { try { await api.continueMicrosoft(); onSignedIn(); } catch (e: any) { setError(e.message); } }} />
          </>
        )}
        {!opts && <ErrorText message={error} />}
      </Card>

      {opts?.testMode && mode === 'signin' && opts.accounts.length > 0 && (
        <Card style={{ width: '100%', maxWidth: 420, gap: 8 }}>
          <Overline>Test accounts (tap to fill the username)</Overline>
          {opts.accounts.map((a) => (
            <Pressable key={a.username} onPress={() => { setUsername(a.username); setError(null); }} accessibilityRole="button" accessibilityLabel={`Use username ${a.username}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, backgroundColor: pressed || username === a.username ? colors.primarySoft : 'transparent' })}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: personColor(a.username), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{a.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{a.username}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>{a.label}</Text>
              </View>
            </Pressable>
          ))}
          <Muted>Ask the Famhub admin for the test password.</Muted>
        </Card>
      )}
      {opts?.microsoft && (
        <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => { window.location.href = '/.auth/logout?post_logout_redirect_uri=/'; }}>Sign out of Microsoft too</Text>
      )}
      <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '700' }}>Famhub {APP_VERSION}</Text>
    </View>
  );
}
