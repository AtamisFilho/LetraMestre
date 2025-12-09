package com.letramestre.model

import kotlinx.serialization.Serializable

/**
 * Representa uma peça do jogo (letra).
 * 
 * @property letter Letra representada pela peça (ou ' ' para curinga)
 * @property value Valor em pontos da peça
 * @property isBlank Se é uma peça em branco (curinga)
 * @property assignedLetter Letra atribuída se for curinga
 */
@Serializable
data class Tile(
    val letter: Char,
    val value: Int,
    val isBlank: Boolean = false,
    val assignedLetter: Char? = null
) {
    /**
     * Retorna a letra efetiva (considerando curinga com letra atribuída)
     */
    fun getEffectiveLetter(): Char {
        return if (isBlank && assignedLetter != null) assignedLetter else letter
    }
    
    companion object {
        fun createBlank(): Tile = Tile(letter = ' ', value = 0, isBlank = true)
    }
}
