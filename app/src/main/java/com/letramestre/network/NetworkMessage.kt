package com.letramestre.network

import com.letramestre.model.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Tipos de mensagens trocadas entre Host e Clientes.
 */
@Serializable
sealed class NetworkMessage {
    companion object {
        private val json = Json { 
            ignoreUnknownKeys = true 
            encodeDefaults = true
        }
        
        fun serialize(message: NetworkMessage): String = json.encodeToString(serializer(), message)
        fun deserialize(data: String): NetworkMessage = json.decodeFromString(serializer(), data)
    }
    
    // Cliente -> Host
    @Serializable
    data class JoinRequest(val playerName: String) : NetworkMessage()
    
    @Serializable
    data class MoveSubmit(val moveData: MoveData) : NetworkMessage()
    
    @Serializable
    data class PassTurn(val playerId: String) : NetworkMessage()
    
    @Serializable
    data class ExchangeTiles(val playerId: String, val tileIndices: List<Int>) : NetworkMessage()
    
    @Serializable
    data class WordApproval(val playerId: String, val approved: Boolean) : NetworkMessage()
    
    // Host -> Cliente
    @Serializable
    data class JoinAccepted(val playerId: String, val playerName: String) : NetworkMessage()
    
    @Serializable
    data class PlayerList(val players: List<PlayerInfo>) : NetworkMessage()
    
    @Serializable
    data class GameStarted(val gameState: GameState) : NetworkMessage()
    
    @Serializable
    data class GameStateUpdate(val gameState: GameState) : NetworkMessage()
    
    @Serializable
    data class WordValidationRequest(val word: String, val fromPlayerId: String) : NetworkMessage()
    
    @Serializable
    data class GameEnded(val winnerId: String, val winnerName: String, val scores: Map<String, Int>) : NetworkMessage()
    
    @Serializable
    data class ErrorMessage(val message: String) : NetworkMessage()
    
    @Serializable
    data object Ping : NetworkMessage()
    
    @Serializable
    data object Pong : NetworkMessage()
}

@Serializable
data class PlayerInfo(
    val id: String,
    val name: String,
    val isHost: Boolean = false
)
