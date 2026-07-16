/**
 * secrets.ts — Validação de variáveis de ambiente (secrets) sem expor valores.
 *
 * Contrato: GET /api/ops/secrets/status
 *
 * Regras:
 * - NUNCA retornar o valor do secret — apenas metadados (presente/força).
 * - strength ∈ { strong, weak, missing }.
 * - overall ∈ { ok, warning, critical }.
 *   critical: algum required está missing OU é default perigoso.
 *   warning:  algum required weak (mas não default perigoso).
 *   ok:       todos os required strong.
 */

export type SecretStrength = 'strong' | 'weak' | 'missing'
export type SecretOverall = 'ok' | 'warning' | 'critical'

export interface SecretStatus {
  name: string
  required: boolean
  present: boolean
  strength: SecretStrength
  issue: string | null
  recommendation: string
}

export interface SecretsPayload {
  overall: SecretOverall
  secrets: SecretStatus[]
}

// Defaults perigosos conhecidos do LetraMestre.
const DEFAULT_AUTH_SECRET = 'dev-insecure-secret-change-me-please-16+'
const DEFAULT_INTERNAL_KEY = 'dev-internal-key-change-me'
const DEFAULT_ADMIN_PASSWORD = 'change-me-please'
const WEAK_MARKERS = ['change-me', 'insecure', 'dev-', 'changeme', 'placeholder']

function containsWeakMarker(v: string): boolean {
  const lower = v.toLowerCase()
  return WEAK_MARKERS.some((m) => lower.includes(m))
}

function isDefault(v: string, defaults: string[]): boolean {
  return defaults.includes(v)
}

function buildStatus(
  name: string,
  required: boolean,
  value: string | undefined,
  checks: {
    isDefault?: boolean
    tooShort?: boolean
    weakMarker?: boolean
  },
  issueIfWeak: string,
  recommendation: string,
): SecretStatus {
  if (!value || value.length === 0) {
    return {
      name,
      required,
      present: false,
      strength: 'missing',
      issue: 'Não definido.',
      recommendation,
    }
  }

  const isDefaultVal = checks.isDefault ?? false
  const tooShort = checks.tooShort ?? false
  const weakMarker = checks.weakMarker ?? false

  if (isDefaultVal) {
    return {
      name,
      required,
      present: true,
      strength: 'weak',
      issue: `Valor parece ser o default de desenvolvimento.`,
      recommendation,
    }
  }

  if (tooShort || weakMarker) {
    return {
      name,
      required,
      present: true,
      strength: 'weak',
      issue: issueIfWeak,
      recommendation,
    }
  }

  return {
    name,
    required,
    present: true,
    strength: 'strong',
    issue: null,
    recommendation,
  }
}

export function getSecretsStatus(): SecretsPayload {
  const env = process.env

  const authSecret = env.AUTH_SECRET
  const internalKey = env.INTERNAL_API_KEY
  const adminUser = env.ADMIN_USERNAME
  const adminPass = env.ADMIN_PASSWORD
  const databaseUrl = env.DATABASE_URL
  const webOrigin = env.WEB_ORIGIN
  const gamePort = env.GAME_SERVER_PORT

  const secrets: SecretStatus[] = []

  // AUTH_SECRET (required). weak se < 16 chars OU default OU marcador fraco.
  // strong se >= 32 chars (plus) ou pelo menos 16 sem marcador.
  secrets.push(
    buildStatus(
      'AUTH_SECRET',
      true,
      authSecret,
      {
        isDefault: !!authSecret && isDefault(authSecret, [DEFAULT_AUTH_SECRET]),
        tooShort: !!authSecret && authSecret.length < 16,
        weakMarker: !!authSecret && containsWeakMarker(authSecret),
      },
      'Secret curto ou contém marcador fraco (change-me/insecure/dev-).',
      'Gere com `openssl rand -hex 32`. Mantenha >= 32 chars, rotacione a cada 90 dias.',
    ),
  )

  // INTERNAL_API_KEY (required). weak se default ou < 16 chars.
  secrets.push(
    buildStatus(
      'INTERNAL_API_KEY',
      true,
      internalKey,
      {
        isDefault: !!internalKey && isDefault(internalKey, [DEFAULT_INTERNAL_KEY]),
        tooShort: !!internalKey && internalKey.length < 16,
        weakMarker: !!internalKey && containsWeakMarker(internalKey),
      },
      'Chave curta ou contém marcador fraco.',
      'Gere com `openssl rand -hex 32` em produção.',
    ),
  )

  // ADMIN_USERNAME (required). weak se == "admin".
  secrets.push(
    buildStatus(
      'ADMIN_USERNAME',
      true,
      adminUser,
      {
        isDefault: !!adminUser && isDefault(adminUser, ['admin']),
        weakMarker: !!adminUser && containsWeakMarker(adminUser),
      },
      "Username padrão 'admin'.",
      'Use um nome não-default e não óbvio.',
    ),
  )

  // ADMIN_PASSWORD (required). weak se < 12 chars ou default.
  secrets.push(
    buildStatus(
      'ADMIN_PASSWORD',
      true,
      adminPass,
      {
        isDefault: !!adminPass && isDefault(adminPass, [DEFAULT_ADMIN_PASSWORD]),
        tooShort: !!adminPass && adminPass.length < 12,
        weakMarker: !!adminPass && containsWeakMarker(adminPass),
      },
      'Senha curta ou default.',
      '>= 12 chars, misturando classes (maiúsculas, números, símbolos).',
    ),
  )

  // DATABASE_URL (required). strong se presente.
  secrets.push(
    buildStatus(
      'DATABASE_URL',
      true,
      databaseUrl,
      {},
      '',
      'Em produção use caminho absoluto em volume persistente.',
    ),
  )

  // WEB_ORIGIN (opcional).
  secrets.push(
    buildStatus(
      'WEB_ORIGIN',
      false,
      webOrigin,
      {},
      '',
      'Defina a origem pública para CORS/cookies.',
    ),
  )

  // GAME_SERVER_PORT (opcional).
  secrets.push(
    buildStatus(
      'GAME_SERVER_PORT',
      false,
      gamePort,
      {},
      '',
      'Padrão 3003.',
    ),
  )

  // overall
  let overall: SecretOverall = 'ok'
  for (const s of secrets) {
    if (s.required && (s.strength === 'missing')) {
      overall = 'critical'
      break
    }
    if (s.required && s.strength === 'weak' && s.issue?.includes('default')) {
      overall = 'critical'
      break
    }
  }
  if (overall !== 'critical') {
    for (const s of secrets) {
      if (s.required && s.strength === 'weak') {
        overall = 'warning'
        break
      }
    }
  }

  return { overall, secrets }
}
