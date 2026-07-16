package com.letramestre.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letramestre.model.Tile
import com.letramestre.ui.theme.*

/**
 * Componente visual para uma peça de letra.
 *
 * Acessibilidade (TalkBack): quando `onClick != null` a peça é anunciada como
 * um botão; o `contentDescription` descreve "peça <letra>, valor <v>" (ou
 * "curinga") em pt-BR. Quando usada sem `onClick` (ex.: dentro de
 * `BoardCellView` ou em preview), nenhum `role` é aplicado — o rótulo da
 * célula envolvente (com linha/coluna) sobrescreve o da peça via
 * `mergeDescendants = true`.
 */
@Composable
fun TileView(
    tile: Tile,
    size: Dp = 40.dp,
    isSelected: Boolean = false,
    isDragging: Boolean = false,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val bgColor = if (isSelected) TileSelected else TileBackground
    val elevation = if (isDragging) 8.dp else 2.dp

    val description = if (tile.isBlank) "curinga"
    else "peça ${tile.letter}, valor ${tile.value}"

    Box(
        modifier = modifier
            .size(size)
            .shadow(elevation, RoundedCornerShape(4.dp))
            .background(bgColor, RoundedCornerShape(4.dp))
            .border(1.dp, TileBorder, RoundedCornerShape(4.dp))
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .semantics(mergeDescendants = true) {
                if (onClick != null) role = Role.Button
                contentDescription = description
            },
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = tile.getEffectiveLetter().toString(),
                color = TileText,
                fontSize = (size.value * 0.5f).sp,
                fontWeight = FontWeight.Bold
            )
            if (!tile.isBlank) {
                Text(
                    text = tile.value.toString(),
                    color = TileText,
                    fontSize = (size.value * 0.2f).sp,
                    modifier = Modifier.offset(x = (size.value * 0.25f).dp, y = (-size.value * 0.15f).dp)
                )
            }
        }
    }
}

/**
 * Slot vazio para peça (usado no rack).
 */
@Composable
fun EmptyTileSlot(
    size: Dp = 40.dp,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(size)
            .background(Color.Gray.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
            .border(1.dp, Color.Gray.copy(alpha = 0.4f), RoundedCornerShape(4.dp))
    )
}
