package com.volzo.core.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

object ImageCompressor {

    fun compressImage(
        context: Context,
        imageUri: Uri,
        maxSizeBytes: Long = 2 * 1024 * 1024 // Default 2MB limit
    ): File {
        val inputStream = context.contentResolver.openInputStream(imageUri)
        val originalBitmap = BitmapFactory.decodeStream(inputStream)
        inputStream?.close()

        var quality = 90
        var stream = ByteArrayOutputStream()

        // Compress iteratively using WebP / JPEG
        originalBitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)

        while (stream.size() > maxSizeBytes && quality > 20) {
            stream.reset()
            quality -= 10
            originalBitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
        }

        val tempFile = File.createTempFile("volzo_doc_", ".jpg", context.cacheDir)
        val fileOutputStream = FileOutputStream(tempFile)
        fileOutputStream.write(stream.toByteArray())
        fileOutputStream.flush()
        fileOutputStream.close()

        return tempFile
    }
}
