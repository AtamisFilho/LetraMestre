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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import {
  updateMe,
  PlayerApiError,
  type PlayerMe,
} from '@/lib/auth-player-client';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: PlayerMe;
  onUpdated: (player: PlayerMe) => void;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  player,
  onUpdated,
}: EditProfileDialogProps) {
  const [displayName, setDisplayName] = React.useState(player.displayName);
  const [bio, setBio] = React.useState(player.bio ?? '');
  const [avatarUrl, setAvatarUrl] = React.useState(player.avatarUrl ?? '');
  const [submitting, setSubmitting] = React.useState(false);

  // Resync quando abrir.
  React.useEffect(() => {
    if (open) {
      setDisplayName(player.displayName);
      setBio(player.bio ?? '');
      setAvatarUrl(player.avatarUrl ?? '');
    }
  }, [open, player]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('O nome de exibição não pode ficar vazio.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updateMe({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      onUpdated(updated);
      toast.success('Perfil atualizado!');
      onOpenChange(false);
    } catch (e) {
      const msg =
        e instanceof PlayerApiError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
          : 'Erro inesperado.';
      toast.error('Falha ao atualizar perfil', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            Atualize seu nome de exibição, bio e avatar. Seu e-mail e username
            não podem ser alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-displayName">Nome de exibição</Label>
            <Input
              id="edit-displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-bio">Bio</Label>
            <Textarea
              id="edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Conte um pouco sobre você…"
            />
            <span className="text-[11px] text-muted-foreground">
              {bio.length}/280 caracteres
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-avatarUrl">URL do avatar (opcional)</Label>
            <Input
              id="edit-avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…/avatar.png"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              'Salvar alterações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
