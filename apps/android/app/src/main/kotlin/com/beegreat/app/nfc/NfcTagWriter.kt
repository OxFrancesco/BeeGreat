package com.beegreat.app.nfc

import android.app.Activity
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

class NfcUnavailableException(message: String) : RuntimeException(message)

/**
 * Writes one URI record to the next tag held to the phone, using reader mode
 * so the system does not also open the URL. Port of `nfc-tags.ts`.
 */
object NfcTagWriter {
  fun availability(activity: Activity): String? {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return "This phone does not support NFC tags."
    if (!adapter.isEnabled) return "Turn on NFC in your phone settings and try again."
    return null
  }

  suspend fun write(activity: Activity, url: String, timeoutMs: Long = 60_000) {
    availability(activity)?.let { throw NfcUnavailableException(it) }
    val adapter = NfcAdapter.getDefaultAdapter(activity)
    val tagArrived = CompletableDeferred<Tag>()
    val flags = NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
    adapter.enableReaderMode(activity, { tag -> tagArrived.complete(tag) }, flags, null)
    try {
      val tag = withTimeout(timeoutMs) { tagArrived.await() }
      withContext(Dispatchers.IO) { writeTo(tag, NdefMessage(arrayOf(NdefRecord.createUri(url)))) }
    } finally {
      adapter.disableReaderMode(activity)
    }
  }

  private fun writeTo(tag: Tag, message: NdefMessage) {
    Ndef.get(tag)?.let { ndef ->
      ndef.connect()
      try {
        if (!ndef.isWritable) throw NfcUnavailableException("This tag is read-only.")
        if (ndef.maxSize < message.toByteArray().size) throw NfcUnavailableException("This tag is too small for the BeeGreat link.")
        ndef.writeNdefMessage(message)
      } finally {
        ndef.close()
      }
      return
    }
    NdefFormatable.get(tag)?.let { formatable ->
      formatable.connect()
      try {
        formatable.format(message)
      } finally {
        formatable.close()
      }
      return
    }
    throw NfcUnavailableException("This tag cannot hold a link. Try an NDEF-capable tag.")
  }
}
