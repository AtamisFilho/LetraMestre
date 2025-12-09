package com.letramestre.model

import kotlinx.serialization.Serializable

/**
 * Tipos de bônus que uma célula do tabuleiro pode ter.
 */
@Serializable
enum class CellBonus(val label: String, val labelShort: String) {
    NONE("Normal", ""),
    DOUBLE_LETTER("Letra Dupla", "LD"),
    TRIPLE_LETTER("Letra Tripla", "LT"),
    DOUBLE_WORD("Palavra Dupla", "PD"),
    TRIPLE_WORD("Palavra Tripla", "PT"),
    CENTER("Centro", "★")
}

/**
 * Representa uma célula do tabuleiro 15x15.
 * 
 * @property row Linha da célula (0-14)
 * @property col Coluna da célula (0-14)
 * @property bonus Tipo de bônus da célula
 * @property tile Peça colocada na célula (null se vazia)
 * @property isNewlyPlaced Se a peça foi colocada neste turno
 */
@Serializable
data class BoardCell(
    val row: Int,
    val col: Int,
    val bonus: CellBonus,
    val tile: Tile? = null,
    val isNewlyPlaced: Boolean = false
)
