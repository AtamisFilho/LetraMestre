package com.letramestre

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.letramestre.model.GamePhase
import com.letramestre.network.ConnectionState
import com.letramestre.ui.screens.*
import com.letramestre.ui.theme.LetraMestreTheme
import com.letramestre.ui.viewmodels.GameEvent
import com.letramestre.ui.viewmodels.GameViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LetraMestreTheme {
                LetraMestreApp()
            }
        }
    }
}

@Composable
fun LetraMestreApp(viewModel: GameViewModel = viewModel()) {
    val context = LocalContext.current
    val connectionState by viewModel.connectionState.collectAsState()
    val gameState by viewModel.gameState.collectAsState()
    val playerList by viewModel.playerList.collectAsState()
    val playerId by viewModel.playerId.collectAsState()
    val isHost by viewModel.isHost.collectAsState()
    val hostIp by viewModel.hostIp.collectAsState()
    val selectedTileIndices by viewModel.selectedTileIndices.collectAsState()
    
    var currentScreen by remember { mutableStateOf(Screen.HOME) }
    var showWordValidation by remember { mutableStateOf<String?>(null) }
    var showGameOver by remember { mutableStateOf<Pair<String, Map<String, Int>>?>(null) }
    
    // Observar eventos
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is GameEvent.GameStarted -> currentScreen = Screen.GAME
                is GameEvent.GameOver -> showGameOver = event.winnerName to event.scores
                is GameEvent.WordValidation -> showWordValidation = event.word
                is GameEvent.Error -> { /* TODO: Mostrar erro */ }
            }
        }
    }
    
    // Navegação baseada em estado de conexão
    LaunchedEffect(connectionState, gameState) {
        when {
            connectionState is ConnectionState.Connected && 
                gameState?.phase == GamePhase.IN_PROGRESS -> {
                currentScreen = Screen.GAME
            }
            connectionState is ConnectionState.Connected && 
                gameState?.phase == GamePhase.WAITING_FOR_PLAYERS -> {
                currentScreen = Screen.LOBBY
            }
        }
    }
    
    // Diálogo de validação de palavra
    showWordValidation?.let { word ->
        WordValidationDialog(
            word = word,
            onApprove = {
                viewModel.approveWord(true)
                showWordValidation = null
            },
            onReject = {
                viewModel.approveWord(false)
                showWordValidation = null
            }
        )
    }
    
    // Diálogo de fim de jogo
    showGameOver?.let { (winner, scores) ->
        GameOverDialog(
            winnerName = winner,
            scores = scores,
            onDismiss = {
                showGameOver = null
                viewModel.disconnect()
                currentScreen = Screen.HOME
            }
        )
    }
    
    // Telas
    when (currentScreen) {
        Screen.HOME -> {
            HomeScreen(
                onHostClick = { currentScreen = Screen.CONNECTION_HOST },
                onClientClick = { currentScreen = Screen.CONNECTION_CLIENT },
                modifier = Modifier.fillMaxSize()
            )
        }
        
        Screen.CONNECTION_HOST -> {
            ConnectionScreen(
                isHost = true,
                hostIp = hostIp,
                onConnect = { name, _ ->
                    viewModel.setPlayerName(name)
                    viewModel.startAsHost(context)
                    currentScreen = Screen.LOBBY
                },
                onBack = { currentScreen = Screen.HOME }
            )
        }
        
        Screen.CONNECTION_CLIENT -> {
            ConnectionScreen(
                isHost = false,
                hostIp = "",
                onConnect = { name, ip ->
                    viewModel.setPlayerName(name)
                    viewModel.connectAsClient(ip)
                    currentScreen = Screen.LOBBY
                },
                onBack = { currentScreen = Screen.HOME }
            )
        }
        
        Screen.LOBBY -> {
            LobbyScreen(
                isHost = isHost,
                players = playerList,
                hostIp = hostIp,
                onStartGame = { viewModel.startGame() }
            )
        }
        
        Screen.GAME -> {
            gameState?.let { state ->
                GameScreen(
                    gameState = state,
                    playerId = playerId ?: "",
                    selectedTileIndices = selectedTileIndices,
                    onCellClick = { row, col ->
                        // TODO: Implementar lógica de colocar peça
                    },
                    onTileClick = { index ->
                        viewModel.toggleTileSelection(index)
                    },
                    onConfirmMove = {
                        // TODO: Implementar confirmação de jogada
                    },
                    onPassTurn = { viewModel.passTurn() },
                    onExchangeTiles = { viewModel.exchangeTiles() }
                )
            }
        }
    }
}

enum class Screen {
    HOME, CONNECTION_HOST, CONNECTION_CLIENT, LOBBY, GAME
}
