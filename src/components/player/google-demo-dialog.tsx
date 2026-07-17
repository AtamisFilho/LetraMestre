'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

import {
  googleDemoLogin,
  getMe,
  PlayerApiError,
  type PlayerMe,
} from '@/lib/auth-player-client';

interface GoogleDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (player: PlayerMe) => void;
}

/**
 * Dialog exibido quando o OAuth Google não está configurado (modo demo).
 * Permite simular o login Google informando um e-mail/nome (opcional).
 */
export function GoogleDemoDialog({
  open,
  onOpenChange,
  onSuccess,
}: GoogleDemoDialogProps) {
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleContinue = async () => {
    setSubmitting(true);
    try {
      await googleDemoLogin({
        email: email.trim() || undefined,
        name: name.trim() || undefined,
      });
      // Buscar /me para obter PlayerMe completo (com stats).
      const me = await getMe();
      if (me) {
        toast.success('Login Google (demo) realizado com sucesso!');
        onSuccess(me);
        onOpenChange(false);
        setEmail('');
        setName('');
      } else {
        toast.error('Login Google feito, mas não foi possível carregar o perfil.');
      }
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha no login Google demo', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modo demonstração — Google OAuth</DialogTitle>
          <DialogDescription>
            O Google OAuth2 exige configuração de credenciais em produção
            (GOOGLE_OAUTH_CLIENT_ID / SECRET). Neste ambiente, você pode
            continuar com uma conta Google de demonstração.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="google-demo-email">E-mail (opcional)</Label>
            <Input
              id="google-demo-email"
              type="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="google-demo-name">Nome de exibição (opcional)</Label>
            <Input
              id="google-demo-name"
              type="text"
              placeholder="Como devemos te chamar?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se deixar em branco, o servidor gerará um e-mail e nome fictícios
            automaticamente.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleContinue} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Entrando…
              </>
            ) : (
              'Continuar com conta Google demo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
