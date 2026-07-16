# Build Android — LetraMestre

Guia de build e validação do APK Android do LetraMestre. O código-fonte
está em `app/` (Kotlin + Jetpack Compose), Gradle Kotlin DSL.

> **Código-fonte de referência**: https://github.com/AtamisFilho/LetraMestre
> (clone em `/tmp/LetraMestre`).

---

## 1. Pré-requisitos

| Componente       | Versão    | Observação                                          |
| ---------------- | --------- | --------------------------------------------------- |
| Android SDK      | API 34+   | `ANDROID_HOME` definido.                            |
| JDK              | 17        | Necessário para Gradle 8+.                          |
| Gradle           | 8.x       | Via wrapper (`./gradlew`); não instalar global.     |
| Kotlin           | 1.9+      | Definido em `build.gradle.kts`.                     |
| Android Studio   | Hedgehog+ | Recomendado para dev local (opcional).              |

### Variáveis de ambiente

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Adicione ao `~/.bashrc` ou `~/.zshrc`.

### Verificar instalação

```bash
java -version          # openjdk 17.x
echo $ANDROID_HOME     # /home/usuario/Android/Sdk
adb --version          # Android Debug Bridge
```

---

## 2. Build debug

```bash
cd app

# Limpar builds anteriores (opcional, recomendado após mudar branch)
./gradlew clean

# Build debug APK
./gradlew assembleDebug
```

### Artefato gerado

```
app/build/outputs/apk/debug/app-debug.apk
```

### Instalar em device/emulador

```bash
# Listar devices conectados
adb devices

# Instalar
adb install app/build/outputs/apk/debug/app-debug.apk

# Abrir o app (substitua o package pelo correto do projeto)
adb shell am start -n com.letramestre/.MainActivity
```

---

## 3. Build release

Releases exigem **assinatura** (keystore). Gere uma keystore única e mantenha-a
em local seguro (NÃO commit no repositório).

### Gerar keystore (uma única vez)

```bash
keytool -genkeypair \
  -v \
  -keystore letramestre-release.keystore \
  -alias letramestre \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass <senha-da-keystore> \
  -keypass <senha-da-chave>
```

### Configurar assinatura em `app/build.gradle.kts`

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("LETRAMESTRE_KEYSTORE") ?: "letramestre-release.keystore")
            storePassword = System.getenv("LETRAMESTRE_STORE_PASSWORD")
            keyAlias = System.getenv("LETRAMESTRE_KEY_ALIAS") ?: "letramestre"
            keyPassword = System.getenv("LETRAMESTRE_KEY_PASSWORD")
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

### Build release

```bash
# Definir variáveis no shell (NÃO exportar para logs/CI logs públicos)
export LETRAMESTRE_KEYSTORE=/caminho/seguro/letramestre-release.keystore
export LETRAMESTRE_STORE_PASSWORD=...
export LETRAMESTRE_KEY_ALIAS=letramestre
export LETRAMESTRE_KEY_PASSWORD=...

./gradlew assembleRelease
```

### Artefato gerado

```
app/build/outputs/apk/release/app-release.apk
```

> Para publicação na Play Store, use `./gradlew bundleRelease` (gera AAB).

---

## 4. Validação no CI

O workflow `.github/workflows/android.yml` roda automaticamente em push de
tag `v*`. Ele:

1. Faz checkout do código.
2. Configura JDK 17.
3. Configura Android SDK.
4. Roda `./gradlew assembleDebug`.
5. Faz upload do APK como artifact (downloadável no GitHub Actions).

```bash
# Disparo manual do workflow (via tag)
git tag v0.3.1-rc.1
git push origin v0.3.1-rc.1
```

> Consulte `.github/workflows/android.yml` para detalhes de execução.

---

## 5. Limitação deste ambiente

O ambiente de preview em `/home/z/my-project` **não tem Android SDK instalado**.
A validação local do build Android é limitada à verificação de **configuração**:

| Etapa                | Disponível | Observação                                            |
| -------------------- | ---------- | ----------------------------------------------------- |
| Gradle wrapper       | ✅          | `gradlew`, `gradlew.bat`, `gradle/wrapper/` presentes.|
| `build.gradle.kts`   | ✅          | Sintaxe válida (parse).                               |
| `settings.gradle.kts`| ✅          | Sintaxe válida.                                       |
| Android SDK          | ❌          | `ANDROID_HOME` não definido.                          |
| `assembleDebug`      | ❌          | Requer SDK; executado em CI dedicado.                 |

### O que o Console de Operações valida

O endpoint `GET /api/ops/build/android/status` retorna o status real:

```json
{
  "status": "blocked",
  "configValid": true,
  "gradleWrapperPresent": true,
  "androidSdkAvailable": false,
  "steps": [
    { "name": "Gradle wrapper", "ok": true, "detail": "gradlew executável presente" },
    { "name": "build.gradle.kts", "ok": true, "detail": "Sintaxe válida" },
    { "name": "Android SDK", "ok": false, "detail": "ANDROID_HOME não definido neste ambiente" },
    { "name": "assembleDebug", "ok": false, "detail": "Requer SDK Android" }
  ],
  "blocker": "Compilação real requer Android SDK; validada em CI dedicado."
}
```

> A compilação real do APK deve ser executada em **CI dedicado** (runner com
> Android SDK) ou em máquina dev com Android Studio. O Console sinaliza
> `blocked` até que um APK verde seja reportado pelo CI.

---

## 6. Instalação do APK

### Em device físico

1. Habilite **Depuração USB** em Configurações → Desenvolvedor.
2. Conecte via USB; confira `adb devices`.
3. `adb install app-debug.apk` (ou `-r` para reinstalar mantendo dados).

### Emulador

```bash
# Listar AVDs disponíveis
emulator -list-avds

# Iniciar emulador
emulator -avd Pixel_6_API_34 &

# Instalar
adb install app-debug.apk
```

### Via URL (PWA alternativa)

O LetraMestre também é uma **PWA instalável** — usuários sem acesso à Play
Store podem instalar diretamente do navegador (Chrome/Edge no Android).

---

## 7. Troubleshooting

### `SDK location not found`

Defina `ANDROID_HOME` ou crie `local.properties`:

```
sdk.dir=/home/usuario/Android/Sdk
```

> NÃO commite `local.properties` (já está no `.gitignore` padrão).

### `Failed to install app-debug.apk: Failure [INSTALL_FAILED_OLDER_SDK]`

O `minSdkVersion` no `build.gradle.kts` é maior que a API do device. Use um
device/emulador mais recente, ou baixe o `minSdkVersion` (com impacto em
compatibilidade).

### `OutOfMemoryError` no Gradle

Aumente o heap no `gradle.properties`:

```
org.gradle.jvmargs=-Xmx4g
```

---

## Referências

- `.github/workflows/android.yml` — pipeline de CI.
- `docs/PHASE0.md` — tarefa 0.3 (critério de saída `android-build`).
- Android Studio: https://developer.android.com/studio
- Gradle Kotlin DSL: https://docs.gradle.org/current/userguide/kotlin_dsl.html
