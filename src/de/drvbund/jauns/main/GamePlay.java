package de.drvbund.jauns.main;

import java.awt.Font;
import java.awt.GraphicsEnvironment;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Random;

import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.FloatControl;
import javax.swing.SwingUtilities;

public class GamePlay {

	public static int fensterWidth = 1600;
	public static int fensterHeight = 900;

	private static final int referenzWidth = 1600;
	private static final int referenzHeight = 900;

	private GameState state = GameState.getInstance();

	private ArrayList<Karte> standardSet = erzeugeStandardSet();

	private Spiel zeichner;
	private boolean listenerRegistriert = false;

	private Clip hintergrundmusik;

	private int zugAnzahl = 0;

	public Font jokerFont = null;
	public Font bitFont = null;

	public int belohnung = 0;

	// Effekte
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
	private boolean opferEffekt = false;
	private boolean zockenEffekt = false;
	private boolean zytokineseEffekt = false;
	private boolean zytokinese2Effekt = false;

	private boolean gespenstEffekt = false;
	private int gespenstRunde = 0;
	private Karte gespenstKarte = null;

	Spieler zugSpieler = null;
	Spieler zugGegner = null;
	
	public PerformanceCheck pCheck = new PerformanceCheck();

	private boolean spielerZug = true;
	private List<SpielerZugListener> spielerZugListener = new ArrayList<>();
	
	private Random rnd = new Random();

	/**
	 * Konstruktor für die GamePlay-Klasse.
	 * <p>
	 * Initialisiert und registriert benutzerdefinierte Schriftarten ({@code jqkas.ttf} und {@code 8bit.ttf}) aus den Ressourcen.
	 * Falls die Schriften nicht gefunden oder nicht geladen werden können, wird jeweils auf eine Standard-Schriftart zurückgegriffen.
	 * Fehler beim Laden oder Registrieren der Fonts werden auf der Konsole ausgegeben.
	 * </p>
	 */
	public GamePlay() {
		
		try (InputStream is = getClass().getResourceAsStream("/misc/fonts/jqkas.ttf")) {
		    if (is != null) {
		        jokerFont = Font.createFont(Font.TRUETYPE_FONT, is).deriveFont(28f);
		        GraphicsEnvironment.getLocalGraphicsEnvironment().registerFont(jokerFont);
		    } else {
		        System.err.println("Font jqkas.ttf nicht gefunden!");
		        jokerFont = new Font("Arial", Font.PLAIN, 28);
		    }
		} catch (Exception e) {
		    e.printStackTrace();
		    jokerFont = new Font("Arial", Font.PLAIN, 28);
		}

		try (InputStream is = getClass().getResourceAsStream("/misc/fonts/8bit.ttf")) {
		    if (is != null) {
		        bitFont = Font.createFont(Font.TRUETYPE_FONT, is).deriveFont(28f);
		        GraphicsEnvironment.getLocalGraphicsEnvironment().registerFont(bitFont);
		    } else {
		        System.err.println("Font 8bit.ttf nicht gefunden!");
		        bitFont = new Font("Arial", Font.PLAIN, 28);
		    }
		} catch (Exception e) {
		    e.printStackTrace();
		    bitFont = new Font("Arial", Font.PLAIN, 28);
		}


	}

	/**
	 * Erzeugt und gibt das Standard-Deck aller Spielkarten zurück.
	 * <p>
	 * Lädt zunächst den Kartenrücken als Ressource und erstellt dann für jede Farbkombination und jede Nummer eine neue {@link Karte}.
	 * Spezielle Nummern wie {@code SIEBEN} und {@code ACHT} erhalten passende Zusatzeffekte (z.B. {@link Zusatzkarte#ADDIEREN}, {@link Zusatzkarte#AUSSETZEN}).
	 * Jede Karte wird mit dem passenden Ressourcenpfad initialisiert, optional per Upgrade angepasst und anschließend dem Deck hinzugefügt.
	 * Gibt das vollständige Standard-Deck als {@link ArrayList} zurück.
	 * </p>
	 *
	 * @return Das generierte Standard-Deck.
	 */
	public static ArrayList<Karte> erzeugeStandardSet() {
	    // Kartenrücken zuerst laden
	    RessourceLoader.getInstance().addRessource("/kenney_playing-cards-pack/PNG/Cards (large)/card_back.png");
	    ArrayList<Karte> deck = new ArrayList<>();
	    for (Farbe farbe : Farbe.values()) {
	        for (Nummer nummer : Nummer.values()) {

	            EnumSet<Zusatzkarte> zusätze = null;
	            Integer kartenZiehenAnzahl = null;

	            if (nummer == Nummer.SIEBEN) {
	                zusätze = EnumSet.of(Zusatzkarte.ADDIEREN, Zusatzkarte.AUSSETZEN);
	            } else if (nummer == Nummer.ACHT) {
	                zusätze = EnumSet.of(Zusatzkarte.AUSSETZEN);
	            }

	            String dateiname = farbe.name().toLowerCase() + "_" + nummer.name().toLowerCase() + ".png";
	            String resourcePath = "/kenney_playing-cards-pack/PNG/Cards (large)/" + dateiname;


	            Karte karte = new KartenBuilder()
	                    .setFarbe(farbe)
	                    .setNummer(nummer)
	                    .setZusätze(zusätze)
	                    .setAddierWert(kartenZiehenAnzahl)
	                    .setBeschreibung("Diese Karte hat keinen Effekt.")
	                    .setPreis(1)
	                    .setLoaderIndex(RessourceLoader.getInstance().addRessource(resourcePath))
	                    .build();

	            KartenGenerator.kartenUpgradeStandardSet(karte);
	            deck.add(karte);
	        }
	    }
	    return deck;
	}


