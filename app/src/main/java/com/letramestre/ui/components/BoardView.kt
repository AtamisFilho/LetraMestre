package com.letramestre.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import com.letramestre.model.Board
import com.letramestre.ui.theme.BoardBackground

/**
 * Componente visual do tabuleiro 15x15.
 */
@Composable
fun BoardView(
    board: Board,
    onCellClick: (row: Int, col: Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val config = LocalConfiguration.current
    val screenWidth = config.screenWidthDp.dp
    val cellSize = (screenWidth - 16.dp) / Board.SIZE
    
    Column(
        modifier = modifier
            .background(BoardBackground)
            .padding(4.dp)
    ) {
        for (row in 0 until Board.SIZE) {
            Row {
                for (col in 0 until Board.SIZE) {
                    val cell = board.cells[row][col]
                    BoardCellView(
                        cell = cell,
                        cellSize = cellSize,
                        onClick = { onCellClick(row, col) }
                    )
                }
            }
        }
    }
}
