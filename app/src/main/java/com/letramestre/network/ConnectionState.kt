package com.letramestre.network

/**
 * Estado da conexão de rede.
 */
sealed class ConnectionState {
    data object Disconnected : ConnectionState()
    data object Connecting : ConnectionState()
    data class Connected(val hostIp: String, val port: Int) : ConnectionState()
    data class Error(val message: String) : ConnectionState()
}
