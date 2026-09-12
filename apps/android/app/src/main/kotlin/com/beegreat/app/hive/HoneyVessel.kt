package com.beegreat.app.hive

import android.annotation.SuppressLint
import android.graphics.Color
import android.view.MotionEvent
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.viewinterop.AndroidView
import kotlin.math.abs

@SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
@Composable
fun HoneyVessel(balance: Double, modifier: Modifier = Modifier) {
  val currentBalance = rememberUpdatedState(if (balance.isFinite()) balance.coerceAtLeast(0.0) else 0.0)
  val safeBalance = currentBalance.value
  val overflow = maxOf(safeBalance - MVP_HONEY_CAPACITY, 0.0)
  val label = if (overflow > 0) "${formatCount(safeBalance)} Honey, vessel full with ${formatCount(overflow)} Honey in overflow" else "${formatCount(safeBalance)} of 100 Honey, ${safeBalance.coerceAtMost(MVP_HONEY_CAPACITY).toInt()}% full"
  BoxWithConstraints(modifier.fillMaxWidth().semantics { contentDescription = "$label. Drag left or right to rotate." }, contentAlignment = Alignment.Center) {
    AndroidView(
      modifier = Modifier.size(minOf(maxWidth, 340.dp)),
      factory = { context ->
        WebView(context).apply {
          layoutParams = android.view.ViewGroup.LayoutParams(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT)
          setBackgroundColor(Color.TRANSPARENT)
          settings.javaScriptEnabled = true
          settings.allowFileAccess = false
          settings.allowContentAccess = false
          settings.blockNetworkLoads = true
          isVerticalScrollBarEnabled = false
          isHorizontalScrollBarEnabled = false
          webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
              view.evaluateJavascript("window.hive?.setState({balance:${currentBalance.value}})", null)

            }
            override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest) = true
          }
          var startX = 0f
          var startY = 0f
          setOnTouchListener { view, event ->
            when (event.actionMasked) {
              MotionEvent.ACTION_DOWN -> {
                startX = event.x
                startY = event.y
                view.parent.requestDisallowInterceptTouchEvent(true)
              }
              MotionEvent.ACTION_MOVE -> {
                val horizontal = abs(event.x - startX) > abs(event.y - startY)
                view.parent.requestDisallowInterceptTouchEvent(horizontal)
              }
              MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> view.parent.requestDisallowInterceptTouchEvent(false)
            }
            false
          }
          loadUrl("file:///android_asset/hive3d/index.html")
        }
      },
      update = { it.evaluateJavascript("window.hive?.setState({balance:${currentBalance.value}})", null) },
      onRelease = { it.stopLoading(); it.destroy() },
    )
  }
}
