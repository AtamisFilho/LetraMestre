/**
 * phase0.ts — Estado consolidado da Fase 0 + marco M0.
 *
 * Contrato: GET /api/ops/phase0/status
 *
 * `overallProgress` = média ponderada dos `progress` das 7 tasks.
 * `exitCriteria.met` é derivado do estado real:
 *   - prod-running     = task 0.1 progress >= 80
 *   - backup-tested    = existe BackupRecord verified
 *   - android-build    = BuildValidation status == "pass"
 *   - metrics-dashboard= sempre true (este dashboard existe)
 *
 * Status/progress das tasks: mapa estático refletindo o ambiente real
 * (0.2/0.4/0.5/0.6 done, 0.1 in_progress, 0.3 blocked, 0.7 in_progress).
 * A task 0.7 pode ser ajustada dinamicamente: se openCount==0 → done/100.
 */

import { db } from '@/lib/db'

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked'

export interface Phase0Task {
  id: string
  title: string
  owner: string
  effort: string
  status: TaskStatus
  progress: number
}

export interface ExitCriterion {
  id: string
  label: string
  met: boolean
}

export interface Phase0Payload {
  milestone: string
  phase: string
  weeks: string
  overallProgress: number
  exitCriteria: ExitCriterion[]
  tasks: Phase0Task[]
}

interface TaskDef {
  id: string
  title: string
  owner: string
  effort: string
  status: TaskStatus
  progress: number
  // peso para a média ponderada (default 1).
  weight?: number
}

const BASE_TASKS: TaskDef[] = [
  {
    id: '0.1',
    title: 'Configurar ambiente de produção (servidor, domínio, TLS)',
    owner: 'DevOps',
    effort: '2 dias',
    status: 'in_progress',
    progress: 60,
    weight: 2,
  },
  {
    id: '0.2',
    title: 'Definir e configurar secrets',
    owner: 'DevOps',
    effort: '0,5 dia',
    status: 'done',
    progress: 100,
  },
  {
    id: '0.3',
    title: 'Compilar e validar build Android (./gradlew assembleDebug)',
    owner: 'Mobile',
    effort: '2 dias',
    status: 'blocked',
    progress: 20,
    weight: 2,
  },
  {
    id: '0.4',
    title: 'Configurar backup automático do banco SQLite',
    owner: 'DevOps',
    effort: '0,5 dia',
    status: 'done',
    progress: 100,
  },
  {
    id: '0.5',
    title: 'Estabelecer dashboard de monitoramento (/metrics já existe)',
    owner: 'DevOps',
    effort: '1 dia',
    status: 'done',
    progress: 100,
  },
  {
    id: '0.6',
    title: 'Definir processo de release (versionamento, changelog, tags)',
    owner: 'Tech Lead',
    effort: '0,5 dia',
    status: 'done',
    progress: 100,
  },
  {
    id: '0.7',
    title: 'Revisar e fechar débitos técnicos do worklog',
    owner: 'Tech Lead',
    effort: '2 dias',
    status: 'in_progress',
    progress: 75,
  },
]

async function hasVerifiedBackup(): Promise<boolean> {
  try {
    const count = await db.backupRecord.count({
      where: { verified: true },
    })
    return count > 0
  } catch {
    return false
  }
}

async function isAndroidBuildPassing(): Promise<boolean> {
  try {
    const latest = await db.buildValidation.findFirst({
      orderBy: { runAt: 'desc' },
    })
    return latest?.status === 'pass'
  } catch {
    return false
  }
}

async function getOpenDebtCount(): Promise<number> {
  try {
    return await db.techDebtItem.count({ where: { status: 'open' } })
  } catch {
    return 0
  }
}

export async function getPhase0Status(): Promise<Phase0Payload> {
  const [verifiedBackup, androidPass, openDebt] = await Promise.all([
    hasVerifiedBackup(),
    isAndroidBuildPassing(),
    getOpenDebtCount(),
  ])

  // Ajusta dinamicamente a task 0.7 conforme débitos abertos.
  const tasks: Phase0Task[] = BASE_TASKS.map((t) => {
    if (t.id === '0.7') {
      if (openDebt === 0) {
        return { ...t, status: 'done', progress: 100 }
      }
      // Mantém in_progress; progress proporcional (mín. 50, máx. 90).
      return { ...t, status: 'in_progress', progress: Math.max(50, Math.min(90, t.progress)) }
    }
    return {
      id: t.id,
      title: t.title,
      owner: t.owner,
      effort: t.effort,
      status: t.status,
      progress: t.progress,
    }
  })

  // Média ponderada.
  let sumW = 0
  let sumWP = 0
  for (const t of BASE_TASKS) {
    const w = t.weight ?? 1
    sumW += w
    sumWP += w * t.progress
  }
  // Se 0.7 foi promovido a done, recalcula com o novo progresso.
  if (openDebt === 0) {
    sumWP = 0
    for (const t of tasks) {
      const def = BASE_TASKS.find((d) => d.id === t.id)
      const w = def?.weight ?? 1
      sumWP += w * t.progress
    }
  }
  const overallProgress = Math.round(sumWP / sumW)

  const exitCriteria: ExitCriterion[] = [
    {
      id: 'prod-running',
      label: 'Ambiente de produção rodando código atual (master)',
      met: (BASE_TASKS[0].progress >= 80),
    },
    {
      id: 'backup-tested',
      label: 'Backup funcionando (testado com restore)',
      met: verifiedBackup,
    },
    {
      id: 'android-build',
      label: 'Build Android compila sem erros',
      met: androidPass,
    },
    {
      id: 'metrics-dashboard',
      label: 'Dashboard de métricas acessível',
      met: true,
    },
  ]

  return {
    milestone: 'M0',
    phase: 'Fase 0 — Fundação e preparação',
    weeks: 'Semanas 1-2',
    overallProgress,
    exitCriteria,
    tasks,
  }
}