	/**
	 * Fügt einen {@link SpielerZugListener} zur Listener-Liste hinzu.
	 * <p>
	 * Ermöglicht das Registrieren von Listenern, die über Zugwechsel informiert werden.
	 * Gibt eine Bestätigungsmeldung auf der Konsole aus.
	 * </p>
	 *
	 * @param listener Der zu registrierende Listener.
	 */
	public void addSpielerZugListener(SpielerZugListener listener) {
		spielerZugListener.add(listener);
		System.out.println("Listener hinzugefügt");
	}
	
	/**
	 * Entfernt alle registrierten {@link SpielerZugListener} und setzt das Listener-Registrierungs-Flag zurück.
	 * <p>
	 * Leert die interne Listener-Liste und markiert, dass keine Listener mehr registriert sind.
	 * </p>
	 */
	public void clearSpielerZugListener() {
		spielerZugListener.clear();
		listenerRegistriert = false;
	}

	/**
	 * Wechselt den aktiven Spielerzug und überspringt Spieler, die aussetzen müssen.
	 * <p>
	 * Schaltet abwechselnd zwischen Spieler und Gegner, solange der aktuelle Spieler noch Aussetzrunden hat.
	 * Reduziert dabei die Anzahl der Aussetzrunden und gibt entsprechende Konsolenmeldungen aus.
	 * Benachrichtigt anschließend alle registrierten {@link SpielerZugListener}, dass der Zug gewechselt wurde.
	 * </p>
	 */
	public void toggleSpielerZug() {
	    // Wechsle den Zug, bis der aktuelle Spieler nicht mehr aussetzen muss
	    do {
	        spielerZug = !spielerZug;
	        zugAnzahl++;
	        Spieler aktuellerSpieler = spielerZug ? GameState.getInstance().getSpieler()
	                                              : GameState.getInstance().getGegner();

	        if (aktuellerSpieler.getAussetzRunden() > 0) {
	            aktuellerSpieler.setAussetzRunden(aktuellerSpieler.getAussetzRunden() - 1);
	            System.out.println((spielerZug ? "Spieler" : "Gegner") + " setzt aus, Aussetzrunde -1");
	            // Wenn er noch mehr Aussetzrunden hat, weiter skippen
	        } else {
	            break;
	        }
	    } while (true);

	    // Listener aufrufen
	    for (SpielerZugListener listener : spielerZugListener) {
	        listener.onSpielerZugGewechselt(spielerZug);
	        System.out.println("listener hat zugehört");
	    }
	    System.out.println("Zug gewechselt → Spieler ist dran: " + spielerZug);
	}

	/**
	 * Skaliert einen Standard-Pixelwert proportional zur aktuellen Fenstergröße.
	 * <p>
	 * Berechnet einen Skalierungsfaktor auf Basis des Verhältnisses von aktueller Fensterbreite und -höhe
	 * zu den Referenzwerten. Der Mittelwert der beiden Faktoren sorgt für eine gleichmäßige Skalierung
	 * auf allen Bildschirmgrößen. Gibt den skalierten Wert als Ganzzahl zurück.
	 * </p>
	 *
	 * @param standardPixelWert Der zu skalierende Pixelwert (ausgehend von der Referenzgröße).
	 * @return Der skalierte Pixelwert, angepasst an die aktuelle Fenstergröße.
	 */
	public static int skalieren(int standardPixelWert) {
		// Verhältnis aus Breite und Höhe berechnen
		double faktorW = fensterWidth / (double) referenzWidth;
		double faktorH = fensterHeight / (double) referenzHeight;

		// Mittelwert der Skalierungsfaktoren nehmen (für konsistente Skalierung)
		double faktor = (faktorW + faktorH) / 2.0;

		return (int) (standardPixelWert * faktor);
	}

	/**
	 * Fügt dem übergebenen Deck eine Kopie der angegebenen Karte hinzu.
	 * <p>
	 * Erstellt eine neue Instanz der übergebenen {@link Karte} (Kopier-Konstruktor) und fügt sie der übergebenen Kartenliste hinzu.
	 * Gibt das aktualisierte Deck zurück.
	 * </p>
	 *
	 * @param deck  Das Kartendeck, dem die Karte hinzugefügt werden soll.
	 * @param karte Die Karte, die hinzugefügt werden soll (als Kopie).
	 * @return Das aktualisierte Kartendeck.
	 */

	public ArrayList<Karte> karteZuDeckHinzufügen(ArrayList<Karte> deck, Karte karte) {
		Karte neueKarte = new Karte(karte);
		deck.add(neueKarte);
		return deck;
	}

	/**
	 * Startet das Spiel, indem versucht wird, den Spielstand aus einer XML-Datei zu laden.
	 * 
	 * Falls das Laden fehlschlägt (z.B. Datei nicht vorhanden oder fehlerhaft), 
	 * wird ein neuer Spielstand mit {@link #newRun()} gestartet.
	 * 
	 * Nach erfolgreichem Laden wird die nächste Runde mit {@link #continueRound()} fortgesetzt.
	 */
	public void play() {
	    String speicherpfad = getSavePath();
	    GameState gameState = null;
	    try {
	        gameState = GameState.loadFromXml(speicherpfad);
	    } catch (Exception e) {
	        // Falls doch Exception kommt, newRun aufrufen
	        newRun();
	        return;
	    }
	    if (gameState == null) {
	        newRun();
	    } else {
	        System.out.println("eingelesen");
	        continueRound();
	    }
	}


