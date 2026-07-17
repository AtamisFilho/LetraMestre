'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

import {
  forgotPassword,
  PlayerApiError,
  type ForgotPasswordResponse,
} from '@/lib/auth-player-client';

interface ForgotPasswordProps {
  onBack: () => void;
  onResetWithToken: (token: string) => void;
}

export function ForgotPassword({
  onBack,
  onResetWithToken,
}: ForgotPasswordProps) {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ForgotPasswordResponse | null>(
    null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Informe seu e-mail.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await forgotPassword({ email: email.trim() });
      setResult(r);
      toast.success('Solicitação registrada.');
    } catch (e2) {
      const msg =
        e2 instanceof PlayerApiError
          ? `${e2.message}${e2.status ? ` (HTTP ${e2.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao solicitar redefinição', { description: msg });
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
        <h2 className="text-lg font-semibold">Esqueci minha senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu e-mail. Em produção, você receberia um link de
          redefinição por e-mail. Neste ambiente sem servidor de e-mail, o
          link/token será exibido abaixo.
        </p>
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">E-mail</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              disabled={submitting}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Enviando…
              </>
            ) : (
              'Solicitar redefinição'
            )}
          </Button>
        </form>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col gap-3 rounded-lg border border-emerald-300/50 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200"
          role="status"
        >
          <div className="flex items-start gap-2">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-medium">Solicitação registrada com sucesso.</p>
              <p className="text-xs opacity-90">
                Ambiente sem servidor de e-mail — use o link/token abaixo para
                redefinir. Em produção, o link seria enviado por e-mail.
              </p>
            </div>
          </div>
          {result.demoResetUrl ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                Link
              </span>
              <code className="break-all rounded bg-white/70 px-2 py-1 font-mono text-xs dark:bg-black/30">
                {result.demoResetUrl}
              </code>
            </div>
          ) : null}
          {result.demoResetToken ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                Token
              </span>
              <code className="break-all rounded bg-white/70 px-2 py-1 font-mono text-xs dark:bg-black/30">
                {result.demoResetToken}
              </code>
            </div>
          ) : null}
          {result.demoResetToken ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => onResetWithToken(result.demoResetToken!)}
            >
              Redefinir com este token
            </Button>
          ) : null}
        </motion.div>
      )}
    </motion.div>
  );
}
