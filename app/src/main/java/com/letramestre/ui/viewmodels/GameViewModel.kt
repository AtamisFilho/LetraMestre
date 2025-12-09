package com.letramestre.ui.viewmodels

import android.content.Context
import android.net.wifi.WifiManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.letramestre.game.GameManager
import com.letramestre.model.GameState
import com.letramestre.network.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * ViewModel compartilhado para gerenciamento de conexão e jogo.
 */
class GameViewModel : ViewModel() {
    private val gameManager = GameManager()
    private var gameServer: GameServer? = null
    private var gameClient: GameClient? = null
    
    private val _isHost = MutableStateFlow(false)
    val isHost = _isHost.asStateFlow()
    
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState = _connectionState.asStateFlow()
    
    private val _gameState = MutableStateFlow<GameState?>(null)
    val gameState = _gameState.asStateFlow()
    
    private val _playerList = MutableStateFlow<List<PlayerInfo>>(emptyList())
    val playerList = _playerList.asStateFlow()
    
    private val _playerId = MutableStateFlow<String?>(null)
    val playerId = _playerId.asStateFlow()
    
    private val _playerName = MutableStateFlow("")
    val playerName = _playerName.asStateFlow()
    
    private val _hostIp = MutableStateFlow("")
    val hostIp = _hostIp.asStateFlow()
    
    private val _events = MutableSharedFlow<GameEvent>()
    val events = _events.asSharedFlow()
    
    private val _selectedTileIndices = MutableStateFlow<Set<Int>>(emptySet())
    val selectedTileIndices = _selectedTileIndices.asStateFlow()
    
    fun setPlayerName(name: String) {
        _playerName.value = name
    }
    
    fun startAsHost(context: Context, port: Int = 8080) {
        _isHost.value = true
        _hostIp.value = getLocalIpAddress(context)
        
        gameServer = GameServer(gameManager).also { server ->
            server.start(port)
            
            viewModelScope.launch {
                server.connectionState.collect { _connectionState.value = it }
            }
            
            viewModelScope.launch {
                gameManager.gameState.collect { state ->
                    _gameState.value = state
                    _playerList.value = state.players.map { 
                        PlayerInfo(it.id, it.name, it.isHost) 
                    }
                }
            }
        }
        
        // Adicionar host como primeiro jogador
        val player = gameManager.addPlayer(_playerName.value)
        _playerId.value = player.id
    }
    
    fun connectAsClient(hostIp: String, port: Int = 8080) {
        _isHost.value = false
        
        gameClient = GameClient().also { client ->
            viewModelScope.launch {
                client.connectionState.collect { _connectionState.value = it }
            }
            
            viewModelScope.launch {
                client.gameState.collect { state ->
                    state?.let { _gameState.value = it }
                }
            }
            
            viewModelScope.launch {
                client.playerList.collect { _playerList.value = it }
            }
            
            viewModelScope.launch {
                client.playerId.collect { _playerId.value = it }
            }
            
            viewModelScope.launch {
                client.events.collect { event ->
                    when (event) {
                        is ClientEvent.GameStarted -> _events.emit(GameEvent.GameStarted)
                        is ClientEvent.GameOver -> _events.emit(
                            GameEvent.GameOver(event.winnerName, event.scores)
                        )
                        is ClientEvent.WordValidationRequired -> _events.emit(
                            GameEvent.WordValidation(event.word)
                        )
                        is ClientEvent.Error -> _events.emit(GameEvent.Error(event.message))
                        else -> {}
                    }
                }
            }
            
            client.connect(hostIp, port, _playerName.value)
        }
    }
    
    fun startGame() {
        gameServer?.startGame()
        viewModelScope.launch { _events.emit(GameEvent.GameStarted) }
    }
    
    fun toggleTileSelection(index: Int) {
        val current = _selectedTileIndices.value.toMutableSet()
        if (index in current) current.remove(index) else current.add(index)
        _selectedTileIndices.value = current
    }
    
    fun clearSelection() {
        _selectedTileIndices.value = emptySet()
    }
    
    fun passTurn() {
        if (_isHost.value) {
            _playerId.value?.let { gameManager.passTurn(it) }
        } else {
            gameClient?.passTurn()
        }
    }
    
    fun exchangeTiles() {
        val indices = _selectedTileIndices.value.toList()
        if (indices.isEmpty()) return
        
        if (_isHost.value) {
            _playerId.value?.let { gameManager.exchangeTiles(it, indices) }
        } else {
            gameClient?.exchangeTiles(indices)
        }
        clearSelection()
    }
    
    fun approveWord(approved: Boolean) {
        if (_isHost.value) {
            if (approved) {
                gameManager.approveWord(gameManager.gameState.value.pendingValidationWord ?: "")
            } else {
                gameManager.rejectWord()
            }
        } else {
            gameClient?.approveWord(approved)
        }
    }
    
    fun disconnect() {
        gameServer?.stop()
        gameClient?.disconnect()
        gameServer = null
        gameClient = null
        _connectionState.value = ConnectionState.Disconnected
    }
    
    private fun getLocalIpAddress(context: Context): String {
        try {
            val wifiManager = context.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as WifiManager
            val wifiInfo = wifiManager.connectionInfo
            val ipInt = wifiInfo.ipAddress
            if (ipInt != 0) {
                return String.format(
                    "%d.%d.%d.%d",
                    ipInt and 0xff,
                    (ipInt shr 8) and 0xff,
                    (ipInt shr 16) and 0xff,
                    (ipInt shr 24) and 0xff
                )
            }
        } catch (e: Exception) {}
        
        // Fallback
        try {
            NetworkInterface.getNetworkInterfaces()?.toList()?.forEach { intf ->
                intf.inetAddresses?.toList()?.forEach { addr ->
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        return addr.hostAddress ?: ""
                    }
                }
            }
        } catch (e: Exception) {}
        
        return "192.168.1.1"
    }
    
    override fun onCleared() {
        super.onCleared()
        disconnect()
    }
}

sealed class GameEvent {
    data object GameStarted : GameEvent()
    data class GameOver(val winnerName: String, val scores: Map<String, Int>) : GameEvent()
    data class WordValidation(val word: String) : GameEvent()
    data class Error(val message: String) : GameEvent()
}
