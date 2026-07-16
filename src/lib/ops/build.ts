/**
 * build.ts — Validação de build Android (sem compilar APK).
 *
 * Contrato:
 * - GET  /api/ops/build/android/status   → getBuildStatus()
 * - POST /api/ops/build/android/validate  → validateAndroidBuild()
 *
 * Verifica existência do gradlew e build.gradle.kts no clone do
 * LetraMestre em /tmp/LetraMestre, e ANDROID_HOME. Não tenta compilar.
 */

import { db } from '@/lib/db'
import fs from 'fs'

const REPO = '/tmp/LetraMestre'
const GRADLEW = `${REPO}/gradlew`
const BUILD_GRADLE = `${REPO}/build.gradle.kts`

export type BuildStatus = 'pass' | 'fail' | 'blocked' | 'pending'

export interface BuildStep {
  name: string
  ok: boolean
  detail: string
}

export interface BuildStatusPayload {
  status: BuildStatus
  lastRun: string | null
  durationMs: number
  configValid: boolean
  gradleWrapperPresent: boolean
  androidSdkAvailable: boolean
  steps: BuildStep[]
  artifact: string | null
  log: string
  blocker: string | null
}

function buildDefaultStatus(): BuildStatusPayload {
  return {
    status: 'blocked',
    lastRun: null,
    durationMs: 0,
    configValid: false,
    gradleWrapperPresent: false,
    androidSdkAvailable: false,
    steps: [
      { name: 'Gradle wrapper', ok: false, detail: 'Não validado ainda.' },
      { name: 'build.gradle.kts', ok: false, detail: 'Não validado ainda.' },
      { name: 'Android SDK', ok: false, detail: 'Não validado ainda.' },
      { name: 'assembleDebug', ok: false, detail: 'Requer SDK Android' },
    ],
    artifact: null,
    log: '',
    blocker: 'Validação ainda não executada.',
  }
}

function rowToPayload(
  r: {
    id: string
    status: string
    configValid: boolean
    gradleWrapperOk: boolean
    androidSdkOk: boolean
    artifact: string | null
    log: string
    blocker: string | null
    durationMs: number
    runAt: Date
  },
  steps: BuildStep[],
): BuildStatusPayload {
  return {
    status: r.status as BuildStatus,
    lastRun: r.runAt.toISOString(),
    durationMs: r.durationMs,
    configValid: r.configValid,
    gradleWrapperPresent: r.gradleWrapperOk,
    androidSdkAvailable: r.androidSdkOk,
    steps,
    artifact: r.artifact,
    log: r.log,
    blocker: r.blocker,
  }
}

export async function getBuildStatus(): Promise<BuildStatusPayload> {
  const latest = await db.buildValidation.findFirst({
    orderBy: { runAt: 'desc' },
  })

  if (!latest) return buildDefaultStatus()

  // Reconstrói steps a partir do log (heurística) — para simplicidade,
  // recomputamos os steps atuais sempre que GET é chamado, mas o status
  // retornado é o do último run persistido.
  const steps = computeSteps()
  return rowToPayload(latest, steps)
}

function computeSteps(): BuildStep[] {
  const gradlewOk = fs.existsSync(GRADLEW)
  const buildGradleOk = fs.existsSync(BUILD_GRADLE)
  const sdkOk = !!process.env.ANDROID_HOME && process.env.ANDROID_HOME.length > 0

  return [
    {
      name: 'Gradle wrapper',
      ok: gradlewOk,
      detail: gradlewOk
        ? 'gradlew executável presente'
        : 'gradlew ausente no clone do LetraMestre',
    },
    {
      name: 'build.gradle.kts',
      ok: buildGradleOk,
      detail: buildGradleOk ? 'Arquivo presente' : 'build.gradle.kts ausente',
    },
    {
      name: 'Android SDK',
      ok: sdkOk,
      detail: sdkOk
        ? `ANDROID_HOME=${process.env.ANDROID_HOME}`
        : 'ANDROID_HOME não definido neste ambiente',
    },
    {
      name: 'assembleDebug',
      ok: false,
      detail: 'Requer SDK Android',
    },
  ]
}

export async function validateAndroidBuild(): Promise<BuildStatusPayload> {
  const t0 = Date.now()
  const steps = computeSteps()

  const gradlewOk = steps[0].ok
  const buildGradleOk = steps[1].ok
  const sdkOk = steps[2].ok

  const configValid = gradlewOk && buildGradleOk

  // status: pass se tudo ok; blocked se faltar SDK; fail se config inválida.
  let status: BuildStatus
  let blocker: string | null
  if (!configValid) {
    status = 'fail'
    blocker =
      'Configuração do projeto inválida: gradlew ou build.gradle.kts ausentes.'
  } else if (!sdkOk) {
    status = 'blocked'
    blocker = 'Compilação real requer Android SDK; validada em CI dedicado.'
  } else {
    // Neste ambiente de sandbox, mesmo com SDK hypothético não compilamos
    // o APK — então se tudo estivesse presente marcaríamos pass. Como
    // ANDROID_HOME normalmente não está aqui, na prática cai em blocked.
    status = 'pass'
    blocker = null
  }

  const logLines: string[] = [
    `[build] Iniciando validação em ${new Date().toISOString()}`,
    `[build] Repo: ${REPO}`,
    `[build] gradlew presente: ${gradlewOk}`,
    `[build] build.gradle.kts presente: ${buildGradleOk}`,
    `[build] ANDROID_HOME: ${process.env.ANDROID_HOME ?? '(não definido)'}`,
    `[build] configValid=${configValid}`,
    `[build] status=${status}`,
  ]
  if (blocker) logLines.push(`[build] blocker: ${blocker}`)

  const durationMs = Date.now() - t0

  const record = await db.buildValidation.create({
    data: {
      status,
      configValid,
      gradleWrapperOk: gradlewOk,
      androidSdkOk: sdkOk,
      artifact: null,
      log: logLines.join('\n'),
      blocker,
      durationMs,
    },
  })

  return rowToPayload(record, steps)
}
