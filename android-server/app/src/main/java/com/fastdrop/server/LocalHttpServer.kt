package com.fastdrop.server

import android.os.Environment
import android.util.Log
import java.io.*
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.*

class LocalHttpServer(private val port: Int) : Thread() {
    private val tag = "LocalHttpServer"
    private var serverSocket: ServerSocket? = null
    @Volatile private var isRunning = true

    private val mimeMap = mapOf(
        "mp4" to "video/mp4",
        "mkv" to "video/x-matroska",
        "webm" to "video/webm",
        "avi" to "video/x-msvideo",
        "mp3" to "audio/mpeg",
        "wav" to "audio/wav",
        "m4a" to "audio/mp4",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "png" to "image/png",
        "webp" to "image/webp"
    )

    init {
        name = "FastDropServerThread"
    }

    override fun run() {
        try {
            serverSocket = ServerSocket(port)
            Log.d(tag, "Server socket successfully bound to port $port")
            while (isRunning) {
                val client = serverSocket?.accept() ?: break
                // Process each request inside a separate background thread
                Thread { handleClient(client) }.start()
            }
        } catch (e: Exception) {
            Log.e(tag, "Server error: ${e.message}")
        }
    }

    fun stopServer() {
        isRunning = false
        try {
            serverSocket?.close()
        } catch (e: Exception) {
            Log.e(tag, "Error closing server socket: ${e.message}")
        }
    }

