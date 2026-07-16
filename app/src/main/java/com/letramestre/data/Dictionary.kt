package com.letramestre.data

import android.content.Context
import com.letramestre.R
import org.json.JSONArray

/**
 * Dicionário de palavras válidas em português brasileiro.
 *
 * Single source of truth: `/shared/dictionary.pt-BR.json` (repo root). Copiar
 * para `app/src/main/res/raw/dictionary_pt_br.json` ao atualizar (o AGP gera
 * `R.raw.dictionary_pt_br` automaticamente a partir do nome snake_case).
 *
 * O dicionário NÃO é mais populado no `init {}` (o que exigiria uma lista
 * hardcoded duplicada com a versão web). Em vez disso, chame
 * [initialize] a partir de um ponto da aplicação que tenha acesso a
 * [Context] — atualmente `HomeScreen` faz isso via `LaunchedEffect`. A
 * chamada é idempotente.
 */
object Dictionary {

    private val validWords = mutableSetOf<String>()
    private val manuallyApprovedWords = mutableSetOf<String>()
    @Volatile
    private var initialized = false

    /**
     * Carrega a lista de palavras do resource raw
     * [R.raw.dictionary_pt_br] (JSON array de strings). Idempotente —
     * chamadas repetidas são no-ops. Fail-safe: em caso de erro de I/O ou
     * parse, o conjunto `validWords` permanece vazio (o jogo ainda funciona
     * via [addManuallyApprovedWord] em runtime).
     */
    fun initialize(context: Context) {
        if (initialized) return
        try {
            val json = context.resources
                .openRawResource(R.raw.dictionary_pt_br)
                .bufferedReader()
                .use { it.readText() }
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val word = arr.getString(i).uppercase().trim()
                if (word.isNotEmpty()) validWords.add(word)
            }
        } catch (_: Throwable) {
            // Fail-safe: keep empty set. The game still works via
            // addManuallyApprovedWord at runtime.
        }
        initialized = true
    }

    fun isValidWord(word: String): Boolean {
        val normalized = word.uppercase().trim()
        return normalized.length >= 2 &&
               (validWords.contains(normalized) || manuallyApprovedWords.contains(normalized))
    }

    fun addManuallyApprovedWord(word: String) {
        manuallyApprovedWords.add(word.uppercase().trim())
    }

    fun getWordCount(): Int = validWords.size + manuallyApprovedWords.size
}
