'use client';

import * as React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

import {
  resetPassword,
  PlayerApiError,
} from '@/lib/auth-player-client';

interface ResetPasswordProps {
  initialToken?: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function ResetPassword({
  initialToken,
  onBack,
  onSuccess,
}: ResetPasswordProps) {
  const [token, setToken] = React.useState(initialToken ?? '');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('Informe o token de redefinição.');
      return;
    }
    if (password.length < 8) {
      toast.error('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não conferem.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ token: token.trim(), password });
      toast.success('Senha redefinida! Faça login com a nova senha.');
      onSuccess();
    } catch (e2) {
      const msg =
        e2 instanceof PlayerApiError
          ? `${e2.message}${e2.status ? ` (HTTP ${e2.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao redefinir senha', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex flex-col gap-4"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar para login
      </button>

      <div>
        <h2 className="text-lg font-semibold">Redefinir senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole o token recebido e defina uma nova senha (mínimo 8 caracteres).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-token">Token</Label>
          <Input
            id="reset-token"
            type="text"
            autoComplete="off"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="token de redefinição"
            disabled={submitting}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">Nova senha</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            minLength={8}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm">Confirmar nova senha</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting}
            minLength={8}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Redefinindo…
            </>
          ) : (
            'Redefinir senha'
          )}
        </Button>
      </form>
    </motion.div>
  );
}
