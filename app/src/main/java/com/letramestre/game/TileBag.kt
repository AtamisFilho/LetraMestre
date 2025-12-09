package com.letramestre.game

import com.letramestre.data.TileDistribution
import com.letramestre.model.Tile

/**
 * Gerencia o saco de peças do jogo.
 */
class TileBag {
    private val tiles = mutableListOf<Tile>()
    
    init {
        refill()
    }
    
    fun refill() {
        tiles.clear()
        tiles.addAll(TileDistribution.generateAllTiles())
    }
    
    fun draw(count: Int): List<Tile> {
        val drawn = tiles.take(count.coerceAtMost(tiles.size))
        repeat(drawn.size) { tiles.removeAt(0) }
        return drawn
    }
    
    fun returnTiles(returnedTiles: List<Tile>) {
        tiles.addAll(returnedTiles)
        tiles.shuffle()
    }
    
    fun remainingCount(): Int = tiles.size
    
    fun isEmpty(): Boolean = tiles.isEmpty()
    
    fun getState(): List<Tile> = tiles.toList()
    
    fun loadState(state: List<Tile>) {
        tiles.clear()
        tiles.addAll(state)
    }
}
