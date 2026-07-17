'use client';

import * as React from 'react';
import Link from 'next/link';
import { Github, CircleDot } from 'lucide-react';

import { fetchReleaseChangelog } from '@/lib/ops/client';

export function Footer() {
  const [version, setVersion] = React.useState<string>('');

  React.useEffect(() => {
    let mounted = true;
    fetchReleaseChangelog()
      .then((c) => {
        if (mounted && c?.currentVersion) setVersion(c.currentVersion);
      })
      .catch(() => {
        /* ignore — versão é decorativa no rodapé */
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <footer className="mt-auto border-t bg-background/60" role="contentinfo">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">LetraMestre</span>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <span>Console de Operações — Fase 0</span>
          {version ? (
            <>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="font-mono">v{version}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <CircleDot className="size-3.5 text-emerald-500" aria-hidden />
            <span aria-live="polite">Sistema operacional</span>
          </span>
          <Link
            href="https://github.com/AtamisFilho/LetraMestre"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Github className="size-3.5" aria-hidden />
            <span>GitHub</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
