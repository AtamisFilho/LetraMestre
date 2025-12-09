package com.letramestre.game

import com.letramestre.model.*

/**
 * Calcula a pontuação de jogadas.
 */
object ScoreCalculator {
    
    fun calculateMoveScore(board: Board, placements: List<TilePlacement>): Int {
        if (placements.isEmpty()) return 0
        
        var totalScore = 0
        val wordsFound = findAllWords(board, placements)
        
        for (word in wordsFound) {
            totalScore += calculateWordScore(word)
        }
        
        // Bônus de 50 pontos por usar todas as 7 peças
        if (placements.size == 7) {
            totalScore += 50
        }
        
        return totalScore
    }
    
    private fun calculateWordScore(cells: List<BoardCell>): Int {
        var wordScore = 0
        var wordMultiplier = 1
        
        for (cell in cells) {
            val tile = cell.tile ?: continue
            var letterValue = tile.value
            
            // Aplicar bônus apenas para peças recém-colocadas
            if (cell.isNewlyPlaced) {
                when (cell.bonus) {
                    CellBonus.DOUBLE_LETTER -> letterValue *= 2
                    CellBonus.TRIPLE_LETTER -> letterValue *= 3
                    CellBonus.DOUBLE_WORD, CellBonus.CENTER -> wordMultiplier *= 2
                    CellBonus.TRIPLE_WORD -> wordMultiplier *= 3
                    else -> {}
                }
            }
            
            wordScore += letterValue
        }
        
        return wordScore * wordMultiplier
    }
    
    fun findAllWords(board: Board, placements: List<TilePlacement>): List<List<BoardCell>> {
        val words = mutableListOf<List<BoardCell>>()
        val isHorizontal = placements.size <= 1 || 
            placements.map { it.row }.distinct().size == 1
        
        // Palavra principal
        val mainWord = if (isHorizontal) {
            findHorizontalWord(board, placements.first().row, placements.first().col)
        } else {
            findVerticalWord(board, placements.first().row, placements.first().col)
        }
        
        if (mainWord.size >= 2) words.add(mainWord)
        
        // Palavras perpendiculares
        for (placement in placements) {
            val perpWord = if (isHorizontal) {
                findVerticalWord(board, placement.row, placement.col)
            } else {
                findHorizontalWord(board, placement.row, placement.col)
            }
            if (perpWord.size >= 2) words.add(perpWord)
        }
        
        return words
    }
    
    private fun findHorizontalWord(board: Board, row: Int, startCol: Int): List<BoardCell> {
        val cells = mutableListOf<BoardCell>()
        
        // Ir para a esquerda
        var col = startCol
        while (col > 0 && board.getCell(row, col - 1)?.tile != null) col--
        
        // Coletar todas as células da palavra
        while (col < Board.SIZE) {
            val cell = board.getCell(row, col) ?: break
            if (cell.tile == null) break
            cells.add(cell)
            col++
        }
        
        return cells
    }
    
    private fun findVerticalWord(board: Board, startRow: Int, col: Int): List<BoardCell> {
        val cells = mutableListOf<BoardCell>()
        
        // Ir para cima
        var row = startRow
        while (row > 0 && board.getCell(row - 1, col)?.tile != null) row--
        
        // Coletar todas as células da palavra
        while (row < Board.SIZE) {
            val cell = board.getCell(row, col) ?: break
            if (cell.tile == null) break
            cells.add(cell)
            row++
        }
        
        return cells
    }
    
    fun extractWord(cells: List<BoardCell>): String {
        return cells.mapNotNull { it.tile?.getEffectiveLetter() }.joinToString("")
    }
}
