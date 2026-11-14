plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/*
 * Zündung als Android-App: die Browser-Version aus ../web, fest eingepackt, in einer WebView.
 *
 * Signiert wird über die Umgebung (der Schlüssel liegt nie im Repository):
 * ZUENDUNG_KEYSTORE, ZUENDUNG_KEYSTORE_PASSWORD, ZUENDUNG_KEY_ALIAS, ZUENDUNG_KEY_PASSWORD.
 * Ohne sie bleibt der Release-Build unsigniert.
 *
 * -PgameUrl=http://10.0.2.2:8377 richtet die App zum Testen auf einen lokalen Server (nur Debug-Builds
 * dürfen ohne https laden), -Pnode=/pfad/zu/node wählt das Node für die Dateiliste.
 */
val keystore: String? = System.getenv("ZUENDUNG_KEYSTORE")
val gameUrl = ((findProperty("gameUrl") as String?) ?: "https://ignite.vounder.net").trimEnd('/')
val node = (findProperty("node") as String?) ?: "node"

/* Das Spiel wandert beim Bauen in die App: web/ ohne Werkzeuge, Tests und die App-Hülle des Browsers,
   dazu die Dateiliste (server/filelist.js), an der die App später erkennt, was der Server Neueres hat. */
val webAssets = layout.buildDirectory.dir("generated/webAssets")
val copyWeb = tasks.register<Sync>("copyWeb") {
    from(rootProject.file("../web")) {
        exclude("tools/**", "tests/**", "**/*.md", "sw.js", "files.json")
        into("web")
    }
    into(webAssets)
    preserve { include("files.json") }
}
val listWeb = tasks.register<Exec>("listWeb") {
    dependsOn(copyWeb)
    val source = webAssets.map { it.dir("web") }
    val target = webAssets.map { it.file("files.json") }
    inputs.dir(source)
    inputs.file(rootProject.file("../server/filelist.js"))
    outputs.file(target)
    commandLine(node, rootProject.file("../server/filelist.js").path, source.get().asFile.path)
    doFirst { standardOutput = target.get().asFile.outputStream() }
}

android {
    namespace = "net.vounder.zuendung"
    compileSdk = 36

    defaultConfig {
        applicationId = "net.vounder.zuendung"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "GAME_URL", "\"$gameUrl\"")
    }

    signingConfigs {
        if (keystore != null) create("release") {
            storeFile = file(keystore)
            storePassword = System.getenv("ZUENDUNG_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("ZUENDUNG_KEY_ALIAS") ?: "zuendung"
            keyPassword = System.getenv("ZUENDUNG_KEY_PASSWORD") ?: System.getenv("ZUENDUNG_KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystore != null) signingConfig = signingConfigs.getByName("release")
        }
    }
    sourceSets["main"].assets.srcDir(webAssets)
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

tasks.named("preBuild") { dependsOn(listWeb) }