	/**
	 * Gibt den Speicherpfad für den Spielstand zurück und erstellt den Zielordner bei Bedarf.
	 * <p>
	 * Ermittelt das Benutzerverzeichnis des Systems und erzeugt darin einen Ordner <code>.zuendung</code> 
	 * (unsichtbar auf Linux/Mac, sichtbar unter Windows), sofern dieser noch nicht existiert.
	 * Gibt den vollständigen Pfad zur Spielstand-Datei <code>spielstand.xml</code> im erstellten Ordner zurück.
	 * </p>
	 *
	 * @return Der vollständige Dateipfad zum Spielstand (<code>spielstand.xml</code>).
	 */
	public static String getSavePath() {
	    String userHome = System.getProperty("user.home");
	    String ordner = userHome + "/.zuendung"; // Unsichtbar unter Linux/Mac, sichtbar unter Windows
	    File dir = new File(ordner);
	    if (!dir.exists()) dir.mkdirs();
	    return ordner + "/spielstand.xml";
	}

	/**
	 * Startet einen neuen Spieldurchlauf (Run) und initialisiert den Spieler sowie die erste Runde.
	 * <p>
	 * Erstellt einen neuen {@link Spieler}, setzt den Score im {@link GameState} zurück (Testwert 100), 
	 * leert alle Spieler-Daten, kopiert das Standard-Deck und mischt es.
	 * Anschließend werden die ersten 16 Karten als neues Spieler-Deck gesetzt.
	 * Der Spieler wird im {@link GameState} gespeichert, die Zuganzahl zurückgesetzt und eine neue Runde gestartet.
	 * </p>
	 *
	 * <p>
	 * Nebenwirkungen:<br>
	 * - Setzt globale Zustände wie Spieler, Score und Zuganzahl im {@link GameState}.<br>
	 * - Ruft {@link #newRound()} auf, um das Spiel fortzusetzen.
	 * </p>
	 */
	public void newRun() {
		Spieler neuerSpieler = new Spieler();
		// test
		GameState.getInstance().setLevel(0);
		GameState.getInstance().setScore(100);
		
		neuerSpieler.clearAlles();
		neuerSpieler.setDeck(cloneDeck(standardSet));
		neuerSpieler.mischen();

		ArrayList<Karte> tmpDeck = neuerSpieler.getDeck();
		ArrayList<Karte> neuDeck = new ArrayList<Karte>();

		for (int i = 0; i < 16; i++) {
			neuDeck.add(tmpDeck.get(i));
		}
		tmpDeck.clear();
		neuerSpieler.setDeck(neuDeck);

		GameState.getInstance().setSpieler(neuerSpieler);
		zugAnzahl = 0;
		newRound();
	}

	/**
	 * Startet eine neue Spielrunde, erhöht das Level und initialisiert Gegner und Spieler für die nächste Runde.
	 * <p>
	 * Erhöht das aktuelle Level im {@link GameState} und beendet laufende Ereignisse im Zeichner.
	 * Erstellt einen neuen Gegner, generiert eine Startkarte und mischt die Decks von Spieler und Gegner.
	 * Karten aus der Spieler-Ablage werden zurück ins Deck gegeben, die Ablage danach geleert.
	 * Anschließend ziehen Spieler und Gegner jeweils vier Karten, und die Startkarte wird als letzte Karte gesetzt.
	 * Beim ersten Aufruf wird ein Listener für Spielerzug-Wechsel registriert, der dafür sorgt, dass der Gegner automatisch zieht und spielt, wenn der Spieler nicht am Zug ist.
	 * </p>
	 *
	 * <p>
	 * Nebenwirkungen:<br>
	 * - Manipuliert den globalen Spielzustand ({@link GameState}), Decks und Ablagen von Spieler und Gegner.<br>
	 * - Registriert einen Listener für Zugwechsel (nur beim ersten Aufruf).
	 * </p>
	 */
	public void newRound() {
		
		int nextLevel = GameState.getInstance().getLevel() + 1;
		GameState.getInstance().setLevel(nextLevel);

		if (zeichner != null) {
			zeichner.eventsBeenden(); // Notlösung, unelegant, aber klappt
		}

		neuerGegner();
		Karte ersteKarte = KartenGenerator.generiereNormaleZufallsKarte();

		// Erst Kopie machen, dann iterieren!
		List<Karte> spielerAblageKopie = new ArrayList<>(GameState.getInstance().getSpieler().getAblage());
		for (Karte karte : spielerAblageKopie) {
		    GameState.getInstance().getSpieler().addCardToDeck(karte);
		}
		// Danach Original-Ablage komplett leeren:
		GameState.getInstance().getSpieler().getAblage().clear();
		
		GameState.getInstance().getGegner().mischen();
		GameState.getInstance().getSpieler().mischen();
		GameState.getInstance().getSpieler().karteZiehen(4);
		GameState.getInstance().getGegner().karteZiehen(4);
		GameState.getInstance().setLastCard(ersteKarte);

		// Nur beim ersten Mal Listener registrieren
		if (!listenerRegistriert) {
			addSpielerZugListener(spielerIstDran -> {
				if (!spielerIstDran) {
					SwingUtilities.invokeLater(() -> {

						System.out.println("animiertGerade: " + zeichner.animiertGerade());
						System.out.println("eventsAmLaufen: " + zeichner.eventsAmLaufen());

						if (!zeichner.animiertGerade() && !zeichner.eventsAmLaufen()) {
							System.out.println("Gegner zieht und spielt");
							gegnerZiehtUndSpielt();
						}
					});
				}
			});

			listenerRegistriert = true;
		}
	}
	
