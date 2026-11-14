package net.vounder.zuendung

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream

/** Eine Fassung des Spiels: Kennung und je Datei SHA-256 und Größe (das Format von server/filelist.js). */
class FileList(val build: String, val files: Map<String, Entry>, val json: String) {
    class Entry(val hash: String, val size: Long)

    companion object {
        private val PATH = Regex("^[A-Za-z0-9_-][A-Za-z0-9_.-]*(/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$")
        private val BUILD = Regex("^[0-9a-f]{8,64}$")
        private val HASH = Regex("^[0-9a-f]{64}$")

        /** Liest eine Liste; lehnt alles ab, was nicht wie eine aussieht (auch Pfade, die aus dem Ordner führen). */
        fun parse(text: String): FileList {
            val root = JSONObject(text)
            val build = root.getString("build")
            require(BUILD.matches(build)) { "Kennung" }
            val source = root.getJSONObject("files")
            val files = HashMap<String, Entry>()
            for (rel in source.keys()) {
                val pair = source.getJSONArray(rel)
                val hash = pair.getString(0)
                val size = pair.getLong(1)
                require(PATH.matches(rel) && HASH.matches(hash) && size >= 0) { "Eintrag $rel" }
                files[rel] = Entry(hash, size)
            }
            require(files.containsKey("index.html")) { "index.html fehlt" }
            return FileList(build, files, text)
        }
    }
}

/**
 * Die Dateien des Spiels auf dem Gerät. Die App bringt eine vollständige Fassung mit (assets/web, Liste in
 * assets/files.json). Neuere Fassungen vom Server liegen daneben im App-Speicher – nur die Dateien, die sich
 * von der mitgebrachten unterscheiden:
 *
 *     files/web/shell            Stempel dieser Installation
 *     files/web/current          Kennung der Fassung, die läuft (fehlt: die mitgebrachte)
 *     files/web/staged           Kennung einer fertig geladenen neueren; sie rückt beim nächsten Start nach
 *     files/web/b-<Kennung>/     files.json und data/<Pfad>
 */
class WebStore(private val context: Context) {
    val bundled: FileList = context.assets.open("files.json").use { FileList.parse(it.readBytes().toString(Charsets.UTF_8)) }
    private val root = File(context.filesDir, "web")

    /** Die Fassung, aus der gerade ausgeliefert wird. */
    @Volatile
    var active: FileList = bundled
        private set

    init {
        root.mkdirs()
        // Eine neu installierte App bringt die neuere Fassung selbst mit: Was vorher nachgeladen war, entfällt.
        val stamp = BuildConfig.VERSION_CODE.toString() + ":" + installTime()
        if (read("shell") != stamp) {
            root.listFiles()?.forEach { it.deleteRecursively() }
            write("shell", stamp)
        }
        promote()
        active = read("current")?.let { load(it) } ?: bundled
        val keep = setOf("b-" + active.build, "b-" + (read("staged") ?: ""))
        root.listFiles()?.forEach { if (it.isDirectory && it.name !in keep) it.deleteRecursively() }
    }

    private fun installTime(): Long = try {
        context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime
    } catch (e: Exception) {
        0L
    }

    private fun read(name: String): String? = try {
        File(root, name).takeIf { it.isFile }?.readText()?.trim()?.takeIf { it.isNotEmpty() }
    } catch (e: IOException) {
        null
    }

    private fun write(name: String, value: String) {
        val temp = File(root, "$name.tmp")
        temp.writeText(value)
        if (!temp.renameTo(File(root, name))) throw IOException("$name nicht schreibbar")
    }

    private fun dir(build: String) = File(root, "b-$build")

    /** Ablageort einer nachgeladenen Datei der Fassung [build]. */
    fun data(build: String, rel: String) = File(File(dir(build), "data"), rel)

    private fun load(build: String): FileList? = try {
        FileList.parse(File(dir(build), "files.json").readText()).takeIf { it.build == build }
    } catch (e: Exception) {
        null
    }

    /** Kennung der fertig geladenen Fassung, die auf den nächsten Start wartet. */
    fun staged(): String? = read("staged")?.takeIf { load(it) != null }

    /** Der Updater hat alle Dateien von [list] abgelegt: Die Fassung gilt als vollständig und wartet. */
    fun stage(list: FileList) {
        dir(list.build).mkdirs()
        val temp = File(dir(list.build), "files.json.tmp")
        temp.writeText(list.json)
        if (!temp.renameTo(File(dir(list.build), "files.json"))) throw IOException("Liste nicht schreibbar")
        write("staged", list.build)
    }

    private fun promote(): Boolean {
        val next = staged() ?: return false
        write("current", next)
        File(root, "staged").delete()
        return true
    }

    /** Übernimmt eine wartende Fassung sofort (die Seite wird danach neu geladen). */
    fun apply(): Boolean {
        if (!promote()) return false
        active = read("current")?.let { load(it) } ?: bundled
        return true
    }

    /** Öffnet eine Datei der laufenden Fassung: aus der App, wenn sie dort unverändert liegt, sonst aus dem Speicher. */
    fun open(rel: String): Pair<InputStream, Long>? {
        val list = active
        val entry = list.files[rel] ?: return null
        return try {
            if (bundled.files[rel]?.hash == entry.hash) context.assets.open("web/$rel") to entry.size
            else data(list.build, rel).takeIf { it.isFile && it.length() == entry.size }?.let { FileInputStream(it) to entry.size }
        } catch (e: IOException) {
            null
        }
    }
}
