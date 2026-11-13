package net.vounder.zuendung

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedDispatcher
import org.json.JSONObject
import java.io.FilterInputStream
import java.io.InputStream

/**
 * Zündung als App: eine WebView im Vollbild, die das Spiel unter seiner echten Adresse zeigt – die Dateien
 * dazu kommen aber aus der App ([WebStore]), nicht aus dem Netz. So startet es ohne Internet, und Spielstand
 * und Anmeldung hängen an derselben Adresse wie im Browser. Nur Konto-API und App-Download gehen ans Netz.
 * Neuere Fassungen lädt der [Updater]; die Seite zeigt den Fortschritt (web/js/offline.js) und stößt den
 * Wechsel an. Die Brücke zur Seite heißt window.ZuendungApp.
 */
class MainActivity : Activity() {
    private val origin: Uri = Uri.parse(BuildConfig.GAME_URL)
    private lateinit var store: WebStore
    private lateinit var updater: Updater
    private lateinit var web: WebView
    private var alive = true

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        store = WebStore(applicationContext)
        updater = Updater(store, BuildConfig.GAME_URL) { state, done, total -> tell(state, done, total) }

        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        web = WebView(this)
        web.setBackgroundColor(Color.rgb(11, 7, 6))
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100 // die Bühne hat feste Maße; die Schriftgröße des Systems würde sie sprengen
            setSupportZoom(false)
            setSupportMultipleWindows(false)
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString ZuendungApp/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        web.addJavascriptInterface(Bridge(), "ZuendungApp")
        web.webViewClient = Client()
        setContentView(web, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }
        }
        web.loadUrl(BuildConfig.GAME_URL + "/")
    }

    /** Meldet der Seite den Stand des Updaters. */
    private fun tell(state: String, done: Long, total: Long) = runOnUiThread {
        if (alive) web.evaluateJavascript("window.ZU&&ZU.offline&&ZU.offline.fromApp({state:'$state',done:$done,total:$total})", null)
    }

    /** Zurück (Geste oder Taste): Die Seite schließt Dialoge, pausiert den Run oder geht ins Menü; dort legt sich die App in den Hintergrund. */
    private fun back() {
        web.evaluateJavascript("!!(window.ZU&&ZU.app&&ZU.app.back&&ZU.app.back())") { handled ->
            if (handled != "true") moveTaskToBack(true)
        }
    }

    /** Bis Android 12 kommt „Zurück“ als Taste; sie wird hier abgefangen, bevor die WebView sie schluckt. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_BACK) return super.dispatchKeyEvent(event)
        if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) back()
        return true
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        immersive()
    }

    override fun onPause() {
        web.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        alive = false
        web.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) immersive()
    }

    private fun immersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
        }
    }

    private fun external(uri: Uri) {
        if (uri.scheme != "https" && uri.scheme != "http" && uri.scheme != "mailto") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            // kein Browser eingerichtet
        }
    }

    private fun own(uri: Uri) = uri.scheme == origin.scheme && uri.authority == origin.authority

    /** window.ZuendungApp: was die Seite von der App wissen und verlangen darf. */
    private inner class Bridge {
        @JavascriptInterface
        fun info(): String = JSONObject()
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("versionName", BuildConfig.VERSION_NAME)
            .put("build", store.active.build)
            .toString()

        /** Nach einer neueren Fassung des Spiels sehen und sie laden; die Antwort kommt über ZU.offline.fromApp. */
        @JavascriptInterface
        fun check() = updater.check()

        /** Eine fertig geladene Fassung übernehmen: Die Seite startet neu. */
        @JavascriptInterface
        fun apply() = runOnUiThread {
            store.apply()
            if (alive) web.loadUrl(BuildConfig.GAME_URL + "/")
        }

        /** Eine Adresse im Browser des Geräts öffnen (Download einer neuen App-Version). */
        @JavascriptInterface
        fun open(url: String) = runOnUiThread { external(Uri.parse(url)) }
    }

    private inner class Client : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val uri = request.url
            if (request.method != "GET" || !own(uri)) return null
            var rel = (uri.path ?: "/").removePrefix("/")
            if (rel.isEmpty() || rel.endsWith("/")) rel += "index.html"
            if (rel.startsWith("api/") || rel.startsWith("app/") || rel == "files.json") return null
            val (stream, size) = store.open(rel) ?: return null
            val range = request.requestHeaders.entries.firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value
            return respond(rel, stream, size, range)
        }

        /** Fremde Adressen (Lizenztexte, Quellen in den Credits) öffnet der Browser des Geräts. */
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (own(request.url)) return false
            external(request.url)
            return true
        }

        /** Hat das System den Seitenprozess beendet (Speichernot), baut sich die App neu auf statt abzustürzen. */
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            recreate()
            return true
        }
    }

    private fun respond(rel: String, stream: InputStream, size: Long, range: String?): WebResourceResponse {
        val type = TYPES[rel.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
        val text = type.startsWith("text/") || type.endsWith("json")
        val headers = HashMap<String, String>()
        headers["Cache-Control"] = "no-cache"
        headers["Accept-Ranges"] = "bytes"
        headers["X-Content-Type-Options"] = "nosniff"
        if (rel.endsWith(".html")) {
            headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
            headers["Referrer-Policy"] = "same-origin"
        }
        // Musik wird in Stücken angefragt (und beim Wechsel der Stufe mitten hinein gesprungen). Die WebView
        // überspringt den Anfang des Stücks selbst (sie liest die Länge über available() und ruft skip()),
        // begrenzt aber das Ende nicht. Von hier kommt deshalb der Strom vom Dateianfang, gekappt am Ende des
        // Stücks, dazu die Kopfzeilen.
        val match = range?.let { RANGE.matchEntire(it.trim()) }
        if (match != null && size > 0 && (match.groupValues[1].isNotEmpty() || match.groupValues[2].isNotEmpty())) {
            val first = match.groupValues[1].toLongOrNull()
            val second = match.groupValues[2].toLongOrNull()
            val start = if (first == null) maxOf(0L, size - (second ?: 0L)) else first
            val end = if (first == null || second == null) size - 1 else minOf(size - 1, second)
            if (start <= end && start < size) {
                headers["Content-Range"] = "bytes $start-$end/$size"
                return WebResourceResponse(type, if (text) "utf-8" else null, 206, "Partial Content", headers, Head(stream, end + 1))
            }
        }
        return WebResourceResponse(type, if (text) "utf-8" else null, 200, "OK", headers, stream)
    }

    /** Die ersten [left] Bytes eines Stroms; danach ist er zu Ende. */
    private class Head(source: InputStream, private var left: Long) : FilterInputStream(source) {
        override fun read(): Int {
            if (left <= 0) return -1
            val value = `in`.read()
            if (value >= 0) left--
            return value
        }

        override fun read(buffer: ByteArray, offset: Int, count: Int): Int {
            if (left <= 0) return -1
            val got = `in`.read(buffer, offset, minOf(count.toLong(), left).toInt())
            if (got > 0) left -= got
            return got
        }

        override fun skip(count: Long): Long {
            val moved = `in`.skip(minOf(count, left))
            if (moved > 0) left -= moved
            return moved
        }

        override fun available(): Int = minOf(`in`.available().toLong(), left).toInt()

        override fun markSupported() = false
    }

    private companion object {
        val RANGE = Regex("^bytes=(\\d*)-(\\d*)$")
        val TYPES = mapOf(
            "html" to "text/html", "js" to "text/javascript", "css" to "text/css", "json" to "application/json",
            "webmanifest" to "application/manifest+json", "txt" to "text/plain", "png" to "image/png", "jpg" to "image/jpeg",
            "svg" to "image/svg+xml", "ico" to "image/x-icon", "ttf" to "font/ttf", "mp3" to "audio/mpeg", "ogg" to "audio/ogg",
            "wav" to "audio/wav"
        )
    }
}
