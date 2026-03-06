package de.drvbund.jauns.main;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlRootElement;

@XmlRootElement
@XmlAccessorType(XmlAccessType.FIELD)
public class Spieler {

	private ArrayList<Karte> deck = new ArrayList<Karte>();
	private ArrayList<Item> inventar = new ArrayList<Item>();
	private ArrayList<Karte> hand = new ArrayList<Karte>();
	private ArrayList<Karte> ablage = new ArrayList<Karte>();

	private Integer aussetzRunden = null;

	private Karte kartenRückseite = new KartenBuilder().setLoaderIndex(0).build();

	private Integer addierWert = null;
	private Integer blockRundenAnzahl = null;
	private Integer zerstörungAnzahl = null;
	private Integer fluchRundenAnzahl = null;
	private Integer bonusGeldMult = null;
	private Integer kartenAnguckenRundenAnzahl = null;
	private Integer hodlWert = null;
	private Integer aussetzWert = null;

	private boolean tauschEffekt = false;
	private boolean spiegelEffekt = false;
	private boolean doppelEffekt = false;
	private boolean verbrennEffekt = false;
	private boolean vorhersageEffekt = false;
	private int gespenstRunde = 0;
	private Karte gespenstKarte = null;
	private boolean opferEffekt = false;
	private boolean zockenEffekt = false;
	private boolean zytokineseEffekt = false;
	private boolean zytokinese2Effekt = false;

	// Konstruktoren
	public Spieler() {
	} // leerer Konstruktor für JAXB

	public Spieler(ArrayList<Karte> deck, ArrayList<Item> inventar) {
		super();
		this.deck = deck;
		this.inventar = inventar;
	}

	// Getter
	public ArrayList<Karte> getDeck() {
		return deck;
	}

	public ArrayList<Item> getInventar() {
		return inventar;
	}

	public ArrayList<Karte> getHand() {
		return hand;
	}

	public Karte getKartenRückseite() {
		return kartenRückseite;
	}

	public int getAussetzRunden() {
		return aussetzRunden != null ? aussetzRunden : 0;
	}

	// Setter
	public void setDeck(ArrayList<Karte> deck) {
		this.deck = deck;
	}

	public void setInventar(ArrayList<Item> inventar) {
		this.inventar = inventar;
	}

	public void setHand(ArrayList<Karte> hand) {
		this.hand = hand;
	}

	public void setAussetzRunden(Integer aussetzRunden) {
		this.aussetzRunden = aussetzRunden;
	}

	/**
	 * Spielt eine Karte aus der Hand aus.
	 * Entfernt die Karte aus der Hand und führt ggf. weitere Aktionen aus.
	 *
	 * @param karte Die Karte, die gespielt werden soll.
	 */
	public void karteSpielen(Karte karte) {
		if (hand.contains(karte)) {
			hand.remove(karte);
			// TODO: Weitere Aktionen (z. B. auf Ablagestapel legen, Effekt auslösen)
			System.out.println("Gespielt: " + karte);
		} else {
			System.out.println("Karte nicht in Hand.");
		}
	}

	/**
	 * Zieht eine bestimmte Anzahl Karten vom Deck in die Hand.
	 * Berücksichtigt dabei den Fluch-Effekt, der zusätzliche Karten erzwingt.
	 *
	 * @param anzahl Die Anzahl der zu ziehenden Karten.
	 */
	public void karteZiehen(int anzahl) {
		if (fluchRundenAnzahl != null) {
			if (fluchRundenAnzahl > 0) {
				anzahl += 1;
				fluchRundenAnzahl -= 1;
			}
		}
		for (int i = 0; i < anzahl; i++) {
			if (!deck.isEmpty()) {
				Karte gezogene = deck.remove(0);
				hand.add(gezogene);
			} else {
				System.out.println("Keine Karten mehr im Deck.");
				break;
			}
		}
	}

	/**
	 * Baut das Deck aus der Ablage wieder auf.
	 * Fügt alle Karten aus der Ablage dem Deck hinzu,
	 * leert anschließend die Ablage und mischt das Deck.
	 */
	public void deckBauenAusAblage() {
		deck.addAll(ablage);
		ablage.clear();
		mischen();
	}

	public void mischen() {
		Collections.shuffle(deck);
	}

	/**
	 * Löscht alle Karten und Items des Spielers.
	 * Leert Deck, Hand, Ablage und Inventar vollständig.
	 */
	public void clearAlles() {
		deck.clear();
		hand.clear();
		ablage.clear();
		inventar.clear();
	}

