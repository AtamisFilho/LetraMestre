package com.letramestre.network

import com.letramestre.model.GameState
import com.letramestre.model.MoveData
import io.ktor.client.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.plugins.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Cliente de jogo para dispositivos que se conectam ao Host.
 */
class GameClient {
    private var client: HttpClient? = null
    private var session: WebSocketSession? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState = _connectionState.asStateFlow()
    
    private val _gameState = MutableStateFlow<GameState?>(null)
    val gameState = _gameState.asStateFlow()
    
    private val _playerId = MutableStateFlow<String?>(null)
    val playerId = _playerId.asStateFlow()
    
    private val _playerList = MutableStateFlow<List<PlayerInfo>>(emptyList())
    val playerList = _playerList.asStateFlow()
    
    private val _events = MutableSharedFlow<ClientEvent>()
    val events = _events.asSharedFlow()
    
    fun connect(hostIp: String, port: Int, playerName: String) {
        _connectionState.value = ConnectionState.Connecting
        
        client = HttpClient(OkHttp) {
            install(WebSockets) {
                pingInterval = 15_000
            }
        }
        
        scope.launch {
            try {
                client?.webSocket(host = hostIp, port = port, path = "/game") {
                    session = this
                    _connectionState.value = ConnectionState.Connected(hostIp, port)
                    
                    // Enviar pedido de entrada
                    send(NetworkMessage.serialize(NetworkMessage.JoinRequest(playerName)))
                    
                    // Receber mensagens
                    for (frame in incoming) {
                        if (frame is Frame.Text) {
                            handleMessage(frame.readText())
                        }
                    }
                }
            } catch (e: Exception) {
                _connectionState.value = ConnectionState.Error(e.message ?: "Erro de conexão")
            } finally {
                _connectionState.value = ConnectionState.Disconnected
            }
        }
    }
    
    private suspend fun handleMessage(text: String) {
        when (val message = NetworkMessage.deserialize(text)) {
            is NetworkMessage.JoinAccepted -> {
                _playerId.value = message.playerId
                _events.emit(ClientEvent.Joined(message.playerId, message.playerName))
            }
            
            is NetworkMessage.PlayerList -> {
                _playerList.value = message.players
                _events.emit(ClientEvent.PlayerListUpdated(message.players))
            }
            
            is NetworkMessage.GameStarted -> {
                _gameState.value = message.gameState
                _events.emit(ClientEvent.GameStarted)
            }
            
            is NetworkMessage.GameStateUpdate -> {
                _gameState.value = message.gameState
                _events.emit(ClientEvent.StateUpdated)
            }
            
            is NetworkMessage.WordValidationRequest -> {
                _events.emit(ClientEvent.WordValidationRequired(message.word, message.fromPlayerId))
            }
            
            is NetworkMessage.GameEnded -> {
                _events.emit(ClientEvent.GameOver(message.winnerId, message.winnerName, message.scores))
            }
            
            is NetworkMessage.ErrorMessage -> {
                _events.emit(ClientEvent.Error(message.message))
            }
            
            else -> {}
        }
    }
    
    fun submitMove(moveData: MoveData) {
        scope.launch {
            session?.send(NetworkMessage.serialize(NetworkMessage.MoveSubmit(moveData)))
        }
    }
    
    fun passTurn() {
        val id = _playerId.value ?: return
        scope.launch {
            session?.send(NetworkMessage.serialize(NetworkMessage.PassTurn(id)))
        }
    }
    
    fun exchangeTiles(indices: List<Int>) {
        val id = _playerId.value ?: return
        scope.launch {
            session?.send(NetworkMessage.serialize(NetworkMessage.ExchangeTiles(id, indices)))
        }
    }
    
    fun approveWord(approved: Boolean) {
        val id = _playerId.value ?: return
        scope.launch {
            session?.send(NetworkMessage.serialize(NetworkMessage.WordApproval(id, approved)))
        }
    }
    
    fun disconnect() {
        scope.launch {
            session?.close()
            client?.close()
            session = null
            client = null
            _connectionState.value = ConnectionState.Disconnected
        }
    }
}

/**
 * Eventos emitidos pelo cliente.
 */
sealed class ClientEvent {
    data class Joined(val playerId: String, val playerName: String) : ClientEvent()
    data class PlayerListUpdated(val players: List<PlayerInfo>) : ClientEvent()
    data object GameStarted : ClientEvent()
    data object StateUpdated : ClientEvent()
    data class WordValidationRequired(val word: String, val fromPlayerId: String) : ClientEvent()
    data class GameOver(val winnerId: String, val winnerName: String, val scores: Map<String, Int>) : ClientEvent()
    data class Error(val message: String) : ClientEvent()
}
