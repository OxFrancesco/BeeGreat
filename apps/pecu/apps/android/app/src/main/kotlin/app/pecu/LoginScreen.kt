package app.pecu

import android.animation.ValueAnimator
import android.database.ContentObserver
import android.graphics.ImageDecoder
import android.graphics.drawable.AnimatedImageDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.ImageView
import androidx.compose.foundation.Image
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable fun LoginScreen(
  auth: AccountUi,
  onSignIn: (LoginProvider) -> Unit,
  motionEnabled: Boolean = rememberLoginMotionEnabled(),
) {
  val lifecycle by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
  val playing = motionEnabled && lifecycle.isAtLeast(Lifecycle.State.RESUMED)
  Surface(color = MaterialTheme.colorScheme.background) {
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
      val wide = maxWidth >= 720.dp && maxHeight >= 400.dp
      val stageHeight = (maxHeight * .43f).coerceIn(190.dp, 380.dp)
      Column(Modifier.fillMaxSize()) {
        Text("pecu", Modifier.padding(horizontal = 28.dp, vertical = 20.dp), color = if (isSystemInDarkTheme()) Amber else Brown, fontFamily = Mono, fontWeight = FontWeight.Bold, fontSize = 24.sp, letterSpacing = (-1).sp)
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
          if (wide) {
            Row(Modifier.widthIn(max = 1120.dp).fillMaxWidth().padding(horizontal = 40.dp, vertical = 24.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(40.dp)) {
              LoginMascot(Modifier.weight(1.15f).aspectRatio(1f), motionEnabled, playing)
              Column(Modifier.weight(1f).widthIn(max = 400.dp).verticalScroll(rememberScrollState())) {
                LoginControls(auth, onSignIn, centered = false)
              }
            }
          } else {
            Column(Modifier.widthIn(max = 480.dp).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
              LoginMascot(Modifier.fillMaxWidth().height(stageHeight), motionEnabled, playing)
              Spacer(Modifier.height(20.dp))
              LoginControls(auth, onSignIn, centered = true)
              Spacer(Modifier.height(32.dp))
            }
          }
        }
      }
    }
  }
}

@Composable private fun LoginControls(auth: AccountUi, onSignIn: (LoginProvider) -> Unit, centered: Boolean) {
  Column(Modifier.fillMaxWidth(), horizontalAlignment = if (centered) Alignment.CenterHorizontally else Alignment.Start) {
    Text("Sign in to Pecu", style = MaterialTheme.typography.headlineLarge.copy(fontSize = 32.sp, lineHeight = 38.sp, letterSpacing = (-1).sp), textAlign = if (centered) TextAlign.Center else TextAlign.Start)
    Spacer(Modifier.height(12.dp))
    Text("Continue with the account you use on pecu.app.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge, textAlign = if (centered) TextAlign.Center else TextAlign.Start)
    Spacer(Modifier.height(28.dp))
    ProviderButton(LoginProvider.Google, auth, onSignIn)
    Spacer(Modifier.height(12.dp))
    ProviderButton(LoginProvider.X, auth, onSignIn)
    if (!auth.ready) {
      Spacer(Modifier.height(16.dp))
      Text("Connecting…", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    }
    auth.error?.let {
      Spacer(Modifier.height(16.dp))
      Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive }, textAlign = if (centered) TextAlign.Center else TextAlign.Start)
    }
  }
}

@Composable private fun ProviderButton(provider: LoginProvider, auth: AccountUi, onSignIn: (LoginProvider) -> Unit) {
  val active = auth.busy && auth.signingInWith == provider
  val label = if (active) "Opening ${provider.label}…" else "Continue with ${provider.label}"
  val primary = provider == LoginProvider.Google
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val scale by animateFloatAsState(if (pressed) .97f else 1f, tween(140), label = "provider-press")
  val enabled = auth.ready && !auth.busy
  val fill = if (primary) Amber else MaterialTheme.colorScheme.surfaceVariant
  val ink = if (primary) Color.Black else MaterialTheme.colorScheme.onSurface
  CompositionLocalProvider(LocalContentColor provides ink) {
  Box(
    Modifier.fillMaxWidth().heightIn(min = 60.dp)
      .graphicsLayer { scaleX = scale; scaleY = scale; alpha = if (enabled || active) 1f else .55f }
      .clayMaterial(fill, primary = primary, radius = 22)
      .clip(RoundedCornerShape(22.dp))
      .clickable(interactionSource = interaction, indication = null, enabled = enabled, role = Role.Button) { onSignIn(provider) }
      .semantics { if (active) { contentDescription = label; liveRegion = LiveRegionMode.Polite } }
      .padding(horizontal = 22.dp, vertical = 20.dp),
    contentAlignment = Alignment.Center,
  ) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
      if (active) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.primary)
      else {
        Image(painterResource(if (primary) R.drawable.google_logo else R.drawable.x_logo), null, Modifier.align(Alignment.CenterStart).size(20.dp), colorFilter = if (primary) null else ColorFilter.tint(MaterialTheme.colorScheme.onSurface))
        Text(label, Modifier.padding(horizontal = 28.dp), textAlign = TextAlign.Center, fontWeight = FontWeight.Medium, fontSize = 15.sp)
      }
    }
  }
  }
}

@Composable private fun LoginMascot(modifier: Modifier, motionEnabled: Boolean, playing: Boolean) {
  val context = LocalContext.current
  val animated by produceState<Drawable?>(null, motionEnabled) {
    value = null
    if (motionEnabled && Build.VERSION.SDK_INT >= 28) {
      value = withContext(Dispatchers.IO) {
        runCatching { ImageDecoder.decodeDrawable(ImageDecoder.createSource(context.resources, R.raw.pecu_login_motion)) }.getOrNull()
      }
    }
  }
  DisposableEffect(animated) {
    val drawable = animated
    onDispose { if (Build.VERSION.SDK_INT >= 28) (drawable as? AnimatedImageDrawable)?.stop() }
  }
  Box(modifier.semantics { contentDescription = "Pecu" }, contentAlignment = Alignment.Center) {
    if (animated == null) Image(painterResource(R.drawable.pecu_idle), null, Modifier.fillMaxSize())
    else AndroidView(
      factory = { ImageView(it).apply { scaleType = ImageView.ScaleType.FIT_CENTER; importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO } },
      modifier = Modifier.fillMaxSize().testTag("login-mascot-animation"),
      update = { view ->
        if (view.drawable !== animated) view.setImageDrawable(animated)
        if (Build.VERSION.SDK_INT >= 28) (animated as? AnimatedImageDrawable)?.let { if (playing) it.start() else it.stop() }
      },
      onRelease = { view -> if (Build.VERSION.SDK_INT >= 28) (view.drawable as? AnimatedImageDrawable)?.stop(); view.setImageDrawable(null) },
    )

  }
}

@Composable private fun rememberLoginMotionEnabled(): Boolean {
  val resolver = LocalContext.current.contentResolver
  var enabled by remember { mutableStateOf(ValueAnimator.areAnimatorsEnabled()) }
  DisposableEffect(resolver) {
    val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
      override fun onChange(selfChange: Boolean) { enabled = ValueAnimator.areAnimatorsEnabled() }
    }
    resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, observer)
    onDispose { resolver.unregisterContentObserver(observer) }
  }
  return enabled && Build.VERSION.SDK_INT >= 28
}