	public void addCardToDeck(Karte karte) {
		deck.add(karte);
	}

	public void addToInventory(Item item) {
		inventar.add(item);
	}

	public ArrayList<Karte> getAblage() {
		return ablage;
	}

	public Integer getAddierWert() {
		return addierWert;
	}

	public Integer getBlockRundenAnzahl() {
		return blockRundenAnzahl;
	}

	public Integer getZerstörungAnzahl() {
		return zerstörungAnzahl;
	}

	public Integer getFluchRundenAnzahl() {
		return fluchRundenAnzahl;
	}

	public Integer getBonusGeldMult() {
		return bonusGeldMult;
	}

	public Integer getKartenAnguckenRundenAnzahl() {
		return kartenAnguckenRundenAnzahl;
	}

	public Integer getHodlWert() {
		return hodlWert;
	}

	public Integer getAussetzWert() {
		return aussetzWert;
	}

	public boolean isTauschEffekt() {
		return tauschEffekt;
	}

	public boolean isSpiegelEffekt() {
		return spiegelEffekt;
	}

	public boolean isDoppelEffekt() {
		return doppelEffekt;
	}

	public boolean isVerbrennEffekt() {
		return verbrennEffekt;
	}

	public boolean isVorhersageEffekt() {
		return vorhersageEffekt;
	}

	public int getGespenstRunde() {
		return gespenstRunde;
	}

	public Karte getGespenstKarte() {
		return gespenstKarte;
	}

	public boolean isOpferEffekt() {
		return opferEffekt;
	}

	public boolean isZockenEffekt() {
		return zockenEffekt;
	}

	public boolean isZytokineseEffekt() {
		return zytokineseEffekt;
	}

	public boolean isZytokinese2Effekt() {
		return zytokinese2Effekt;
	}

	public void setAblage(ArrayList<Karte> ablage) {
		this.ablage = ablage;
	}

	public void setKartenRückseite(Karte kartenRückseite) {
		this.kartenRückseite = kartenRückseite;
	}

	public void setAddierWert(Integer addierWert) {
		this.addierWert = addierWert;
	}

	public void setBlockRundenAnzahl(Integer blockRundenAnzahl) {
		this.blockRundenAnzahl = blockRundenAnzahl;
	}

	public void setZerstörungAnzahl(Integer zerstörungAnzahl) {
		this.zerstörungAnzahl = zerstörungAnzahl;
	}

	public void setFluchRundenAnzahl(Integer fluchRundenAnzahl) {
		this.fluchRundenAnzahl = fluchRundenAnzahl;
	}

	public void setBonusGeldMult(Integer bonusGeldMult) {
		this.bonusGeldMult = bonusGeldMult;
	}

	public void setKartenAnguckenRundenAnzahl(Integer kartenAnguckenRundenAnzahl) {
		this.kartenAnguckenRundenAnzahl = kartenAnguckenRundenAnzahl;
	}

	public void setHodlWert(Integer hodlWert) {
		this.hodlWert = hodlWert;
	}

	public void setAussetzWert(Integer aussetzWert) {
		this.aussetzWert = aussetzWert;
	}

	public void setTauschEffekt(boolean tauschEffekt) {
		this.tauschEffekt = tauschEffekt;
	}

	public void setSpiegelEffekt(boolean spiegelEffekt) {
		this.spiegelEffekt = spiegelEffekt;
	}

	public void setDoppelEffekt(boolean doppelEffekt) {
		this.doppelEffekt = doppelEffekt;
	}

	public void setVerbrennEffekt(boolean verbrennEffekt) {
		this.verbrennEffekt = verbrennEffekt;
	}

	public void setVorhersageEffekt(boolean vorhersageEffekt) {
		this.vorhersageEffekt = vorhersageEffekt;
	}

	public void setGespenstRunde(int gespenstRunde) {
		this.gespenstRunde = gespenstRunde;
	}

	public void setGespenstKarte(Karte gespenstKarte) {
		this.gespenstKarte = gespenstKarte;
	}

	public void setOpferEffekt(boolean opferEffekt) {
		this.opferEffekt = opferEffekt;
	}

	public void setZockenEffekt(boolean zockenEffekt) {
		this.zockenEffekt = zockenEffekt;
	}

	public void setZytokineseEffekt(boolean zytokineseEffekt) {
		this.zytokineseEffekt = zytokineseEffekt;
	}

	public void setZytokinese2Effekt(boolean zytokinese2Effekt) {
		this.zytokinese2Effekt = zytokinese2Effekt;
	}

}
