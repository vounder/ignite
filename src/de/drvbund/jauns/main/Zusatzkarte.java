package de.drvbund.jauns.main;

/**
 * Definiert die möglichen Zusätze mit speziellen Effekten im Spiel.
 * Jede Zusatzkarte hat einen einzigartigen Effekt, der das Spielgeschehen beeinflusst.
 */
public enum Zusatzkarte {
	AUSSETZEN("⏸️"), // Spieler setzt eine Runde aus
	ADDIEREN("➕"), // Gegner muss Karten ziehen
	// SPIEGEL("🪞"), // Spezialeffekt zurück zum Absender
	TAUSCH("🔄"), // Die Hand wird getauscht
	// DOPPEL("✌️"), // Doppelte Wirkung
	// SPEZIALBLOCK("🚫"), // Blockiert Spezialeffekte
	// ZERSTÖRUNG("💥"), // Karten zerstören
	FLUCH("🧙‍♂️"), // Fluch zieht zusätzliche Karten
	BONUSGELD("💰"), // Mehr Geld
	SPY("🕵️"), // Karten des Gegners sehen
	// VERBRENNEN("🔥"), // Karte verbrennen/ablegen
	// VORHERSAGE("🔮"), // Sieht nächste Karten
	// GESPENST("👻"), // Wirkt später erneut
	OPFER("🩸"), // Karten opfern für Coins
	ZOCKEN("🎲"), // Karten ziehen und „zocken“
	ZYTOKINESE("🦠"), // Verwandelt sich in neue Karten
	ZYTOKINESE2("🧬"), // Verwandelt sich in Spezialkarten
	HODL("📈"); // HODL, Coins verdienen

	// Beispiele für zukünftige Zusätze:
	// DUELL("⚔️"),
	// ULTIMATUM("💣"),
	// ZIELSCHUSS("🎯"),

	private final String emoji;

	Zusatzkarte(String emoji) {
		this.emoji = emoji;
	}

	public String getEmoji() {
		return emoji;
	}

	/**
	 * Gibt den Namen des Enums mit großem Anfangsbuchstaben zurück.
	 *
	 * @return Der Name des Enum-Werts mit dem ersten Buchstaben großgeschrieben.
	 */
	public String getDisplayName() {
		String name = this.name().toLowerCase();
		return Character.toUpperCase(name.charAt(0)) + name.substring(1);
	}
}
