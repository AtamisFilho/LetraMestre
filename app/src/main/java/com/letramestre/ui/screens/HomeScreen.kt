package com.letramestre.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letramestre.ui.theme.*

/**
 * Tela inicial do aplicativo.
 */
@Composable
fun HomeScreen(
    onHostClick: () -> Unit,
    onClientClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Primary, PrimaryDark)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
            modifier = Modifier.padding(32.dp)
        ) {
            // Logo/Título
            Text(
                text = "🎯",
                fontSize = 80.sp
            )
            
            Text(
                text = "LetraMestre",
                color = OnPrimary,
                fontSize = 40.sp,
                fontWeight = FontWeight.Bold
            )
            
            Text(
                text = "O jogo de palavras multiplayer",
                color = OnPrimary.copy(alpha = 0.8f),
                fontSize = 16.sp,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(48.dp))
            
            // Botão Criar Partida
            Button(
                onClick = onHostClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Accent
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = "Criar Partida",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            
            // Botão Entrar em Partida
            OutlinedButton(
                onClick = onClientClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = OnPrimary
                ),
                border = ButtonDefaults.outlinedButtonBorder,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = "Entrar em Partida",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
