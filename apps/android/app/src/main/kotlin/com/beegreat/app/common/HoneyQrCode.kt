package com.beegreat.app.common

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/** Cacao modules on a cream tile, like `honey-qr-code.tsx`. */
@Composable
fun HoneyQrCode(value: String, size: Dp, modifier: Modifier = Modifier) {
  val matrix = remember(value) {
    QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 0, 0, mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to 0))
  }
  Canvas(
    modifier =
      modifier.size(size + Spacing.three * 2)
        .background(Color(0xFFFFF7E8), RoundedCornerShape(Radius.card))
        .padding(Spacing.three)
        .semantics { contentDescription = "QR code for $value" },
  ) {
    val cell = this.size.minDimension / matrix.width
    for (y in 0 until matrix.height) for (x in 0 until matrix.width) {
      if (matrix.get(x, y)) drawRect(Color(0xFF482401), Offset(x * cell, y * cell), Size(cell + 0.5f, cell + 0.5f))
    }
  }
}

