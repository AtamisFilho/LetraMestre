package com.letramestre.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letramestre.model.Player
import com.letramestre.ui.theme.Primary
import com.letramestre.ui.theme.OnPrimary

/**
 * Componente visual do placar com pontuações.
 */
@Composable
fun ScoreBoard(
    players: List<Player>,
    currentPlayerId: String?,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Primary)
            .padding(8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (player in players) {
            val isCurrentPlayer = player.id == currentPlayerId
            PlayerScoreCard(
                player = player,
                isCurrentPlayer = isCurrentPlayer
            )
        }
    }
}

@Composable
private fun PlayerScoreCard(
    player: Player,
    isCurrentPlayer: Boolean,
    modifier: Modifier = Modifier
) {
    val bgColor = if (isCurrentPlayer) Color.White else Color.White.copy(alpha = 0.2f)
    val textColor = if (isCurrentPlayer) Primary else OnPrimary
    
    Column(
        modifier = modifier
            .background(bgColor, RoundedCornerShape(8.dp))
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = player.name,
            color = textColor,
            fontSize = 14.sp,
            fontWeight = if (isCurrentPlayer) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = player.score.toString(),
            color = textColor,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