	public void continueRound() {

		if (zeichner != null) {
			zeichner.eventsBeenden(); // Notlösung, unelegant, aber klappt
		}

		Karte ersteKarte = KartenGenerator.generiereNormaleZufallsKarte();

		// Nur beim ersten Mal Listener registrieren
		if (!listenerRegistriert) {
			addSpielerZugListener(spielerIstDran -> {
				if (!spielerIstDran) {
					SwingUtilities.invokeLater(() -> {

						System.out.println("animiertGerade: " + zeichner.animiertGerade());
						System.out.println("eventsAmLaufen: " + zeichner.eventsAmLaufen());

						if (!zeichner.animiertGerade() && !zeichner.eventsAmLaufen()) {
							System.out.println("Gegner zieht und spielt");
							gegnerZiehtUndSpielt();
						}
					});
				}
			});

			listenerRegistriert = true;
		}
	}
	
	

	/**
	 * Führt den Zug des Gegners aus, einschließlich Ziehen und Ausspielen einer passenden Karte.
	 * <p>
	 * Wenn der Gegner aussetzen muss, wird die Aussetzrunden-Anzahl verringert und der Zug an den Spieler übergeben.
	 * Ist keine Animation aktiv, sucht der Gegner in seiner Hand nach passenden Karten (Farbe oder Nummer passend zur letzten gespielten Karte).
	 * Gibt es keine passende Karte, zieht der Gegner eine Karte und beendet seinen Zug.
	 * Andernfalls wird zufällig eine passende Karte ausgewählt, ausgespielt, animiert und deren Effekte werden angewendet.
	 * </p>
	 *
	 * <p>
	 * Nebenwirkungen:<br>
	 * - Aktualisiert den Spielzustand ({@link GameState}), das Hand- und Ablagedeck des Gegners<br>
	 * - Löst ggf. eine Animation aus und ruft {@link #kartenAction(Karte)} für Effekte auf
	 * </p>
	 */
	public void gegnerZiehtUndSpielt() {
		System.out.println("Starte Funktion: gegnerZiehtUndSpielt:");

		// vor dem Spiel
		Spieler gegner = GameState.getInstance().getGegner();
		if (gegner.getAussetzRunden() > 0) {
			gegner.setAussetzRunden(gegner.getAussetzRunden() - 1);
			System.out.println("Gegner muss aussetzen.");
			toggleSpielerZug();
			return;
		}

		if (zeichner.animiertGerade())
			return; // verhindert Dopplung
		
		
		ArrayList<Karte> passendeKarten = new ArrayList<>();
		ArrayList<Karte> hand = GameState.getInstance().getGegner().getHand();

		for (Karte karte : hand) {
			System.out.println("Gegner: ");
			if (passendeKarte(karte)) {
				passendeKarten.add(karte);
			}
		}

		if (passendeKarten.isEmpty()) {
			System.out.println("Gegner zieht");
			GameState.getInstance().getGegner().karteZiehen(1);
			toggleSpielerZug();
			return;
		}

		Random rand = new Random();
		Karte gespielteKarte = passendeKarten.get(rand.nextInt(passendeKarten.size()));
		zeichner.animationGegnerTrigger(gespielteKarte);
		
		GameState.getInstance().getGegner().getAblage().add(gespielteKarte);
		GameState.getInstance().getGegner().getHand().remove(gespielteKarte);
		
		kartenAction(gespielteKarte);
	}

	/**
	 * Prüft, ob eine übergebene Karte auf die zuletzt gespielte Karte passt.
	 * <p>
	 * Eine Karte passt, wenn entweder die Farbe oder die Nummer mit der letzten Karte übereinstimmt
	 * oder wenn eine der beiden Karten weder Farbe noch Nummer besitzt (beides {@code null}).
	 * Gibt zur Diagnose eine Meldung auf der Konsole aus.
	 * </p>
	 *
	 * @param karte Die zu prüfende Karte.
	 * @return {@code true}, wenn die Karte gespielt werden kann, sonst {@code false}.
	 */
	public static boolean passendeKarte(Karte karte) {
		System.out.println("Schaue nach passender Karte");
		Karte last = GameState.getInstance().getLastCard();

		boolean farbePasst = karte.getFarbe() != null && karte.getFarbe() == last.getFarbe();
		boolean nummerPasst = karte.getNummer() != null && karte.getNummer() == last.getNummer();
		boolean karteBeidesNull = karte.getFarbe() == null && karte.getNummer() == null;
		boolean lastBeidesNull = last.getFarbe() == null && last.getNummer() == null;

		return farbePasst || nummerPasst || karteBeidesNull || lastBeidesNull;
	}

	//Kommt noch
	public void newGameState() {

	}

