"""Setzt die Build-Kennung der Browser-Version (nicht die sichtbare Versionsnummer ZU.VERSION).

Bildet einen kurzen Hash ueber alle ausgelieferten Dateien und traegt ihn in index.html
(Skript- und Stylesheet-Adressen) und js/data.js (ZU.BUILD, fuer Bilder und Musik) ein.
Vor jedem Deployment ausfuehren, damit Browser und CDN die neuen Dateien holen:

    python web/tools/stamp_version.py
"""
import hashlib
import re
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
SKIP = {"tools", "tests"}
MARK = re.compile(r"\?v=[0-9a-z]+")
# Fliesst in die Kennung ein. Hochzaehlen erzwingt neue Adressen fuer alle Dateien, ohne dass sich
# ihr Inhalt aendert - noetig, wenn das CDN unter einer Adresse eine Fehlerantwort gespeichert hat
# (z. B. weil eine Datei abgefragt wurde, bevor das Release aktiv war).
EPOCH = 2


def neutral(path):
    """Dateiinhalt ohne die Versionskennung selbst, damit der Hash stabil bleibt."""
    data = path.read_bytes()
    if path.name == "index.html":
        data = MARK.sub("?v=", data.decode("utf-8")).encode("utf-8")
    elif path.name == "data.js":
        data = re.sub(r"ZU\.BUILD = '[^']*'", "ZU.BUILD = ''", data.decode("utf-8")).encode("utf-8")
    return data.replace(b"\r\n", b"\n") if path.suffix in (".html", ".js", ".css") else data


def main():
    digest = hashlib.sha256()
    digest.update(b"epoch:%d" % EPOCH)
    for path in sorted(WEB.rglob("*")):
        if path.is_file() and not (set(path.relative_to(WEB).parts[:1]) & SKIP) and path.suffix != ".md":
            digest.update(path.relative_to(WEB).as_posix().encode("utf-8"))
            digest.update(neutral(path))
    version = digest.hexdigest()[:10]

    index = WEB / "index.html"
    text = index.read_text(encoding="utf-8")
    index.write_text(MARK.sub("?v=" + version, text), encoding="utf-8", newline="\n")

    data = WEB / "js" / "data.js"
    text = data.read_text(encoding="utf-8")
    data.write_text(re.sub(r"ZU\.BUILD = '[^']*'", "ZU.BUILD = '" + version + "'", text), encoding="utf-8", newline="\n")
    print("Build", version)


if __name__ == "__main__":
    main()
