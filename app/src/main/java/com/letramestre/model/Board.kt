package com.letramestre.model

import kotlinx.serialization.Serializable

/**
 * Representa o tabuleiro do jogo 15x15.
 */
@Serializable
data class Board(
    val cells: List<List<BoardCell>>
) {
    companion object {
        const val SIZE = 15
        private const val CENTER = 7
        
        /**
         * Cria um tabuleiro vazio com os bônus nas posições corretas.
         */
        fun createEmpty(): Board {
            val cells = List(SIZE) { row ->
                List(SIZE) { col ->
                    BoardCell(
                        row = row,
                        col = col,
                        bonus = getBonusForPosition(row, col)
                    )
                }
            }
            return Board(cells)
        }
        
        /**
         * Determina o bônus para uma posição específica do tabuleiro.
         * Layout padrão do Scrabble.
         */
        private fun getBonusForPosition(row: Int, col: Int): CellBonus {
            // Centro
            if (row == CENTER && col == CENTER) return CellBonus.CENTER
            
            // Palavra Tripla (PT) - cantos e meio das bordas
            val tripleWordPositions = listOf(
                0 to 0, 0 to 7, 0 to 14,
                7 to 0, 7 to 14,
                14 to 0, 14 to 7, 14 to 14
            )
            if (tripleWordPositions.contains(row to col)) return CellBonus.TRIPLE_WORD
            
            // Palavra Dupla (PD) - diagonais
            val doubleWordPositions = listOf(
                1 to 1, 2 to 2, 3 to 3, 4 to 4,
                1 to 13, 2 to 12, 3 to 11, 4 to 10,
                10 to 4, 11 to 3, 12 to 2, 13 to 1,
                10 to 10, 11 to 11, 12 to 12, 13 to 13
            )
            if (doubleWordPositions.contains(row to col)) return CellBonus.DOUBLE_WORD
            
            // Letra Tripla (LT)
            val tripleLetterPositions = listOf(
                1 to 5, 1 to 9,
                5 to 1, 5 to 5, 5 to 9, 5 to 13,
                9 to 1, 9 to 5, 9 to 9, 9 to 13,
                13 to 5, 13 to 9
            )
            if (tripleLetterPositions.contains(row to col)) return CellBonus.TRIPLE_LETTER
            
            // Letra Dupla (LD)
            val doubleLetterPositions = listOf(
                0 to 3, 0 to 11,
                2 to 6, 2 to 8,
                3 to 0, 3 to 7, 3 to 14,
                6 to 2, 6 to 6, 6 to 8, 6 to 12,
                7 to 3, 7 to 11,
                8 to 2, 8 to 6, 8 to 8, 8 to 12,
                11 to 0, 11 to 7, 11 to 14,
                12 to 6, 12 to 8,
                14 to 3, 14 to 11
            )
            if (doubleLetterPositions.contains(row to col)) return CellBonus.DOUBLE_LETTER
            
            return CellBonus.NONE
        }
    }
    
    /**
     * Obtém uma célula específica do tabuleiro.
     */
    fun getCell(row: Int, col: Int): BoardCell? {
        if (row !in 0 until SIZE || col !in 0 until SIZE) return null
        return cells[row][col]
    }
    
    /**
     * Retorna uma cópia do tabuleiro com uma peça colocada.
     */
    fun withTilePlaced(row: Int, col: Int, tile: Tile, isNew: Boolean = true): Board {
        val newCells = cells.mapIndexed { r, rowCells ->
            rowCells.mapIndexed { c, cell ->
                if (r == row && c == col) {
                    cell.copy(tile = tile, isNewlyPlaced = isNew)
                } else {
                    cell
                }
            }
        }
        return Board(newCells)
    }
    
    /**
     * Confirma todas as peças recém-colocadas (remove flag isNewlyPlaced).
     */
    fun confirmNewTiles(): Board {
        val newCells = cells.map { rowCells ->
            rowCells.map { cell ->
                if (cell.isNewlyPlaced) cell.copy(isNewlyPlaced = false) else cell
            }
        }
        return Board(newCells)
    }
    
    /**
     * Verifica se o tabuleiro está vazio (primeira jogada).
     */
    fun isEmpty(): Boolean {
        return cells.flatten().all { it.tile == null }
    }
    
    /**
     * Verifica se o centro está ocupado.
     */
    fun isCenterOccupied(): Boolean {
        return cells[CENTER][CENTER].tile != null
    }
}
