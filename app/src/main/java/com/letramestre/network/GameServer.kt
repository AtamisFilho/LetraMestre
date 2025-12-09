package com.letramestre.network

import com.letramestre.game.GameManager
import com.letramestre.game.MoveValidation
import com.letramestre.model.GamePhase
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

/**
 * Servidor de jogo que roda no dispositivo Host.
 */
class GameServer(private val gameManager: GameManager) {
    private var server: EmbeddedServer<*, *>? = null
    private val clients = ConcurrentHashMap<String, WebSocketSession>()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState = _connectionState.asStateFlow()
    
    private val _serverPort = MutableStateFlow(8080)
    val serverPort = _serverPort.asStateFlow()
    
    fun start(port: Int = 8080) {
        _serverPort.value = port
        server = embeddedServer(Netty, port = port) {
            install(WebSockets) {
                pingPeriod = Duration.ofSeconds(15)
                timeout = Duration.ofSeconds(15)
                maxFrameSize = Long.MAX_VALUE
                masking = false
            }
            
            routing {
                webSocket("/game") {
                    handleClientConnection(this)
                }
            }
        }
        
        scope.launch {
            try {
                server?.start(wait = false)
                _connectionState.value = ConnectionState.Connected("", port)
            } catch (e: Exception) {
                _connectionState.value = ConnectionState.Error(e.message ?: "Erro ao iniciar servidor")
            }
        }
    }
    
    private suspend fun handleClientConnection(session: WebSocketSession) {
        var playerId: String? = null
        
        try {
            for (frame in session.incoming) {
                if (frame is Frame.Text) {
                    val text = frame.readText()
                    val message = NetworkMessage.deserialize(text)
                    playerId = handleMessage(message, session, playerId)
                }
            }
        } catch (e: Exception) {
            // Cliente desconectado
        } finally {
            playerId?.let { clients.remove(it) }
            broadcastPlayerList()
        }
    }
    
    private suspend fun handleMessage(
        message: NetworkMessage,
        session: WebSocketSession,
        currentPlayerId: String?
    ): String? {
        return when (message) {
            is NetworkMessage.JoinRequest -> {
                val player = gameManager.addPlayer(message.playerName)
                clients[player.id] = session
                
                session.send(NetworkMessage.serialize(
                    NetworkMessage.JoinAccepted(player.id, player.name)
                ))
                broadcastPlayerList()
                player.id
            }
            
            is NetworkMessage.MoveSubmit -> {
                when (val validation = gameManager.validateMove(message.moveData)) {
                    is MoveValidation.Valid -> {
                        gameManager.processValidMove(message.moveData, validation.score)
                        broadcastGameState()
                    }
                    is MoveValidation.InvalidWord -> {
                        // Solicitar validação manual
                        broadcastToAll(NetworkMessage.WordValidationRequest(
                            validation.word,
                            message.moveData.playerId
                        ))
                    }
                    is MoveValidation.InvalidPlacement -> {
                        session.send(NetworkMessage.serialize(
                            NetworkMessage.ErrorMessage(validation.reason)
                        ))
                    }
                }
                currentPlayerId
            }
            
            is NetworkMessage.PassTurn -> {
                gameManager.passTurn(message.playerId)
                broadcastGameState()
                currentPlayerId
            }
            
            is NetworkMessage.ExchangeTiles -> {
                gameManager.exchangeTiles(message.playerId, message.tileIndices)
                broadcastGameState()
                currentPlayerId
            }
            
            is NetworkMessage.WordApproval -> {
                if (message.approved) {
                    gameManager.approveWord(gameManager.gameState.value.pendingValidationWord ?: "")
                } else {
                    gameManager.rejectWord()
                }
                broadcastGameState()
                currentPlayerId
            }
            
            is NetworkMessage.Ping -> {
                session.send(NetworkMessage.serialize(NetworkMessage.Pong))
                currentPlayerId
            }
            
            else -> currentPlayerId
        }
    }
    
    fun startGame() {
        val playerNames = gameManager.gameState.value.players.map { it.name }
        gameManager.startGame(playerNames)
        broadcastGameState()
    }
    
    private fun broadcastGameState() {
        val state = gameManager.gameState.value
        
        if (state.phase == GamePhase.GAME_OVER) {
            val winner = state.getWinner()
            val scores = state.players.associate { it.id to it.score }
            broadcastToAll(NetworkMessage.GameEnded(
                winner?.id ?: "",
                winner?.name ?: "",
                scores
            ))
        } else {
            // Enviar estado personalizado para cada jogador (só mostrar seu rack)
            scope.launch {
                clients.forEach { (playerId, session) ->
                    val personalizedState = state.copy(
                        players = state.players.map { player ->
                            if (player.id == playerId) player
                            else player.copy(rack = emptyList())
                        }
                    )
                    session.send(NetworkMessage.serialize(
                        NetworkMessage.GameStateUpdate(personalizedState)
                    ))
                }
            }
        }
    }
    
    private fun broadcastPlayerList() {
        val players = gameManager.gameState.value.players.map {
            PlayerInfo(it.id, it.name, it.isHost)
        }
        broadcastToAll(NetworkMessage.PlayerList(players))
    }
    
    private fun broadcastToAll(message: NetworkMessage) {
        scope.launch {
            val data = NetworkMessage.serialize(message)
            clients.values.forEach { session ->
                try {
                    session.send(data)
                } catch (e: Exception) {
                    // Ignorar erros de envio
                }
            }
        }
    }
    
    fun stop() {
        scope.launch {
            clients.values.forEach { it.close() }
            clients.clear()
            server?.stop(1000, 2000)
            server = null
            _connectionState.value = ConnectionState.Disconnected
        }
    }
}
