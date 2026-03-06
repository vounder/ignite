package de.drvbund.jauns.main;

public enum Farbe {
HERZ,
KARO,
PIK,
KREUZ;

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
