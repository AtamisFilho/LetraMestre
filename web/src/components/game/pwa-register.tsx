'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Registers the service worker and orchestrates the update flow.
 *
 * - On mount: registers /sw.js.
 * - Listens for `controllerchange` and reloads the page exactly once
 *   (`refreshing` guard prevents the reload loop that would otherwise happen
 *   because each navigation installs the SW again).
 * - `hadControllerAtStart` guards against an initial reload: if there was no
 *   controller when the page loaded, the very first controllerchange is the
 *   initial SW installation, not an update — we should NOT reload.
 * - Listens for `SW_UPDATED` postMessage from the SW (posted on activate).
 *   Shows a sonner toast with an "Atualizar" button that posts
 *   `SKIP_WAITING` to the waiting SW. The toast is dismissible so the user
 *   can defer the reload.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;

    const onControllerChange = () => {
      // Avoid reload loops: only reload once per controllerchange that
      // represents a real SW handover (i.e. we already had a controller).
      if (refreshing) return;
      if (!hadControllerAtStart) return;
      refreshing = true;
      window.location.reload();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        toast('Nova versão disponível', {
          description: 'Recarregue para aplicar a atualização.',
          duration: 15000,
          action: {
            label: 'Atualizar',
            onClick: () => {
              // Ask the waiting SW to skip waiting; the controllerchange
              // listener above will trigger the reload.
              navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg && reg.waiting) {
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  // No waiting SW: just reload.
                  window.location.reload();
                }
              });
            },
          },
        });
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.addEventListener('message', onMessage);

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed silently — app still works online-only.
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
