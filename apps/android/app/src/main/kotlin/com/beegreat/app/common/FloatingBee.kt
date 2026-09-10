package com.beegreat.app.common

import android.os.Build
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import coil3.gif.AnimatedImageDecoder
import coil3.gif.GifDecoder
import coil3.request.ImageRequest
import com.beegreat.app.R

/** The pixel Bee, animated. Coil decodes the animated WebP that `painterResource` cannot. */
@Composable
fun FloatingBee(height: Dp, modifier: Modifier = Modifier) {
  val context = LocalContext.current
  val loader =
    ImageLoader.Builder(context)
      .components {
        if (Build.VERSION.SDK_INT >= 28) add(AnimatedImageDecoder.Factory()) else add(GifDecoder.Factory())
      }
      .build()
  AsyncImage(
    model = ImageRequest.Builder(context).data(R.drawable.bee_animated).build(),
    imageLoader = loader,
    contentDescription = "Bee",
    modifier = modifier.height(height),
  )
}
