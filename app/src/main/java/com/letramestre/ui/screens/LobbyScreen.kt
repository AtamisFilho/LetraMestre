package com.letramestre.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letramestre.network.PlayerInfo
import com.letramestre.ui.theme.*

/**
 * Tela de lobby aguardando jogadores.
 */
@Composable
fun LobbyScreen(
    isHost: Boolean,
    players: List<PlayerInfo>,
    hostIp: String,
    onStartGame: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Primary, PrimaryDark)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Sala de Espera",
                color = OnPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            if (isHost) {
                Text(
                    text = "IP: $hostIp:8080",
                    color = OnPrimary.copy(alpha = 0.8f),
                    fontSize = 14.sp
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Lista de jogadores
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                colors = CardDefaults.cardColors(containerColor = Surface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Jogadores (${players.size}/4)",
                        color = OnSurface,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(players) { player ->
                            PlayerListItem(player = player)
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            if (isHost) {
                Button(
                    onClick = onStartGame,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    enabled = players.size >= 2,
                    colors = ButtonDefaults.buttonColors(containerColor = Accent),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "Iniciar Jogo",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
                Text(
                    text = "Aguardando o anfitrião iniciar...",
                    color = OnPrimary.copy(alpha = 0.8f),
                    fontSize = 16.sp
                )
            }
        }
    }
}

@Composable
private fun PlayerListItem(player: PlayerInfo) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PrimaryLight, RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(Primary, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Person, "Jogador", tint = OnPrimary)
        }
        
        Spacer(modifier = Modifier.width(12.dp))
        
        Text(
            text = player.name,
            color = OnSurface,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f)
        )
        
        if (player.isHost) {
            Surface(
                color = Accent,
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = "HOST",
                    color = OnPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}
