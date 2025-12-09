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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.letramestre.model.BoardCell
import com.letramestre.model.CellBonus
import com.letramestre.ui.theme.*

/**
 * Componente visual para uma célula do tabuleiro.
 */
@Composable
fun BoardCellView(
    cell: BoardCell,
    cellSize: Dp,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor = when {
        cell.tile != null -> TileBackground
        else -> getCellBonusColor(cell.bonus)
    }
    
    Box(
        modifier = modifier
            .size(cellSize)
            .background(bgColor)
            .border(0.5.dp, Color.Gray.copy(alpha = 0.3f))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        if (cell.tile != null) {
            TileView(
                tile = cell.tile,
                size = cellSize - 2.dp,
                isSelected = cell.isNewlyPlaced
            )
        } else if (cell.bonus != CellBonus.NONE) {
            Text(
                text = cell.bonus.labelShort,
                color = Color.White.copy(alpha = 0.9f),
                fontSize = (cellSize.value * 0.3f).sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun getCellBonusColor(bonus: CellBonus): Color {
    return when (bonus) {
        CellBonus.NONE -> CellNormal
        CellBonus.DOUBLE_LETTER -> CellDoubleLetter
        CellBonus.TRIPLE_LETTER -> CellTripleLetter
        CellBonus.DOUBLE_WORD -> CellDoubleWord
        CellBonus.TRIPLE_WORD -> CellTripleWord
        CellBonus.CENTER -> CellCenter
    }
}
