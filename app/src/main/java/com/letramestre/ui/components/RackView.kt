package com.letramestre.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.letramestre.model.Player
import com.letramestre.model.Tile

/**
 * Componente visual do rack do jogador (7 peças).
 *
 * Acessibilidade (TalkBack): cada peça é envolvida por um Box com
 * `Modifier.semantics(mergeDescendants = true) { role = Role.Button;
 * contentDescription = "Peça <letra>, posição <i (1-indexado)>" }`. O
 * `mergeDescendants = true` funde o `onClick`/`role` da `TileView` interna
 * neste wrapper, então o TalkBack trata o wrapper como o botão clicável, com
 * o rótulo posicional. Tamanho da peça elevado para 48dp (WCAG 2.5.5).
 */
@Composable
fun RackView(
    tiles: List<Tile>,
    selectedIndices: Set<Int>,
    onTileClick: (index: Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF8B4513), RoundedCornerShape(8.dp))
            .padding(8.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (i in 0 until Player.MAX_RACK_SIZE) {
            val tile = tiles.getOrNull(i)
            if (tile != null) {
                val letra = if (tile.isBlank) "curinga" else tile.letter.toString()
                Box(
                    modifier = Modifier.semantics(mergeDescendants = true) {
                        role = Role.Button
                        contentDescription = "Peça $letra, posição ${i + 1}"
                    }
                ) {
                    TileView(
                        tile = tile,
                        size = 48.dp,
                        isSelected = i in selectedIndices,
                        onClick = { onTileClick(i) }
                    )
                }
            } else {
                EmptyTileSlot(size = 48.dp)
            }
            if (i < Player.MAX_RACK_SIZE - 1) {
                Spacer(modifier = Modifier.width(4.dp))
            }
        }
    }
}
