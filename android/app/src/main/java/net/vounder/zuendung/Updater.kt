package net.vounder.zuendung

import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Holt neuere Fassungen des Spiels vom Server: fragt die Dateiliste ab, lädt, was sich gegenüber der App und
 * der laufenden Fassung geändert hat, prüft jede Datei gegen ihre SHA-256 und meldet die Fassung dann als
 * bereit. Übernommen wird sie erst beim nächsten Start (oder wenn die Seite es verlangt), nie mittendrin.
 *
 * [report] bekommt den Stand: "ready" (nichts Neues), "load" (mit Bytes), "update" (liegt bereit), "error".
 */
class Updater(private val store: WebStore, private val origin: String, private val report: (String, Long, Long) -> Unit) {
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)

    /** Prüft im Hintergrund. Läuft schon eine Prüfung, meldet die sich weiter. */
    fun check() {
        if (!busy.compareAndSet(false, true)) return
        worker.execute {
            try {
                run()
            } catch (e: Exception) {
                report("error", 0, 0)
            } finally {
                busy.set(false)
            }
        }
    }

    private fun run() {
        val list = FileList.parse(String(fetch("$origin/files.json", 1 shl 20), Charsets.UTF_8))
        val active = store.active
        if (list.build == active.build) return report("ready", 0, 0)
        if (list.build == store.staged()) return report("update", 0, 0)

        // Nur was die App nicht schon unverändert mitbringt, braucht Platz im Speicher.
        val need = list.files.filter { (rel, entry) -> store.bundled.files[rel]?.hash != entry.hash }
        val total = need.values.sumOf { it.size }
        var done = 0L
        var told = 0L
        report("load", 0, total)
        for ((rel, entry) in need) {
            val target = store.data(list.build, rel)
            if (!(target.isFile && target.length() == entry.size && sha256(target) == entry.hash)) {
                target.parentFile?.mkdirs()
                val have = store.data(active.build, rel)
                if (active.files[rel]?.hash == entry.hash && have.isFile && sha256(have) == entry.hash) have.copyTo(target, overwrite = true)
                else download(rel, entry, target)
            }
            done += entry.size
            val now = System.currentTimeMillis()
            if (now - told > 120) {
                told = now
                report("load", done, total)
            }
        }
        store.stage(list)
        report("update", 0, 0)
    }

    private fun connect(address: String): HttpURLConnection {
        val connection = URL(address).openConnection() as HttpURLConnection
        connection.connectTimeout = 10000
        connection.readTimeout = 20000
        connection.instanceFollowRedirects = false
        val status = connection.responseCode
        if (status != 200) {
            connection.disconnect()
            throw IOException("$address: $status")
        }
        return connection
    }

    private fun fetch(address: String, limit: Int): ByteArray {
        val connection = connect(address)
        try {
            val bytes = connection.inputStream.use { it.readBytes() }
            if (bytes.size > limit) throw IOException("$address: zu groß")
            return bytes
        } finally {
            connection.disconnect()
        }
    }

    /** Lädt eine Datei unter einer Adresse, die an ihrem Inhalt hängt, und legt sie nur ab, wenn sie zur Liste passt. */
    private fun download(rel: String, entry: FileList.Entry, target: File) {
        val temp = File(target.path + ".part")
        val connection = connect("$origin/$rel?v=${entry.hash.take(12)}")
        try {
            val digest = MessageDigest.getInstance("SHA-256")
            var size = 0L
            connection.inputStream.use { input ->
                temp.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        size += count
                        if (size > entry.size) throw IOException("$rel: größer als angekündigt")
                        digest.update(buffer, 0, count)
                        output.write(buffer, 0, count)
                    }
                }
            }
            if (size != entry.size || hex(digest.digest()) != entry.hash) throw IOException("$rel: passt nicht zur Liste")
            if (!temp.renameTo(target)) throw IOException("$rel: nicht ablegbar")
        } finally {
            connection.disconnect()
            temp.delete()
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return hex(digest.digest())
    }

    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }
}
