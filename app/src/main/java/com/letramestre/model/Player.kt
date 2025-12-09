package com.letramestre.model

import kotlinx.serialization.Serializable

/**
 * Representa um jogador da partida.
 * 
 * @property id Identificador único do jogador
 * @property name Nome do jogador
 * @property score Pontuação atual
 * @property rack Peças na mão do jogador (máximo 7)
 * @property isHost Se é o anfitrião da partida
 * @property isConnected Se está conectado
 */
@Serializable
data class Player(
    val id: String,
    val name: String,
    val score: Int = 0,
    val rack: List<Tile> = emptyList(),
    val isHost: Boolean = false,
    val isConnected: Boolean = true
) {
    companion object {
        const val MAX_RACK_SIZE = 7
    }
    
    /**
     * Retorna uma cópia do jogador com pontuação atualizada.
     */
    fun addScore(points: Int): Player = copy(score = score + points)
    
    /**
     * Retorna uma cópia do jogador com rack atualizado.
     */
    fun withRack(newRack: List<Tile>): Player = copy(rack = newRack)
    
    /**
     * Remove peças do rack pelos índices.
     */
    fun removeTilesAt(indices: List<Int>): Player {
        val newRack = rack.filterIndexed { index, _ -> index !in indices }
        return copy(rack = newRack)
    }
    
    /**
     * Adiciona peças ao rack.
     */
    fun addTiles(tiles: List<Tile>): Player {
        val newRack = (rack + tiles).take(MAX_RACK_SIZE)
        return copy(rack = newRack)
    }
}
