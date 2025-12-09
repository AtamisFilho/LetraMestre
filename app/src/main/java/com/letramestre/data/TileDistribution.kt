package com.letramestre.data

import com.letramestre.model.Tile

/**
 * Distribuição de peças para português brasileiro.
 */
object TileDistribution {
    
    private val distribution: Map<Char, Pair<Int, Int>> = mapOf(
        'A' to (14 to 1), 'B' to (3 to 3), 'C' to (4 to 2), 'D' to (5 to 2),
        'E' to (11 to 1), 'F' to (2 to 4), 'G' to (2 to 4), 'H' to (2 to 4),
        'I' to (8 to 1), 'J' to (2 to 5), 'L' to (5 to 2), 'M' to (6 to 1),
        'N' to (4 to 3), 'O' to (10 to 1), 'P' to (4 to 2), 'Q' to (1 to 6),
        'R' to (6 to 1), 'S' to (8 to 1), 'T' to (5 to 1), 'U' to (7 to 1),
        'V' to (2 to 4), 'X' to (1 to 8), 'Z' to (1 to 8), 'Ç' to (2 to 3),
        ' ' to (3 to 0)
    )
    
    fun generateAllTiles(): List<Tile> {
        val tiles = mutableListOf<Tile>()
        for ((letter, config) in distribution) {
            val (quantity, value) = config
            repeat(quantity) {
                if (letter == ' ') tiles.add(Tile.createBlank())
                else tiles.add(Tile(letter = letter, value = value))
            }
        }
        return tiles.shuffled()
    }
    
    fun getLetterValue(letter: Char): Int = distribution[letter.uppercaseChar()]?.second ?: 0
    
    fun getTotalTileCount(): Int = distribution.values.sumOf { it.first }
}
