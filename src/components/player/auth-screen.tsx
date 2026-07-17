'use client';

import * as React from 'react';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import {
  loginPlayer,
  registerPlayer,
  getGoogleConfig,
  getMe,
  PlayerApiError,
  type PlayerMe,
} from '@/lib/auth-player-client';
import { ForgotPassword } from './forgot-password';
import { ResetPassword } from './reset-password';
import { GoogleDemoDialog } from './google-demo-dialog';

interface AuthScreenProps {
  onAuthenticated: (player: PlayerMe) => void;
}

type View = 'auth' | 'forgot' | 'reset';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUsername(v: string): boolean {
  return USERNAME_RE.test(v);
}
function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [view, setView] = React.useState<View>('auth');
  const [resetToken, setResetToken] = React.useState<string | undefined>(
    undefined,
  );
  const [googleOpen, setGoogleOpen] = React.useState(false);

  // Detecta ?reset-token= na URL no mount e já abre a tela de reset.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('reset-token');
    if (t) {
      setResetToken(t);
      setView('reset');
      // Limpa o query param para não reabrir na próxima visita.
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('reset-token');
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }
  }, []);

  // --- Login state ---
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loginLoading, setLoginLoading] = React.useState(false);

  // --- Register state ---
  const [regEmail, setRegEmail] = React.useState('');
  const [regUsername, setRegUsername] = React.useState('');
  const [regPassword, setRegPassword] = React.useState('');
  const [regConfirm, setRegConfirm] = React.useState('');
  const [regLoading, setRegLoading] = React.useState(false);

  // --- Google loading ---
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(loginEmail)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    if (loginPassword.length < 1) {
      toast.error('Informe sua senha.');
      return;
    }
    setLoginLoading(true);
    try {
      await loginPlayer({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      // Buscar /me para obter PlayerMe completo (com stats).
      const me = await getMe();
      if (me) {
        toast.success(`Bem-vindo de volta, ${me.displayName}!`);
        onAuthenticated(me);
      } else {
        toast.error('Login feito, mas não foi possível carregar o perfil.');
      }
    } catch (e2) {
      const msg =
        e2 instanceof PlayerApiError
          ? `${e2.message}${e2.status ? ` (HTTP ${e2.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao entrar', { description: msg });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(regEmail)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    if (!isValidUsername(regUsername)) {
      toast.error(
        'Username deve ter 3 a 20 caracteres (letras, números ou underscore).',
      );
      return;
    }
    if (regPassword.length < 8) {
      toast.error('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (regPassword !== regConfirm) {
      toast.error('As senhas não conferem.');
      return;
    }
    setRegLoading(true);
    try {
      await registerPlayer({
        email: regEmail.trim(),
        username: regUsername.trim(),
        password: regPassword,
      });
      // Buscar /me para obter PlayerMe completo.
      const me = await getMe();
      if (me) {
        toast.success(`Conta criada! Bem-vindo, ${me.displayName}.`);
        onAuthenticated(me);
      } else {
        toast.error('Conta criada, mas não foi possível carregar o perfil.');
      }
    } catch (e2) {
      const msg =
        e2 instanceof PlayerApiError
          ? `${e2.message}${e2.status ? ` (HTTP ${e2.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao criar conta', { description: msg });
    } finally {
      setRegLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const cfg = await getGoogleConfig();
      if (cfg.configured && cfg.authUrl) {
        // Redirecionamento real OAuth.
        window.location.href = cfg.authUrl;
        return;
      }
      // demo
      setGoogleOpen(true);
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao iniciar login Google', { description: msg });
    } finally {
      setGoogleLoading(false);
    }
  };

  if (view === 'forgot') {
    return (
      <Card className="w-full shadow-sm">
        <CardContent className="pt-6">
          <ForgotPassword
            onBack={() => setView('auth')}
            onResetWithToken={(t) => {
              setResetToken(t);
              setView('reset');
            }}
          />
        </CardContent>
      </Card>
    );
  }

  if (view === 'reset') {
    return (
      <Card className="w-full shadow-sm">
        <CardContent className="pt-6">
          <ResetPassword
            initialToken={resetToken}
            onBack={() => {
              setResetToken(undefined);
              setView('auth');
            }}
            onSuccess={() => {
              setResetToken(undefined);
              setView('auth');
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full"
      >
        <Card className="w-full shadow-sm">
          <CardHeader className="gap-1.5 text-center">
            <CardTitle className="text-2xl">Conta do Jogador</CardTitle>
            <CardDescription>
              Entre ou crie sua conta para registrar partidas e ver suas
              estatísticas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">
                  <LogIn className="size-4" aria-hidden />
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="register">
                  <UserPlus className="size-4" aria-hidden />
                  Criar conta
                </TabsTrigger>
              </TabsList>

              {/* ----- LOGIN ----- */}
              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      disabled={loginLoading}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setView('forgot')}
                        className="text-xs text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loginLoading}
                    />
                  </div>
                  <Button type="submit" disabled={loginLoading}>
                    {loginLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Entrando…
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* ----- REGISTER ----- */}
              <TabsContent value="register" className="mt-4">
                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-email">E-mail</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      disabled={regLoading}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input
                      id="reg-username"
                      type="text"
                      autoComplete="username"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="3-20 caracteres: letras, números, _"
                      minLength={3}
                      maxLength={20}
                      disabled={regLoading}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      3 a 20 caracteres alfanuméricos ou underscore.
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-password">Senha</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="mínimo 8 caracteres"
                      minLength={8}
                      disabled={regLoading}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-confirm">Confirmar senha</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      minLength={8}
                      disabled={regLoading}
                    />
                  </div>
                  <Button type="submit" disabled={regLoading}>
                    {regLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Criando conta…
                      </>
                    ) : (
                      'Criar conta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <div className="flex w-full items-center gap-3">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                ou
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <GoogleIcon className="size-4" aria-hidden />
              )}
              Entrar com Google
            </Button>
          </CardFooter>
        </Card>
      </motion.div>

      <GoogleDemoDialog
        open={googleOpen}
        onOpenChange={setGoogleOpen}
        onSuccess={(p) => onAuthenticated(p)}
      />
    </>
  );
}

/** Ícone Google oficial (SVG inline, sem dependência). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