	/**
	 * Erstellt einen neuen Gegner mit zufälligem Kartendeck und setzt ihn im Spielzustand.
	 * <p>
	 * Ein neuer {@link Spieler}-Gegner wird erzeugt, dessen Deck auf einer Kopie des {@code standardSet} basiert.
	 * Zusätzlich erhält der Gegner eine zufällige Anzahl an Zusatzkarten, abhängig vom aktuellen Level und einem Zufallswert.
	 * Das Deck des Gegners wird gemischt und im {@link GameState} als aktiver Gegner gesetzt.
	 * </p>
	 */
	public void neuerGegner() {
		Spieler gegner = new Spieler(cloneDeck(standardSet), null);

		int kartenAnzahl = Math.max(1, GameState.getInstance().getLevel() + rnd.nextInt(3));

		for (int i = 1; i < kartenAnzahl + 1; i++) {
			Karte tmpKarte = KartenGenerator.generiereZufallsZusatzkarte();
			gegner.addCardToDeck(tmpKarte);
		}

		gegner.mischen();
		GameState.getInstance().setGegner(gegner);
	}


	/**
	 * Erstellt eine tiefe Kopie eines Karten-Decks.
	 * <p>
	 * Für jedes Element im übergebenen {@code original}-Deck wird eine neue {@link Karte} mit dem Kopier-Konstruktor erzeugt
	 * und der neuen Liste hinzugefügt. Das Ergebnis ist eine unabhängige Kopie des gesamten Decks.
	 * </p>
	 *
	 * @param original Die zu kopierende Kartenliste.
	 * @return Eine neue {@link ArrayList} mit Kopien aller Karten aus {@code original}.
	 */
	public static ArrayList<Karte> cloneDeck(ArrayList<Karte> original) {
		ArrayList<Karte> kopie = new ArrayList<>();
		for (Karte k : original) {
			kopie.add(new Karte(k)); // setzt voraus, dass du einen Kopier-Konstruktor hast
		}
		return kopie;
	}


	
	/**
	 * Setzt die Lautstärke der aktuell abgespielten Hintergrundmusik.
	 * <p>
	 * Die Lautstärke wird über das {@link FloatControl}-Objekt des {@link Clip} angepasst.
	 * Der Wert {@code lautstaerkeDb} entspricht der Lautstärke in Dezibel (dB). Positive Werte erhöhen, negative Werte verringern die Lautstärke.
	 * Wenn keine Musik abgespielt wird, hat die Methode keine Wirkung.
	 * </p>
	 *
	 * @param lautstaerkeDb Der gewünschte Lautstärkewert in Dezibel (dB).
	 */
	public void setzeLautstaerke(float lautstaerkeDb) {
	    if (hintergrundmusik != null) {
	        FloatControl gainControl = (FloatControl) hintergrundmusik.getControl(FloatControl.Type.MASTER_GAIN);
	        gainControl.setValue(lautstaerkeDb);
	    }
	}

	/**
	 * Startet die Hintergrundmusik für das Spiel.
	 * <p>
	 * Lädt und spielt die Audiodatei {@code /misc/music/game1.wav} im Loop ab, sofern noch keine Musik läuft.
	 * Die Methode prüft zunächst, ob bereits Musik abgespielt wird. Ist dies nicht der Fall, wird die Musikdatei aus den Ressourcen geladen
	 * und als Dauerschleife gestartet. Im Fehlerfall wird eine entsprechende Meldung ausgegeben.
	 * </p>
	 *
	 * <p>
	 * Besonderheiten:<br>
	 * - Nutzt einen Workaround, um den Ressourcen-Stream zunächst in einen {@link ByteArrayInputStream} umzuwandeln, damit der {@link AudioInputStream} funktioniert.<br>
	 * - Gibt eine Meldung auf der Konsole aus, falls die Musikdatei nicht gefunden wurde oder ein Fehler auftritt.
	 * </p>
	 */
	public void starteSpielMusik() {
	    if (hintergrundmusik != null && hintergrundmusik.isRunning())
	        return;
	    try (InputStream is = getClass().getResourceAsStream("/misc/music/game1.wav")) {
	        if (is != null) {
	            // --- Workaround: InputStream in ByteArrayInputStream umwandeln ---
	            ByteArrayOutputStream baos = new ByteArrayOutputStream();
	            byte[] buffer = new byte[4096];
	            int read;
	            while ((read = is.read(buffer)) != -1) {
	                baos.write(buffer, 0, read);
	            }
	            ByteArrayInputStream bais = new ByteArrayInputStream(baos.toByteArray());
	            AudioInputStream audioStream = AudioSystem.getAudioInputStream(bais);
	            hintergrundmusik = AudioSystem.getClip();
	            hintergrundmusik.open(audioStream);
	            hintergrundmusik.loop(Clip.LOOP_CONTINUOUSLY);
	            hintergrundmusik.start();
	            System.out.println("Musik gestartet.");
	        } else {
	            System.err.println("game1.wav nicht gefunden!");
	        }
	    } catch (Exception e) {
	        e.printStackTrace();
	    }
	}

