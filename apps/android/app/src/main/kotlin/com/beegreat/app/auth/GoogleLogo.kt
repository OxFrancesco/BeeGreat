package com.beegreat.app.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.beegreat.app.R

/** Same SVG paths as `GoogleLogo` in the Expo app's `beennector-logos.tsx`. */
@Composable
fun GoogleLogo(size: Dp = 20.dp) {
  Image(
    painter = painterResource(R.drawable.ic_google_logo),
    contentDescription = null,
    modifier = Modifier.size(size),
  )
}