    private fun handleClient(client: Socket) {
        val reader = BufferedReader(InputStreamReader(client.getInputStream()))
        val out = BufferedOutputStream(client.getOutputStream())

        try {
            // Read HTTP request line
            val firstLine = reader.readLine() ?: return
            Log.d(tag, "Request: $firstLine")
            val tokens = StringTokenizer(firstLine)
            if (tokens.countTokens() < 2) return
            val method = tokens.nextToken()
            var rawUri = tokens.nextToken()

            // Read headers to capture 'Range' header for video seeking
            var rangeHeader: String? = null
            var line: String?
            while (true) {
                line = reader.readLine()
                if (line.isNullOrEmpty()) break
                if (line.lowercase(Locale.ENGLISH).startsWith("range:")) {
                    rangeHeader = line.substring(6).trim()
                }
            }

            if (method != "GET") {
                sendErrorResponse(out, 501, "Not Implemented")
                return
            }

            // Route request
            val parsedUri = URLDecoder.decode(rawUri, "UTF-8")
            val baseSharedFolder = Environment.getExternalStorageDirectory() // Points to /sdcard

            when {
                parsedUri.startsWith("/api/files") -> {
                    handleApiRequest(out, parsedUri, baseSharedFolder)
                }
                parsedUri.startsWith("/stream") -> {
                    handleStreamRequest(out, parsedUri, rangeHeader, baseSharedFolder)
                }
                parsedUri == "/" -> {
                    sendDashboardResponse(out)
                }
                else -> {
                    sendErrorResponse(out, 404, "Not Found")
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "Request handling failed: ${e.message}")
            try {
                sendErrorResponse(out, 500, "Internal Server Error")
            } catch (ignored: Exception) {}
        } finally {
            try {
                reader.close()
                out.close()
                client.close()
            } catch (ignored: Exception) {}
        }
    }

    // Endpoint: GET /api/files
    private fun handleApiRequest(out: BufferedOutputStream, uri: String, baseDir: File) {
        val queryParams = getQueryParams(uri)
        val relativePath = queryParams["path"] ?: ""
        val targetDirectory = File(baseDir, relativePath)

        // Path Traversal Security check
        if (!isPathSafe(targetDirectory, baseDir)) {
            sendErrorResponse(out, 403, "Access Denied")
            return
        }

        if (!targetDirectory.exists() || !targetDirectory.isDirectory) {
            sendErrorResponse(out, 404, "Directory Not Found")
            return
        }

        val foldersList = mutableListOf<String>()
        val filesList = mutableListOf<String>()

        val files = targetDirectory.listFiles()
        if (files != null) {
            val supportedVideo = listOf("mp4", "mkv", "webm", "avi")
            val supportedAudio = listOf("mp3", "wav", "m4a")
            val supportedImage = listOf("jpg", "jpeg", "png", "webp")
            val allSupported = supportedVideo + supportedAudio + supportedImage

            for (file in files) {
                if (file.name.startsWith(".")) continue // Ignore hidden files

                val relItemPath = file.absolutePath.substring(baseDir.absolutePath.length)
                    .replace('\\', '/')
                    .trimStart('/')

                if (file.isDirectory) {
                    val folderJson = createItemJson(file.name, "folder", relItemPath, 0, "--", "", "directory")
                    foldersList.add(folderJson)
                } else if (file.isFile) {
                    val ext = getExtension(file.name)
                    if (allSupported.contains(ext)) {
                        val type = when {
                            supportedVideo.contains(ext) -> "video"
                            supportedAudio.contains(ext) -> "audio"
                            else -> "image"
                        }
                        val mime = mimeMap[ext] ?: "application/octet-stream"
                        val formattedSize = formatBytes(file.length())
                        val fileJson = createItemJson(file.name, type, relItemPath, file.length(), formattedSize, ".$ext", mime)
                        filesList.add(fileJson)
                    }
                }
            }
        }

        // Sort items alphabetically
        foldersList.sort()
        filesList.sort()

        val mergedList = foldersList + filesList
        val jsonArrayString = mergedList.joinToString(separator = ",", prefix = "[", postfix = "]")

        val responseBytes = jsonArrayString.toByteArray(Charsets.UTF_8)
        
        out.write("HTTP/1.1 200 OK\r\n".toByteArray())
        out.write("Content-Type: application/json\r\n".toByteArray())
        out.write("Content-Length: ${responseBytes.size}\r\n".toByteArray())
        out.write("Access-Control-Allow-Origin: *\r\n".toByteArray())
        out.write("Connection: close\r\n\r\n".toByteArray())
        out.write(responseBytes)
        out.flush()
    }

    // Endpoint: GET /stream?path=...
    private fun handleStreamRequest(out: BufferedOutputStream, uri: String, rangeHeader: String?, baseDir: File) {
        val queryParams = getQueryParams(uri)
        val relativePath = queryParams["path"] ?: ""
        val targetFile = File(baseDir, relativePath)

        // Path Traversal Security check
        if (!isPathSafe(targetFile, baseDir)) {
            sendErrorResponse(out, 403, "Access Denied")
            return
        }

        if (!targetFile.exists() || !targetFile.isFile) {
            sendErrorResponse(out, 404, "File Not Found")
            return
        }

        val fileSize = targetFile.length()
        val ext = getExtension(targetFile.name)
        val mime = mimeMap[ext] ?: "application/octet-stream"

        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            // Seek range parsing
            val rangeSpec = rangeHeader.substring(6)
            val parts = rangeSpec.split("-")
            val start: Long
            var end: Long

            try {
                start = parts[0].toLong()
                end = if (parts.size > 1 && parts[1].isNotEmpty()) parts[1].toLong() else fileSize - 1
            } catch (e: NumberFormatException) {
                sendErrorResponse(out, 416, "Requested Range Not Satisfiable")
                return
            }

            if (start >= fileSize || end >= fileSize || start > end) {
                out.write("HTTP/1.1 416 Requested Range Not Satisfiable\r\n".toByteArray())
                out.write("Content-Range: bytes */$fileSize\r\n".toByteArray())
                out.write("Connection: close\r\n\r\n".toByteArray())
                out.flush()
                return
            }

            val chunkSize = (end - start) + 1
            val fileStream = FileInputStream(targetFile)
            fileStream.skip(start)

            out.write("HTTP/1.1 206 Partial Content\r\n".toByteArray())
            out.write("Content-Range: bytes $start-$end/$fileSize\r\n".toByteArray())
            out.write("Accept-Ranges: bytes\r\n".toByteArray())
            out.write("Content-Length: $chunkSize\r\n".toByteArray())
            out.write("Content-Type: $mime\r\n".toByteArray())
            out.write("Access-Control-Allow-Origin: *\r\n".toByteArray())
            out.write("Connection: close\r\n\r\n".toByteArray())

            val buffer = ByteArray(8192)
            var bytesRemaining = chunkSize
            while (bytesRemaining > 0) {
                val toRead = Math.min(buffer.size.toLong(), bytesRemaining).toInt()
                val bytesRead = fileStream.read(buffer, 0, toRead)
                if (bytesRead == -1) break
                out.write(buffer, 0, bytesRead)
                bytesRemaining -= bytesRead
            }
            out.flush()
            fileStream.close()
        } else {
            // Stream entire file
            val fileStream = FileInputStream(targetFile)
            out.write("HTTP/1.1 200 OK\r\n".toByteArray())
            out.write("Accept-Ranges: bytes\r\n".toByteArray())
            out.write("Content-Length: $fileSize\r\n".toByteArray())
            out.write("Content-Type: $mime\r\n".toByteArray())
            out.write("Access-Control-Allow-Origin: *\r\n".toByteArray())
            out.write("Connection: close\r\n\r\n".toByteArray())

            val buffer = ByteArray(8192)
            while (true) {
                val bytesRead = fileStream.read(buffer)
                if (bytesRead == -1) break
                out.write(buffer, 0, bytesRead)
            }
            out.flush()
            fileStream.close()
        }
    }

