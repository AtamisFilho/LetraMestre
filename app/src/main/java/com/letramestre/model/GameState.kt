package com.letramestre.model

import kotlinx.serialization.Serializable

/**
 * Fase atual do jogo.
 */
@Serializable
enum class GamePhase {
    WAITING_FOR_PLAYERS, // Aguardando jogadores no lobby
    IN_PROGRESS,         // Jogo em andamento
    VALIDATION_PENDING,  // Aguardando validação manual de palavra
    GAME_OVER           // Jogo finalizado
}

/**
 * Estado completo do jogo.
 * 
 * @property board Estado atual do tabuleiro
 * @property players Lista de jogadores
 * @property currentPlayerIndex Índice do jogador atual
 * @property tileBagCount Quantidade de peças restantes no saco
 * @property phase Fase atual do jogo
 * @property lastPlayedWord Última palavra jogada (para exibição)
 * @property consecutivePasses Número de passes consecutivos
 * @property pendingValidationWord Palavra aguardando validação manual
 * @property pendingValidationPlayerId ID do jogador aguardando validação
 */
@Serializable
data class GameState(
    val board: Board,
    val players: List<Player>,
    val currentPlayerIndex: Int = 0,
    val tileBagCount: Int = 0,
    val phase: GamePhase = GamePhase.WAITING_FOR_PLAYERS,
    val lastPlayedWord: String? = null,
    val lastPlayedScore: Int = 0,
    val consecutivePasses: Int = 0,
    val pendingValidationWord: String? = null,
    val pendingValidationPlayerId: String? = null,
    val pendingMoveData: MoveData? = null
) {
    /**
     * Retorna o jogador atual.
     */
    fun getCurrentPlayer(): Player? {
        return players.getOrNull(currentPlayerIndex)
    }
    
    /**
     * Avança para o próximo jogador.
     */
    fun nextPlayer(): GameState {
        val nextIndex = (currentPlayerIndex + 1) % players.size
        return copy(currentPlayerIndex = nextIndex)
    }
    
    /**
     * Verifica se o jogo deve terminar.
     * O jogo termina quando:
     * - Um jogador fica sem peças e o saco está vazio
     * - Todos os jogadores passam consecutivamente (2 rodadas)
     */
    fun shouldEndGame(): Boolean {
        // Todos passaram duas rodadas
        if (consecutivePasses >= players.size * 2) return true
        
        // Jogador ficou sem peças e saco vazio
        val playerWithoutTiles = players.find { it.rack.isEmpty() }
        if (playerWithoutTiles != null && tileBagCount == 0) return true
        
        return false
    }
    
    /**
     * Retorna o vencedor (jogador com maior pontuação).
     */
    fun getWinner(): Player? {
        return players.maxByOrNull { it.score }
    }
    
    /**
     * Encontra um jogador pelo ID.
     */
    fun getPlayerById(playerId: String): Player? {
        return players.find { it.id == playerId }
    }
    
    /**
     * Atualiza um jogador na lista.
     */
    fun updatePlayer(player: Player): GameState {
        val newPlayers = players.map { 
            if (it.id == player.id) player else it 
        }
        return copy(players = newPlayers)
    }
}
