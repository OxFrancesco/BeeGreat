package com.beegreat.app.auth

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.R
import com.beegreat.design.Hive
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import com.beegreat.design.components.HexButton
import com.beegreat.design.components.HexButtonVariant

private const val PRIVACY_URL = "https://beedocs.pages.dev/privacy"
private const val TERMS_URL = "https://beedocs.pages.dev/terms"

/** Port of `apps/mobile/src/app/sign-in.tsx` minus Apple, which has no Android meaning. */
@Composable
fun SignInScreen(onSignInWithGoogle: () -> Unit) {
  val container = LocalAppContainer.current
  val viewModel: AuthViewModel = viewModel { AuthViewModel(container.convex) }
  val pending by viewModel.pending.collectAsStateWithLifecycle()
  val error by viewModel.error.collectAsStateWithLifecycle()
  val context = LocalContext.current

  Column(
    modifier = Modifier.fillMaxSize().background(Hive.cream).safeDrawingPadding(),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Spacer(Modifier.weight(1f))
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
      Image(
        painter = painterResource(R.drawable.bee),
        contentDescription = null,
        modifier = Modifier.height(96.dp),
      )
      Text(text = "BeeGreat", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = Hive.cacao)
      Text(
        text = "One hive for your goals.\nTalk, plan, and make every day count.",
        fontSize = 17.sp,
        lineHeight = 24.sp,
        color = Hive.bark,
        textAlign = TextAlign.Center,
      )
    }
    Spacer(Modifier.weight(1f))
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxWidth().padding(horizontal = Spacing.four),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      HexButton(
        label = "Sign in with Google",
        onClick = onSignInWithGoogle,
        busy = pending,
        variant = HexButtonVariant.Secondary,
        icon = { GoogleLogo() },
      )
      error?.let {
        Text(text = it, color = Hive.amber, fontSize = 14.sp, textAlign = TextAlign.Center)
      }
      val legal = buildAnnotatedString {
        append("By continuing you agree to our ")
        withLink(LinkAnnotation.Url(TERMS_URL) { openInBrowser(context, TERMS_URL) }) {
          pushStyle(SpanStyle(textDecoration = TextDecoration.Underline, color = Hive.cacao))
          append("Terms of Use")
          pop()
        }
        append(" and acknowledge our ")
        withLink(LinkAnnotation.Url(PRIVACY_URL) { openInBrowser(context, PRIVACY_URL) }) {
          pushStyle(SpanStyle(textDecoration = TextDecoration.Underline, color = Hive.cacao))
          append("Privacy Policy")
          pop()
        }
        append(".")
      }
      Text(text = legal, fontSize = 13.sp, lineHeight = 18.sp, color = Hive.bark, textAlign = TextAlign.Center)
    }
    Spacer(Modifier.height(Spacing.five))
  }
}

private fun openInBrowser(context: android.content.Context, url: String) {
  CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
}