	/**
	 * Startet die Hintergrundmusik für den Shop.
	 * <p>
	 * Lädt und spielt die Audiodatei {@code /misc/music/shop1.wav} im Loop ab, sofern noch keine Musik läuft.
	 * Die Methode prüft zunächst, ob bereits Musik abgespielt wird. Ist dies nicht der Fall, wird die Musikdatei aus den Ressourcen geladen
	 * und als Dauerschleife gestartet. Im Fehlerfall wird eine entsprechende Meldung ausgegeben.
	 * </p>
	 *
	 * <p>
	 * Besonderheiten:<br>
	 * - Nutzt einen Workaround, um den Ressourcen-Stream zunächst in einen {@link ByteArrayInputStream} umzuwandeln, damit der {@link AudioInputStream} funktioniert.<br>
	 * - Gibt eine Meldung auf der Konsole aus, falls die Musikdatei nicht gefunden wurde oder ein Fehler auftritt.
	 * </p>
	 */
	public void starteShopMusik() {
	    if (hintergrundmusik != null && hintergrundmusik.isRunning())
	        return;
	    try (InputStream is = getClass().getResourceAsStream("/misc/music/shop1.wav")) {
	        if (is != null) {
	            ByteArrayOutputStream baos = new ByteArrayOutputStream();
	            byte[] buffer = new byte[4096];
	            int read;
	            while ((read = is.read(buffer)) != -1) {
	                baos.write(buffer, 0, read);
	            }
	            ByteArrayInputStream bais = new ByteArrayInputStream(baos.toByteArray());
	            AudioInputStream audioStream = AudioSystem.getAudioInputStream(bais);
	            hintergrundmusik = AudioSystem.getClip();
	            hintergrundmusik.open(audioStream);
	            hintergrundmusik.loop(Clip.LOOP_CONTINUOUSLY);
	            hintergrundmusik.start();
	            System.out.println("Musik gestartet.");
	        } else {
	            System.err.println("shop1.wav nicht gefunden!");
	        }
	    } catch (Exception e) {
	        e.printStackTrace();
	    }
	}

	/**
	 * Startet die Hintergrundmusik für das Hauptmenü.
	 * <p>
	 * Lädt und spielt die Audiodatei {@code /misc/music/menu.wav} im Loop ab, sofern noch keine Musik läuft.
	 * Die Methode prüft zunächst, ob bereits Musik abgespielt wird. Ist dies nicht der Fall, wird die Musikdatei aus den Ressourcen geladen
	 * und als Dauerschleife gestartet. Im Fehlerfall wird eine entsprechende Meldung ausgegeben.
	 * </p>
	 *
	 * <p>
	 * Besonderheiten:<br>
	 * - Nutzt einen Workaround, um den Ressourcen-Stream zunächst in einen {@link ByteArrayInputStream} umzuwandeln, damit der {@link AudioInputStream} funktioniert.<br>
	 * - Gibt eine Meldung auf der Konsole aus, falls die Musikdatei nicht gefunden wurde oder ein Fehler auftritt.
	 * </p>
	 */
	public void starteMenüMusik() {
	    if (hintergrundmusik != null && hintergrundmusik.isRunning())
	        return;
	    try (InputStream is = getClass().getResourceAsStream("/misc/music/menu.wav")) {
	        if (is != null) {
	            // --- Workaround: InputStream in ByteArrayInputStream umwandeln ---
	            ByteArrayOutputStream baos = new ByteArrayOutputStream();
	            byte[] buffer = new byte[4096];
	            int read;
	            while ((read = is.read(buffer)) != -1) {
	                baos.write(buffer, 0, read);
	            }
	            ByteArrayInputStream bais = new ByteArrayInputStream(baos.toByteArray());
	            AudioInputStream audioStream = AudioSystem.getAudioInputStream(bais);
	            hintergrundmusik = AudioSystem.getClip();
	            hintergrundmusik.open(audioStream);
	            hintergrundmusik.loop(Clip.LOOP_CONTINUOUSLY);
	            hintergrundmusik.start();
	            System.out.println("Musik gestartet.");
	        } else {
	            System.err.println("menu.wav nicht gefunden!");
	        }
	    } catch (Exception e) {
	        e.printStackTrace();
	    }
	}

