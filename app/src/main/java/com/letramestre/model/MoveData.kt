package com.letramestre.model

import kotlinx.serialization.Serializable

/**
 * Representa os dados de uma jogada submetida por um jogador.
 * 
 * @property playerId ID do jogador que fez a jogada
 * @property placements Lista de posicionamentos de peças
 */
@Serializable
data class MoveData(
    val playerId: String,
    val placements: List<TilePlacement>
) {
    /**
     * Verifica se os posicionamentos estão em linha (horizontal ou vertical).
     */
    fun isValidLine(): Boolean {
        if (placements.size <= 1) return true
        
        val rows = placements.map { it.row }.distinct()
        val cols = placements.map { it.col }.distinct()
        
        return rows.size == 1 || cols.size == 1
    }
    
    /**
     * Verifica se é uma jogada horizontal.
     */
    fun isHorizontal(): Boolean {
        if (placements.size <= 1) return true
        return placements.map { it.row }.distinct().size == 1
    }
}

/**
 * Representa o posicionamento de uma peça no tabuleiro.
 */
@Serializable
data class TilePlacement(
    val row: Int,
    val col: Int,
    val tile: Tile,
    val rackIndex: Int // Índice da peça no rack do jogador
)
