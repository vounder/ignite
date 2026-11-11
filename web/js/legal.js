/* Zündung – Rechtstexte (Impressum, Datenschutz, Lizenzen).
   WICHTIG: Die Angaben unter OPERATOR müssen vor der Veröffentlichung ausgefüllt werden.
   Die Datenschutzerklärung beschreibt, was diese Software technisch tut; sie ist ein Entwurf
   und ersetzt keine rechtliche Prüfung. */
(function (ZU) {
  'use strict';

  var OPERATOR = {
    name: '[Vor- und Nachname]',
    street: '[Straße und Hausnummer]',
    city: '[PLZ und Ort]',
    email: '[E-Mail-Adresse]'
  };

  function address() {
    return OPERATOR.name + '<br>' + OPERATOR.street + '<br>' + OPERATOR.city;
  }

  ZU.LEGAL = {
    operator: OPERATOR,

    imprint: function () {
      return '<h3>Angaben gemäß § 5 DDG</h3>' +
        '<p>' + address() + '</p>' +
        '<h3>Kontakt</h3>' +
        '<p>E-Mail: ' + OPERATOR.email + '</p>' +
        '<h3>Verantwortlich für den Inhalt</h3>' +
        '<p>' + OPERATOR.name + ', Anschrift wie oben</p>';
    },

    privacy: function () {
      return '<h3>Verantwortlicher</h3>' +
        '<p>' + address() + '<br>E-Mail: ' + OPERATOR.email + '</p>' +
        '<h3>Aufruf der Seite</h3>' +
        '<p>Die Seite wird über Cloudflare (Cloudflare, Inc.) ausgeliefert. Dabei wird deine IP-Adresse technisch verarbeitet, um die Seite sicher und schnell bereitzustellen (Art. 6 Abs. 1 lit. f DSGVO). ' +
        'Der Spielserver selbst führt keine Zugriffsprotokolle. Zum Schutz vor Missbrauch hält er IP-Adressen höchstens eine Stunde im Arbeitsspeicher.</p>' +
        '<h3>Speicher im Browser</h3>' +
        '<p>Spielstand, Statistik und Einstellungen liegen im lokalen Speicher deines Browsers und bleiben auf deinem Gerät. Es gibt keine Analyse, kein Tracking und keine Werbung.</p>' +
        '<h3>Konto (freiwillig)</h3>' +
        '<p>Wenn du ein Konto anlegst, speichern wir Name, E-Mail-Adresse, ein nicht umkehrbar verschlüsseltes Passwort, das Registrierungsdatum, deine Spielstatistik (Runs, Siege, Bestwert, höchster Akt) und deinen Spielfortschritt (Asche, Freischaltungen, Upgrades, Einsätze, besiegte Gegner). ' +
        'Das dient der Anmeldung und dem Sichern der Statistik (Art. 6 Abs. 1 lit. b DSGVO). Die E-Mail-Adresse wird ausschließlich zum Zurücksetzen des Passworts verwendet.</p>' +
        '<p>Nach der Anmeldung setzt die Seite ein technisch notwendiges Sitzungs-Cookie (30 Tage). Weitere Cookies gibt es nicht.</p>' +
        '<p>Die Daten bleiben gespeichert, bis du dein Konto löschst. Das geht jederzeit im Spiel unter „Konto“.</p>' +
        '<h3>Deine Rechte</h3>' +
        '<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Schreib dazu an die oben genannte Adresse.</p>';
    },

    licenses: function () {
      return '<h3>Spiel</h3>' +
        '<p>Zündung steht unter der MIT-Lizenz. Der Quelltext kommt ohne fremde Bibliotheken aus.</p>' +
        '<h3>Grafik, Schrift und Ton</h3>' +
        '<p>Figuren, Karten-Illustrationen, Symbole und Musik wurden eigens für Zündung erzeugt. Der Pixel-Font ist eine Eigenentwicklung, alle Soundeffekte entstehen zur Laufzeit.</p>';
    }
  };
})(window.ZU = window.ZU || {});