	/**
	 * Führt die zu einer Karte gehörigen Spezialaktionen (Zusatz-Effekte) aus.
	 * <p>
	 * Prüft, ob die übergebene {@link Karte} Zusatzeffekte besitzt, und führt für jeden Effekt die entsprechende Aktion aus. 
	 * Dabei werden Effekte wie Kartenziehen, Handtausch, Bonus-Multiplikatoren, Aussetzen, und weitere Spezialaktionen (z. B. Zytokinese) implementiert.
	 * Die Methode berücksichtigt, ob gerade der Spieler oder der Gegner am Zug ist, und ändert entsprechend den Spielzustand.
	 * Nach Ausführung aller Effekte werden die Spieler- und Gegnerzustände im {@link GameState} aktualisiert, 
	 * die GUI neu gezeichnet und die gespielte Karte als letzte Karte gespeichert.
	 * </p>
	 *
	 * <p>
	 * Mögliche Effekte (unvollständig):<br>
	 * - Karten ziehen oder ablegen<br>
	 * - Zusatzeffekte aktivieren (HODL, BonusGeld, Zytokinese etc.)<br>
	 * - Handtausch zwischen Spieler und Gegner<br>
	 * - Spezialfälle wie Zytokinese/Zytokinese2, Zocken, Aussetzen etc.<br>
	 * - Spezialblock-, Spiegel-, Doppel- und andere Effekte sind (derzeit) auskommentiert und nicht aktiv
	 * </p>
	 *
	 * <p>
	 * Nebenwirkungen:<br>
	 * - Manipuliert direkt Spieler- und Gegnerzustand<br>
	 * - Kann das Spielende auslösen (z. B. bei zu wenigen Karten im Deck beim Addieren-Effekt)<br>
	 * - Zeichnet die GUI neu
	 * </p>
	 *
	 * @param karte Die gespielte Karte, deren Zusatzaktionen geprüft und ausgeführt werden.
	 */
	public void kartenAction(Karte karte) {
	    System.out.println("Prüfe Karte nach Aktionen");

	    if (karte.getZusätze() != null) {
	        Random rnd = new Random();

	        if (spielerZug) {
	            zugSpieler = GameState.getInstance().getSpieler();
	            zugGegner = GameState.getInstance().getGegner();
	        } else {
	            zugSpieler = GameState.getInstance().getGegner();
	            zugGegner = GameState.getInstance().getSpieler();
	        }

	        if (zugSpieler != null && zugGegner != null) {
	            for (Zusatzkarte effekt : karte.getZusätze()) {

					switch (effekt) {

					case ADDIEREN -> {
						
						if(GameState.getInstance().getSpieler().getDeck().size() < karte.getAddierWert()
								&& GameState.getInstance().getSpieler() == zugGegner) {
							
							zeichner.setGameOver(true);
						} else {
							zugGegner.karteZiehen(karte.getAddierWert());
						}
						
					} 

					case HODL -> {
						zugSpieler.setHodlWert(karte.getHodlWert());
						zugSpieler.setAussetzRunden(zugGegner.getAussetzRunden() +1);
					}

//					case SPEZIALBLOCK -> {
//						zugSpieler.setBlockRundenAnzahl(karte.getBlockRundenAnzahl());
//					}

					case FLUCH -> {
						zugSpieler.setFluchRundenAnzahl(karte.getFluchRundenAnzahl());
					}

//					case ZERSTÖRUNG -> {
//						zugSpieler.setZerstörungAnzahl(karte.getZerstörungAnzahl());
//						//zugSpieler.remove
//					}

					case BONUSGELD -> {
						zugSpieler.setBonusGeldMult(zugSpieler.getBonusGeldMult() + karte.getBonusGeldMult());
					}

					case SPY -> {
						zugSpieler.setKartenAnguckenRundenAnzahl(karte.getKartenAnguckenRundenAnzahl());
					}

					case AUSSETZEN -> {
					    // Der jeweils andere Spieler muss aussetzen
					    Spieler zielSpieler = spielerZug ? zugGegner : zugSpieler;
					    System.out.println("Aussetzen auf: " + (spielerZug ? "Gegner" : "Spieler"));
					    zielSpieler.setAussetzRunden(karte.getAussetzWert());
					}


					// ───── Nicht-skalierbare Effekte mit fixer Beschreibung ─────
//					case SPIEGEL -> {
//					    zugSpieler.setSpiegelEffekt(true);
//					}

					case TAUSCH -> {
						ArrayList<Karte> tmpHand = zugSpieler.getHand();
						zugSpieler.setHand(zugGegner.getHand());
						zugGegner.setHand(tmpHand);
						System.out.println("Tausch vollzogen");
					}

//					case DOPPEL -> {
//					    zugSpieler.setDoppelEffekt(true);
//					}
//
//					case VERBRENNEN -> {
//					    zugSpieler.setVerbrennEffekt(true);
//					}
//
//					case VORHERSAGE -> {
//					    zugSpieler.setVorhersageEffekt(true);
//					}
//
//					case GESPENST -> {
//						zugSpieler.setGespenstRunde(2);
//						zugSpieler.setGespenstKarte(karte);
//					}

					case OPFER -> {
						rnd.nextInt(zugSpieler.getHand().size());
						rnd.nextInt(zugSpieler.getHand().size());
						zugSpieler.getHand().remove(karte);
					}

					case ZOCKEN -> {
						zugSpieler.karteZiehen(3);
						ArrayList<Karte> dreiKarten = new ArrayList<Karte>();
						for (int j = 1; j < 4; j++) {
							dreiKarten.add(zugSpieler.getHand().get(zugSpieler.getHand().size() - j));
						}

						for (int j = 0; j < 3; j++) {
							if (dreiKarten.get(j).getZusätze() != null) {
								zugSpieler.karteSpielen(dreiKarten.get(j));
								dreiKarten.remove(j);
								break;
							}
						}

						for (Karte restKarte : dreiKarten) {
							zugSpieler.getHand().remove(restKarte);
						}

						dreiKarten.clear();
					}

					case ZYTOKINESE -> {
						Karte kart1 = KartenGenerator.generiereNormaleZufallsKarte();
						zugSpieler.getHand().add(kart1);
						Karte kart2 = KartenGenerator.generiereNormaleZufallsKarte();
						zugSpieler.getHand().add(kart2);

						if (zugSpieler.getHand().contains(karte)) {
						    zugSpieler.getHand().remove(karte);
						}

					}

					case ZYTOKINESE2 -> {
						Karte kart1 = KartenGenerator.generiereZufallsZusatzkarte();
						zugSpieler.getHand().add(kart1);
						Karte kart2 = KartenGenerator.generiereZufallsZusatzkarte();
						zugSpieler.getHand().add(kart2);

						if (zugSpieler.getHand().contains(karte)) {
						    zugSpieler.getHand().remove(karte);
						}

					}

					default -> {
						// nichts tun
					}
					}
	            	
	            }

	            if (spielerZug) {
	                GameState.getInstance().setSpieler(zugSpieler);
	                GameState.getInstance().setGegner(zugGegner);
	            } else {
	                GameState.getInstance().setSpieler(zugGegner);
	                GameState.getInstance().setGegner(zugSpieler);
	            }
	            zeichner.setKartenZumZeichnen();
	            zeichner.repaint();
	        }
	    } else {
	        return;
	    }

	    GameState.getInstance().setLastCard(karte);
	}

