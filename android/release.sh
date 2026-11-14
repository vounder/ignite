#!/usr/bin/env bash
# Baut die signierte Android-App und legt sie so ab, wie der Server sie unter /app/ ausliefert:
#
#     . /pfad/zu/keystore.env && android/release.sh [Zielordner]
#
# Im Zielordner (Standard: android/build/release) liegen danach zuendung-<Version>.apk und android.json.
# Beides gehört in den APP_DIR des Servers; android.json zuletzt, sie schaltet den Download frei.
set -euo pipefail
cd "$(dirname "$0")"
: "${ZUENDUNG_KEYSTORE:?Signaturschlüssel fehlt: ZUENDUNG_KEYSTORE und ZUENDUNG_KEYSTORE_PASSWORD setzen (siehe README.md)}"
out="${1:-build/release}"
sdk="${ANDROID_HOME:-$(sed -n 's/^sdk.dir=//p' local.properties 2>/dev/null)}"
signer="$(ls "$sdk"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)"
[ -x "$signer" ] || { echo "apksigner nicht gefunden (ANDROID_HOME oder local.properties)"; exit 1; }

name="$(sed -n 's/^ *versionName = "\(.*\)"$/\1/p' app/build.gradle.kts)"
code="$(sed -n 's/^ *versionCode = \([0-9]*\)$/\1/p' app/build.gradle.kts)"
./gradlew -q assembleRelease "${@:2}"
apk=app/build/outputs/apk/release/app-release.apk
"$signer" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: /Signatur (SHA-256): /p'

mkdir -p "$out"
file="zuendung-$name.apk"
cp "$apk" "$out/$file"
size="$(stat -c %s "$out/$file")"
hash="$(sha256sum "$out/$file" | cut -d' ' -f1)"
printf '{"versionCode":%s,"versionName":"%s","file":"%s","size":%s,"sha256":"%s"}\n' "$code" "$name" "$file" "$size" "$hash" > "$out/android.json"
echo "$out/$file ($((size / 1048576)) MB), Version $name ($code)"
