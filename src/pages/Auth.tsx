import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const EXTENSION_PROMPT_PENDING_KEY = 'focusos_extension_prompt_pending';

export default function AuthPage() {
  const { login, signup, loading } = useAuth();
  const navigate = useNavigate();

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');

  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setBusy(true);
    const result = await login(signInEmail, signInPassword);
    setBusy(false);
    if (result.ok) {
      navigate('/today');
    } else {
      setSignInError(result.error || 'Unable to sign in');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');
    if (signUpPassword !== signUpConfirm) {
      setSignUpError('Passwords do not match');
      return;
    }
    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword) {
      setSignUpError('All fields are required');
      return;
    }
    setBusy(true);
    const result = await signup(signUpName.trim(), signUpEmail, signUpPassword);
    setBusy(false);
    if (result.ok) {
      localStorage.setItem(EXTENSION_PROMPT_PENDING_KEY, '1');
      navigate('/today');
    } else {
      setSignUpError(result.error || 'Unable to create account');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">FocusOS</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={signInEmail}
                  onChange={e => setSignInEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={signInPassword}
                  onChange={e => setSignInPassword(e.target.value)}
                  required
                />
                {signInError && <p className="text-sm text-destructive">{signInError}</p>}
                <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait...' : 'Sign In'}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <Input
                  placeholder="Name"
                  value={signUpName}
                  onChange={e => setSignUpName(e.target.value)}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={signUpEmail}
                  onChange={e => setSignUpEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={signUpPassword}
                  onChange={e => setSignUpPassword(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={signUpConfirm}
                  onChange={e => setSignUpConfirm(e.target.value)}
                  required
                />
                {signUpError && <p className="text-sm text-destructive">{signUpError}</p>}
                <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait...' : 'Create Account'}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
