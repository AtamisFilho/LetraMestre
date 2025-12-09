package com.letramestre.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.letramestre.model.GameState
import com.letramestre.model.Tile
import com.letramestre.ui.components.*
import com.letramestre.ui.theme.*

/**
 * Tela principal do jogo.
 */
@Composable
fun GameScreen(
    gameState: GameState,
    playerId: String,
    selectedTileIndices: Set<Int>,
    onCellClick: (row: Int, col: Int) -> Unit,
    onTileClick: (index: Int) -> Unit,
    onConfirmMove: () -> Unit,
    onPassTurn: () -> Unit,
    onExchangeTiles: () -> Unit,
    modifier: Modifier = Modifier
) {
    val currentPlayer = gameState.getCurrentPlayer()
    val myPlayer = gameState.players.find { it.id == playerId }
    val isMyTurn = currentPlayer?.id == playerId
    
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Background)
    ) {
        // Placar
        ScoreBoard(
            players = gameState.players,
            currentPlayerId = currentPlayer?.id
        )
        
        // Indicador de turno
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = if (isMyTurn) Accent else Primary.copy(alpha = 0.3f)
        ) {
            Text(
                text = if (isMyTurn) "Sua vez de jogar!" else "Vez de ${currentPlayer?.name ?: ""}",
                color = OnPrimary,
                fontSize = 14.sp,
                modifier = Modifier.padding(8.dp)
            )
        }
        
        // Tabuleiro
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            BoardView(
                board = gameState.board,
                onCellClick = { row, col ->
                    if (isMyTurn) onCellClick(row, col)
                }
            )
        }
        
        // Rack do jogador
        myPlayer?.let { player ->
            RackView(
                tiles = player.rack,
                selectedIndices = selectedTileIndices,
                onTileClick = { if (isMyTurn) onTileClick(it) },
                modifier = Modifier.padding(8.dp)
            )
        }
        
        // Botões de ação
        if (isMyTurn) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onPassTurn,
                    modifier = Modifier.weight(1f)
                ) { Text("Passar") }
                
                OutlinedButton(
                    onClick = onExchangeTiles,
                    modifier = Modifier.weight(1f),
                    enabled = selectedTileIndices.isNotEmpty() && gameState.tileBagCount >= selectedTileIndices.size
                ) { Text("Trocar") }
                
                Button(
                    onClick = onConfirmMove,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent)
                ) { Text("Confirmar") }
            }
        }
        
        // Info do saco
        Text(
            text = "Peças restantes: ${gameState.tileBagCount}",
            color = OnBackground.copy(alpha = 0.6f),
            fontSize = 12.sp,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .padding(bottom = 8.dp)
        )
    }
}

/**
 * Diálogo de validação manual de palavra.
 */
@Composable
fun WordValidationDialog(
    word: String,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    Dialog(onDismissRequest = {}) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Palavra não encontrada",
                    fontSize = 18.sp,
                    color = OnSurface
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = word,
                    fontSize = 28.sp,
                    color = Primary
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = "Os jogadores podem validar esta palavra manualmente.",
                    fontSize = 14.sp,
                    color = OnSurface.copy(alpha = 0.7f)
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    OutlinedButton(onClick = onReject) {
                        Text("Rejeitar")
                    }
                    Button(
                        onClick = onApprove,
                        colors = ButtonDefaults.buttonColors(containerColor = Primary)
                    ) {
                        Text("Aprovar")
                    }
                }
            }
        }
    }
}

/**
 * Diálogo de fim de jogo.
 */
@Composable
fun GameOverDialog(
    winnerName: String,
    scores: Map<String, Int>,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(text = "🏆", fontSize = 48.sp)
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = "Fim de Jogo!",
                    fontSize = 24.sp,
                    color = OnSurface
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = "Vencedor: $winnerName",
                    fontSize = 18.sp,
                    color = Primary
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                scores.forEach { (name, score) ->
                    Text("$name: $score pontos", color = OnSurface)
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                ) {
                    Text("Voltar ao Início")
                }
            }
        }
    }
}
