#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# LetraMestre — Helper de Release
# ════════════════════════════════════════════════════════════════════════════
#
# Uso:
#   ./scripts/release.sh <version> <type> [<type-arg>]
#
#   version — versão SemVer a ser criada (ex.: 0.3.1)
#   type    — patch | minor | major (apenas informativo; registrado no commit)
#
# O que faz:
#   1. Valida formato SemVer de <version>.
#   2. Pede confirmação interativa.
#   3. Faz bump de versão no package.json (campo "version").
#   4. Cria commit "chore(release): vX.Y.Z".
#   5. Cria tag anotada "vX.Y.Z".
#   6. NÃO faz push automaticamente — apenas imprime o comando sugerido.
#
# Pré-requisitos:
#   - Estar em branch main (ou develop).
#   - working tree limpa (sem mudanças não commitadas).
#   - git configurado (user.name, user.email).
#
# Saída:
#   0 — sucesso.
#   1 — erro de validação ou cancelado pelo usuário.
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Helpers ─────────────────────────────────────────────────────────────────

RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
CYAN=$'\033[36m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

info()  { printf "%s[release]%s %s\n" "$CYAN" "$RESET" "$1"; }
ok()    { printf "%s[release]%s %s%s%s\n" "$CYAN" "$RESET" "$GREEN" "$1" "$RESET"; }
warn()  { printf "%s[release] ⚠ %s%s%s\n" "$YELLOW" "$1" "$RESET"; }
err()   { printf "%s[release] ✗ %s%s%s\n" "$RED" "$1" "$RESET" >&2; }

# ─── Validação de args ───────────────────────────────────────────────────────

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  sed -n '2,30p' "$0"
  exit 0
fi

VERSION="${1:-}"
TYPE="${2:-}"

if [[ -z "$VERSION" ]]; then
  err "Uso: $0 <version> <type>"
  err "Ex.:  $0 0.3.1 patch"
  exit 1
fi

if [[ -z "$TYPE" ]]; then
  err "Tipo de release ausente. Use: patch | minor | major"
  err "Ex.:  $0 $VERSION patch"
  exit 1
fi

if [[ ! "$TYPE" =~ ^(patch|minor|major)$ ]]; then
  err "Tipo inválido: '$TYPE'. Use: patch | minor | major"
  exit 1
fi

# Validação SemVer (sem sufixo de pré-release por simplicidade)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  err "Versão inválida (SemVer): '$VERSION'"
  err "Esperado: MAJOR.MINOR.PATCH (ex.: 0.3.1, 1.0.0-rc.1)"
  exit 1
fi

# ─── Pré-condições ───────────────────────────────────────────────────────────

# Diretório do projeto = um nível acima de scripts/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [[ ! -f "package.json" ]]; then
  err "package.json não encontrado em $PROJECT_DIR"
  err "Rode este script a partir da raiz do projeto."
  exit 1
fi

if ! command -v git &>/dev/null; then
  err "git não está instalado."
  exit 1
fi

# Working tree limpa
if [[ -n "$(git status --porcelain)" ]]; then
  err "Working tree não está limpa. Commit ou stash suas mudanças antes do release."
  git status --short
  exit 1
fi

# Branch atual
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" && "$BRANCH" != "develop" && "$BRANCH" != release/* ]]; then
  warn "Branch atual: '$BRANCH'. Recomendado: main, develop ou release/*."
  read -rp "Continuar mesmo assim? [y/N] " ans
  [[ "$ans" =~ ^[yY](es|im)?$ ]] || { info "Cancelado."; exit 1; }
fi

# Versão atual
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "?")
TAG="v$VERSION"

if git rev-parse "$TAG" &>/dev/null; then
  err "Tag '$TAG' já existe."
  err "Use uma versão maior ou remova a tag existente (NUNCA remova tags já pushadas)."
  exit 1
fi

# ─── Resumo + confirmação ────────────────────────────────────────────────────

echo ""
info "${BOLD}Resumo do release${RESET}"
echo "  Versão atual:  $CURRENT_VERSION"
echo "  Nova versão:   $VERSION"
echo "  Tag:           $TAG"
echo "  Tipo:          $TYPE"
echo "  Branch:        $BRANCH"
echo "  Projeto:       $PROJECT_DIR"
echo ""
warn "Lembrete: atualize o CHANGELOG.md (mova itens de [Unreleased] para [$VERSION])."
echo ""

read -rp "Confirma o release $TAG? [y/N] " ans
[[ "$ans" =~ ^[yY](es|im)?$ ]] || { info "Cancelado."; exit 1; }

# ─── Bump de versão no package.json ──────────────────────────────────────────

info "Atualizando versão no package.json ($CURRENT_VERSION → $VERSION)..."

# Usa node para preservar formatação JSON
node -e "
  const fs = require('fs');
  const path = './package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = process.argv[1];
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
" "$VERSION"

ok "package.json atualizado."

# ─── Commit + tag ────────────────────────────────────────────────────────────

info "Criando commit 'chore(release): $TAG'..."
git add package.json
git commit -m "chore(release): $TAG" -m "Type: $TYPE" -m "Versão anterior: $CURRENT_VERSION" >/dev/null

info "Criando tag anotada '$TAG'..."
git tag -a "$TAG" -m "Release $TAG" -m "Tipo: $TYPE" -m "Versão anterior: $CURRENT_VERSION"

ok "Release $TAG criada localmente."
echo ""

# ─── Próximos passos ─────────────────────────────────────────────────────────

echo "${BOLD}Próximos passos manuais:${RESET}"
echo ""
echo "  1. Verifique o commit e a tag:"
echo "     ${CYAN}git log -1 --stat${RESET}"
echo "     ${CYAN}git show $TAG${RESET}"
echo ""
echo "  2. (Opcional) Atualize o CHANGELOG.md se ainda não fez:"
echo "     ${CYAN}\$EDITOR CHANGELOG.md${RESET}"
echo "     ${CYAN}git add CHANGELOG.md && git commit --amend --no-edit && git tag -f $TAG${RESET}"
echo ""
echo "  3. Faça push do commit e da tag:"
echo "     ${CYAN}git push origin $BRANCH${RESET}"
echo "     ${CYAN}git push origin $TAG${RESET}"
echo ""
echo "  4. Aguarde o CI (.github/workflows/ci.yml) ficar verde."
echo ""
echo "  5. Para releases Android, o workflow .github/workflows/android.yml"
echo "     dispara automaticamente no push da tag v*."
echo ""
echo "  6. Anuncie o release via POST /api/ops/release/tag no Console de Operações."
echo ""
ok "Release $TAG pronta para push."