	/**
	 * Erhöht den aktuellen Score des Spielers um den angegebenen Wert sowie einen Bonus abhängig von der Zuganzahl und dem Level.
	 * <p>
	 * Der Score wird um {@code anzahl} sowie um einen Bonus von {@code (100 - zugAnzahl) * aktuelles Level} erhöht.
	 * Das Ergebnis wird im {@link GameState} gespeichert.
	 * </p>
	 *
	 * @param anzahl Der Basiswert, um den der Score erhöht werden soll.
	 */
	public void scoreAdd(int anzahl) {
		GameState.getInstance().setScore(GameState.getInstance().getScore()
				+ (anzahl + ((100 - zugAnzahl) * GameState.getInstance().getLevel())));
	}
	
	/**
	 * Berechnet den Score für eine gespielte Karte und fügt ihn dem Spieler hinzu.
	 * <p>
	 * Die Punktzahl ergibt sich aus {@code (10 + Preis der Karte) * aktuelles Level}.
	 * Wenn die Karte die zuletzt gespielte Karte ist, wird der Score verdoppelt.
	 * Der berechnete Score wird anschließend dem Spieler über {@link #scoreAdd(int)} gutgeschrieben.
	 * </p>
	 *
	 * @param karte Die Karte, für die der Score berechnet werden soll.
	 */
	public void scoreBerechnen(Karte karte) {
		int score = (10 + karte.getPreis()) * GameState.getInstance().getLevel();

		if (karte == GameState.getInstance().getLastCard()) {
			score = score * 2;
		}

		scoreAdd(score);
	}

	/**
	 * Berechnet und vergibt die Geld-Belohnung am Rundenende.
	 * <p>
	 * Die Belohnung basiert auf dem aktuellen Score und dem Level des Spielers.
	 * Optional werden Bonuswerte wie {@code HodlWert} und {@code BonusGeldMult} 
	 * aus dem Spieler-Status addiert bzw. multipliziert und danach zurückgesetzt.
	 * Die berechnete Belohnung wird zum aktuellen Guthaben des Spielers addiert.
	 * </p>
	 *
	 * <p>
	 * Nebenwirkungen:<br>
	 * - Setzt nach Vergabe {@code HodlWert} und {@code BonusGeldMult} im Spieler auf {@code null}.<br>
	 * - Gibt die Belohnung in der Konsole aus.
	 * </p>
	 */
	public void geldBelohnung() {

		int level = GameState.getInstance().getLevel();
		belohnung = (int)(GameState.getInstance().getScore() / (800.0 / Math.sqrt(level + 1)));
		
		Integer hodl = GameState.getInstance().getSpieler().getHodlWert();
		if (hodl != null) {
		    belohnung += hodl;
		    GameState.getInstance().getSpieler().setHodlWert(null); // Nach Benutzung immer nullen
		}

		Integer bonusMult = GameState.getInstance().getSpieler().getBonusGeldMult();
		if (bonusMult != null) {
		    if (bonusMult > 0) {
		        belohnung *= bonusMult;
		        System.out.println("Spieler erhält Zusatz-Belohnung");
		    } 
		    GameState.getInstance().getSpieler().setBonusGeldMult(null); // Immer zurücksetzen!
		}

		
		System.out.println(belohnung);

		GameState.getInstance().setMoney(GameState.getInstance().getMoney() + (belohnung));

	}

	public void clearHintergrundmusik() {
		if (this.hintergrundmusik != null) {
			this.hintergrundmusik.close();
		}
	}

	public GameState getState() {
		return state;
	}

	public Spiel getZeichner() {
		return zeichner;
	}

	public Clip getHintergrundmusik() {
		return hintergrundmusik;
	}

	public int getZugAnzahl() {
		return zugAnzahl;
	}

	public Font getJokerFont() {
		return jokerFont;
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

	public boolean isSpielerZug() {
		return spielerZug;
	}

	public void setState(GameState state) {
		this.state = state;
	}


	public void setHintergrundmusik(Clip hintergrundmusik) {
		this.hintergrundmusik = hintergrundmusik;
	}

	public void setZugAnzahl(int zugAnzahl) {
		this.zugAnzahl = zugAnzahl;
	}

	public void setJokerFont(Font jokerFont) {
		this.jokerFont = jokerFont;
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

	public void setSpielerZug(boolean spielerZug) {
		this.spielerZug = spielerZug;
	}

	public boolean isGespenstEffekt() {
		return gespenstEffekt;
	}

	public void setGespenstEffekt(boolean gespenstEffekt) {
		this.gespenstEffekt = gespenstEffekt;
	}
	public void setZeichner(Spiel zeichner) {
		this.zeichner = zeichner;
	}

	public ArrayList<Karte> getStandardSet() {
		return standardSet;
	}

	public void setStandardSet(ArrayList<Karte> standardSet) {
		this.standardSet = standardSet;
	}
	
}