    // Server Web Dashboard response
    private fun sendDashboardResponse(out: BufferedOutputStream) {
        val html = """
            <!DOCTYPE html>
            <html>
            <head>
              <title>FastDrop Mobile Server Active</title>
              <style>
                body { font-family: sans-serif; background: #0c101b; color: #e2e8f0; padding: 40px; text-align: center; }
                .card { background: #161f30; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #233554; }
                h1 { color: #0084ff; }
                .badge { background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>⚡ FastDrop Mobile Server <span class="badge">ON</span></h1>
                <p>The Android streaming server is active and running!</p>
                <p>Connect your Tizen TV to this hotspot and load the app.</p>
              </div>
            </body>
            </html>
        """.trimIndent()

        val responseBytes = html.toByteArray(Charsets.UTF_8)
        out.write("HTTP/1.1 200 OK\r\n".toByteArray())
        out.write("Content-Type: text/html\r\n".toByteArray())
        out.write("Content-Length: ${responseBytes.size}\r\n".toByteArray())
        out.write("Connection: close\r\n\r\n".toByteArray())
        out.write(responseBytes)
        out.flush()
    }

    private fun sendErrorResponse(out: BufferedOutputStream, code: Int, message: String) {
        val response = "HTTP/1.1 $code $message\r\nContent-Length: ${message.length}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n$message"
        out.write(response.toByteArray())
        out.flush()
    }

    // Path Safety verification
    private fun isPathSafe(file: File, baseDir: File): Boolean {
        return try {
            file.canonicalPath.startsWith(baseDir.canonicalPath)
        } catch (e: Exception) {
            false
        }
    }

    private fun getQueryParams(uri: String): Map<String, String> {
        val params = mutableMapOf<String, String>()
        val parts = uri.split("?")
        if (parts.size > 1) {
            val query = parts[1]
            val pairs = query.split("&")
            for (pair in pairs) {
                val index = pair.indexOf("=")
                if (index > 0) {
                    val key = pair.substring(0, index)
                    val value = pair.substring(index + 1)
                    params[key] = value
                }
            }
        }
        return params
    }

    private fun getExtension(filename: String): String {
        val lastDot = filename.lastIndexOf('.')
        return if (lastDot > 0) filename.substring(lastDot + 1).lowercase(Locale.ENGLISH) else ""
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes == 0L) return "0 Bytes"
        val k = 1024L
        val sizes = arrayOf("Bytes", "KB", "MB", "GB")
        val i = Math.floor(Math.log(bytes.toDouble()) / Math.log(k.toDouble())).toInt()
        return String.format(Locale.ENGLISH, "%.2f %s", bytes / Math.pow(k.toDouble(), i.toDouble()), sizes[i])
    }

    private fun createItemJson(name: String, type: String, relPath: String, size: Long, formattedSize: String, ext: String, mime: String): String {
        val cleanName = escapeJsonString(name)
        val cleanPath = escapeJsonString(relPath)
        return "{\"name\":\"$cleanName\",\"type\":\"$type\",\"relativePath\":\"$cleanPath\",\"size\":$size,\"sizeFormatted\":\"$formattedSize\",\"extension\":\"$ext\",\"mimeType\":\"$mime\"}"
    }

    private fun escapeJsonString(str: String): String {
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t")
    }
}
