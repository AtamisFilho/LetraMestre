package com.letramestre.game

import com.letramestre.data.Dictionary
import com.letramestre.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Resultado da validação de uma jogada.
 */
sealed class MoveValidation {
    data class Valid(val score: Int, val words: List<String>) : MoveValidation()
    data class InvalidWord(val word: String, val moveData: MoveData) : MoveValidation()
    data class InvalidPlacement(val reason: String) : MoveValidation()
}

/**
 * Gerenciador central do jogo. Executa apenas no dispositivo Host.
 */
class GameManager {
    private val tileBag = TileBag()
    private val _gameState = MutableStateFlow(
        GameState(board = Board.createEmpty(), players = emptyList())
    )
    val gameState: StateFlow<GameState> = _gameState.asStateFlow()
    
    fun startGame(playerNames: List<String>) {
        tileBag.refill()
        
        val players = playerNames.mapIndexed { index, name ->
            Player(
                id = "player_$index",
                name = name,
                isHost = index == 0,
                rack = tileBag.draw(Player.MAX_RACK_SIZE)
            )
        }
        
        _gameState.value = GameState(
            board = Board.createEmpty(),
            players = players,
            currentPlayerIndex = 0,
            tileBagCount = tileBag.remainingCount(),
            phase = GamePhase.IN_PROGRESS
        )
    }
    
    fun validateMove(moveData: MoveData): MoveValidation {
        val state = _gameState.value
        val player = state.getPlayerById(moveData.playerId)
            ?: return MoveValidation.InvalidPlacement("Jogador não encontrado")
        
        if (state.getCurrentPlayer()?.id != moveData.playerId) {
            return MoveValidation.InvalidPlacement("Não é sua vez")
        }
        
        if (moveData.placements.isEmpty()) {
            return MoveValidation.InvalidPlacement("Nenhuma peça colocada")
        }
        
        if (!moveData.isValidLine()) {
            return MoveValidation.InvalidPlacement("Peças devem estar em linha")
        }
        
        // Verificar se primeira jogada cobre o centro
        if (state.board.isEmpty()) {
            val coversCenter = moveData.placements.any { it.row == 7 && it.col == 7 }
            if (!coversCenter) {
                return MoveValidation.InvalidPlacement("Primeira jogada deve cobrir o centro")
            }
        }
        
        // Aplicar peças temporariamente
        var tempBoard = state.board
        for (placement in moveData.placements) {
            val cell = tempBoard.getCell(placement.row, placement.col)
            if (cell?.tile != null) {
                return MoveValidation.InvalidPlacement("Célula já ocupada")
            }
            tempBoard = tempBoard.withTilePlaced(placement.row, placement.col, placement.tile)
        }
        
        // Verificar conexão com peças existentes (exceto primeira jogada)
        if (!state.board.isEmpty()) {
            val connected = moveData.placements.any { p ->
                listOf(-1 to 0, 1 to 0, 0 to -1, 0 to 1).any { (dr, dc) ->
                    val adjCell = state.board.getCell(p.row + dr, p.col + dc)
                    adjCell?.tile != null
                }
            }
            if (!connected) {
                return MoveValidation.InvalidPlacement("Deve conectar com peças existentes")
            }
        }
        
        // Encontrar palavras formadas
        val wordsFound = ScoreCalculator.findAllWords(tempBoard, moveData.placements)
        if (wordsFound.isEmpty()) {
            return MoveValidation.InvalidPlacement("Nenhuma palavra formada")
        }
        
        // Validar palavras no dicionário
        for (wordCells in wordsFound) {
            val word = ScoreCalculator.extractWord(wordCells)
            if (!Dictionary.isValidWord(word)) {
                return MoveValidation.InvalidWord(word, moveData)
            }
        }
        
        val score = ScoreCalculator.calculateMoveScore(tempBoard, moveData.placements)
        val wordStrings = wordsFound.map { ScoreCalculator.extractWord(it) }
        
        return MoveValidation.Valid(score, wordStrings)
    }
    
    fun processValidMove(moveData: MoveData, score: Int) {
        val state = _gameState.value
        val player = state.getPlayerById(moveData.playerId) ?: return
        
        // Aplicar peças no tabuleiro
        var newBoard = state.board
        for (placement in moveData.placements) {
            newBoard = newBoard.withTilePlaced(placement.row, placement.col, placement.tile, false)
        }
        
        // Atualizar rack do jogador
        val usedIndices = moveData.placements.map { it.rackIndex }
        val newRack = player.rack.filterIndexed { i, _ -> i !in usedIndices }
        val drawnTiles = tileBag.draw(Player.MAX_RACK_SIZE - newRack.size)
        val updatedPlayer = player.copy(
            score = player.score + score,
            rack = newRack + drawnTiles
        )
        
        // Atualizar estado
        var newState = state.copy(
            board = newBoard,
            tileBagCount = tileBag.remainingCount(),
            consecutivePasses = 0
        ).updatePlayer(updatedPlayer).nextPlayer()
        
        // Verificar fim de jogo
        if (newState.shouldEndGame()) {
            newState = newState.copy(phase = GamePhase.GAME_OVER)
        }
        
        _gameState.value = newState
    }
    
    fun passTurn(playerId: String) {
        val state = _gameState.value
        if (state.getCurrentPlayer()?.id != playerId) return
        
        var newState = state.copy(consecutivePasses = state.consecutivePasses + 1).nextPlayer()
        if (newState.shouldEndGame()) {
            newState = newState.copy(phase = GamePhase.GAME_OVER)
        }
        _gameState.value = newState
    }
    
    fun exchangeTiles(playerId: String, indices: List<Int>) {
        val state = _gameState.value
        val player = state.getPlayerById(playerId) ?: return
        if (state.getCurrentPlayer()?.id != playerId) return
        if (tileBag.remainingCount() < indices.size) return
        
        val tilesToReturn = indices.mapNotNull { player.rack.getOrNull(it) }
        val newRack = player.rack.filterIndexed { i, _ -> i !in indices }
        val drawnTiles = tileBag.draw(indices.size)
        tileBag.returnTiles(tilesToReturn)
        
        val updatedPlayer = player.copy(rack = newRack + drawnTiles)
        _gameState.value = state.updatePlayer(updatedPlayer).nextPlayer().copy(consecutivePasses = 0)
    }
    
    fun approveWord(word: String) {
        Dictionary.addManuallyApprovedWord(word)
        val state = _gameState.value
        val pendingMove = state.pendingMoveData ?: return
        
        when (val validation = validateMove(pendingMove)) {
            is MoveValidation.Valid -> {
                processValidMove(pendingMove, validation.score)
                _gameState.value = _gameState.value.copy(
                    pendingValidationWord = null,
                    pendingMoveData = null,
                    phase = GamePhase.IN_PROGRESS
                )
            }
            else -> {}
        }
    }
    
    fun rejectWord() {
        _gameState.value = _gameState.value.copy(
            pendingValidationWord = null,
            pendingMoveData = null,
            phase = GamePhase.IN_PROGRESS
        )
    }
    
    fun addPlayer(name: String): Player {
        val state = _gameState.value
        val id = "player_${state.players.size}"
        val player = Player(id = id, name = name, isHost = state.players.isEmpty())
        _gameState.value = state.copy(players = state.players + player)
        return player
    }
    
    fun loadState(state: GameState) {
        _gameState.value = state
    }
}
