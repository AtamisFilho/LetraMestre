package com.letramestre.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letramestre.ui.theme.*

/**
 * Tela de conexão para Host ou Cliente.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectionScreen(
    isHost: Boolean,
    hostIp: String,
    onConnect: (playerName: String, hostIp: String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    // rememberSaveable preserva os valores digitados em rotação (Activity é
    // recriada mas o estado salvo é restaurado). String é parcelável por
    // padrão via autoSaver.
    var playerName by rememberSaveable { mutableStateOf("") }
    var ipAddress by rememberSaveable { mutableStateOf("") }
    
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Primary, PrimaryDark)
                )
            )
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Bar
            TopAppBar(
                title = { 
                    Text(
                        if (isHost) "Criar Partida" else "Entrar em Partida",
                        color = OnPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Voltar", tint = OnPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Primary
                )
            )
            
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Spacer(modifier = Modifier.height(32.dp))
                
                // Campo Nome do Jogador
                OutlinedTextField(
                    value = playerName,
                    onValueChange = { playerName = it },
                    label = { Text("Seu nome") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedBorderColor = OnPrimary.copy(alpha = 0.5f),
                        focusedBorderColor = OnPrimary,
                        unfocusedLabelColor = OnPrimary.copy(alpha = 0.7f),
                        focusedLabelColor = OnPrimary,
                        unfocusedTextColor = OnPrimary,
                        focusedTextColor = OnPrimary
                    ),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
                
                if (isHost) {
                    // Exibir IP do Host
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Surface
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "Seu IP para compartilhar:",
                                color = OnSurface.copy(alpha = 0.7f),
                                fontSize = 14.sp
                            )
                            Text(
                                text = hostIp,
                                color = Primary,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Porta: 8080",
                                color = OnSurface.copy(alpha = 0.7f),
                                fontSize = 14.sp
                            )
                        }
                    }
                } else {
                    // Campo IP do Host
                    OutlinedTextField(
                        value = ipAddress,
                        onValueChange = { ipAddress = it },
                        label = { Text("IP do anfitrião") },
                        placeholder = { Text("Ex: 192.168.1.100") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            unfocusedBorderColor = OnPrimary.copy(alpha = 0.5f),
                            focusedBorderColor = OnPrimary,
                            unfocusedLabelColor = OnPrimary.copy(alpha = 0.7f),
                            focusedLabelColor = OnPrimary,
                            unfocusedTextColor = OnPrimary,
                            focusedTextColor = OnPrimary,
                            unfocusedPlaceholderColor = OnPrimary.copy(alpha = 0.4f),
                            focusedPlaceholderColor = OnPrimary.copy(alpha = 0.4f)
                        ),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
                
                Spacer(modifier = Modifier.weight(1f))
                
                // Botão Conectar/Criar
                Button(
                    onClick = { 
                        onConnect(playerName, if (isHost) "" else ipAddress) 
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    enabled = playerName.isNotBlank() && (isHost || ipAddress.isNotBlank()),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Accent
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (isHost) "Criar Sala" else "Conectar",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}
