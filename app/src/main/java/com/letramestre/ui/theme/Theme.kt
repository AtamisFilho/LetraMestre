package com.letramestre.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    secondary = Accent,
    background = Background,
    surface = Surface,
    onBackground = OnBackground,
    onSurface = OnSurface,
    error = Error
)

@Composable
fun LetraMestreTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
