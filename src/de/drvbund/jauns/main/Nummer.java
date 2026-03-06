package de.drvbund.jauns.main;

public enum Nummer {
	ZWEI, DREI, VIER, FÜNF, SECHS, SIEBEN, ACHT, NEUN, ZEHN,
	BUBE, DAME, KÖNIG, ASS;
	
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
