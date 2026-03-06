package de.drvbund.jauns.main;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Polygon;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

import javax.imageio.ImageIO;
import javax.swing.JPanel;
import javax.swing.Timer;

public class Shop extends JPanel {

	private ShopArtikel hoverArtikel = null;
	private ShopArtikel klickArtikel = null;
	private GamePlay gameplay;
	ArrayList<Karte> shopKarten = new ArrayList<Karte>();
	ArrayList<Item> shopItems = new ArrayList<Item>();
	ArrayList<ShopArtikel> shopInhalt = new ArrayList<>();
	private Rectangle rerollButton = new Rectangle(-1, -1, 0, 0); // Position & Größe oben links
	private int rerollPreis = 0;
	private int rerollCounter = 0;
	private Rectangle weiterButton = new Rectangle();
	private Rectangle kaufenButton = new Rectangle(-1, -1, 0, 0);
	private int manfredStatus = 0;
	private boolean manfredBlock = false;

	private boolean kaufenButtonWackelt = false;
	private long kaufenButtonShakeStart = 0;

	private final int shakeDauer = 300; // ms

	private boolean rerollButtonWackelt = false;
	private long rerollButtonShakeStart = 0;

	BufferedImage rahmen = null;
	
	private String manfredSatz = "";

	private WeiterButtonListener weiterButtonListener;
	private SpeibeButtonListener speibeButtonListener;

	private Rectangle speibeButton = new Rectangle();
	
	/**
	 * Konstruktor für den Shop-Bereich.
	 * <p>
	 * Initialisiert den Shop mit Referenz zum aktuellen Spiel, lädt Rahmen- und Shopkeeper-Ressourcen,
	 * startet einen Timer für regelmäßiges Repaint und setzt alle nötigen Maus-Listener für Hover- und Klick-Events.
	 * Steuert die Auswahl und den Kauf von Shop-Artikeln sowie das Weiterkommen oder Speichern im Shop.
	 * </p>
	 *
	 * @param gameplay Die GamePlay-Instanz für Spiellogik und Ressourcenmanagement.
	 */
	public Shop(GamePlay gameplay) {
		this.gameplay = gameplay;

		// Ressourcen laden - nutze RessourceLoader für konsistente Pfad-Behandlung
		rahmen = RessourceLoader.getInstance().ladeBild("/misc/png/rahmen5.png");
		if (rahmen == null) {
		    System.err.println("Rahmen nicht gefunden: /misc/png/rahmen5.png");
		}

		for (int i = 0; i < 4; i++) {
		    String dateiname = "shopkeeper" + i + ".png";
		    String resourcePath = "/misc/png/" + dateiname;
		    RessourceLoader.getInstance().addManfredBild(resourcePath);
		}


		Timer timer = new Timer(16, e -> {
			repaint();
		});
		timer.start();

		// Hover-Events
		addMouseMotionListener(new MouseMotionAdapter() {
			@Override
			public void mouseMoved(MouseEvent e) {
				Point hover = e.getPoint();
				updateHoverArtikel(hover);

				if (kaufenButton.contains(hover)) {
					manfredBlock = true;
				} else {
					manfredBlock = false;
				}

			}
		});

		// Klick-Events
		addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				Point klick = e.getPoint();
				ArrayList<Rectangle> bereiche = getShopArtikelBereiche();

				boolean gefunden = false;
				for (int i = 0; i < bereiche.size(); i++) {
					if (bereiche.get(i).contains(klick)) {
						klickArtikel = shopInhalt.get(i); // <-- nicht hoverArtikel, sondern direkt aus der Liste
						gefunden = true;
						break;
					}
				}
				if (!gefunden && !(kaufenButton.contains(klick))) {
					klickArtikel = null;
				}

				if (kaufenButton.contains(klick)) {
					kaufVorgang(klickArtikel);
				}

				if (weiterButton.contains(klick)) {
					if (weiterButtonListener != null) {
						weiterButtonListener.onWeiterGedrückt();
						
						System.out.println("Spieler drückt auf Weiter");
					}
				}

				if (rerollButton.contains(klick)) {
					reroll();
				}
				
				if (speibeButton.contains(klick)) {
					gameplay.newRound();
					GameState.getInstance().saveToXml(GamePlay.getSavePath());
				}

			}
		});

	}

	/**
	 * Paint-Komponente
	 *@param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	@Override
	protected void paintComponent(Graphics g) {
		super.paintComponent(g);

		zeichneHintergrund(g);

		zeichneAngebote(g);
		zeichneArtikelbeschreibungBox(g); // <- hinzufügen
		zeichneManfred(g);

	}

	/**
	 * Zeichnet die Shopfigur „Manfred“ samt passender Sprechblase im Shop-Bereich.
	 * <p>
	 * Stellt Manfred je nach Interaktionsstatus (kein Artikel, Artikel gewählt, Artikel „gehovered“, blockiert) an unterschiedlicher Position und Größe dar.
	 * Das passende Manfred-Bild und ein individuell generierter Spruch werden angezeigt. 
	 * Das Bild wird dabei gespiegelt und skaliert gezeichnet. 
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneManfred(Graphics g) {
		Graphics2D g2d = (Graphics2D) g;

		BufferedImage manfred = RessourceLoader.getInstance().ladeManfred(0);

		AffineTransform tx = new AffineTransform();

		String preis;

		int x = (getWidth() / 2) - 30;
		int y = getHeight() - 410;
		int w = 400;
		int h = 400;

		if (hoverArtikel != null) {
			manfredStatus = 2;
			preis = String.valueOf(hoverArtikel.getPreis());
		}
		if (klickArtikel != null) {
			manfredStatus = 1;
		}
		if (klickArtikel == null && hoverArtikel == null) {
			manfredStatus = 0;
		}
		if (manfredBlock) {
			manfredStatus = 3;
		}

		manfredSatz = "Hallöle!";

		// Sätze

		switch (manfredStatus) {
		case 0 -> {
			manfred = RessourceLoader.getInstance().ladeManfred(manfredStatus);

			x = (getWidth() / 2) - 30;
			y = getHeight() - 410;
			w = 400;
			h = 400;
			if (kaufenButtonWackelt) {
				manfredSatz = String.format("Arme Sau...");
				klickArtikel = null;
			} else {
				manfredSatz = String.format("Kauf doch gern was, es ist genug für alle da!");
			}
		}
		case 1 -> {
			manfred = RessourceLoader.getInstance().ladeManfred(manfredStatus);

			x = (getWidth() / 2) - 130;
			y = getHeight() - 410;
			w = 600;
			h = 400;

			if (klickArtikel != null) {
				preis = String.valueOf(klickArtikel.getPreis());
			} else {
				preis = "FEHLER";
			}

			manfredSatz = String.format("Eine gute Wahl für nur %s deiner Moneten! Günstiger als die Konkurenz.", preis);

		}
		case 2 -> {
			manfred = RessourceLoader.getInstance().ladeManfred(manfredStatus);

			x = (getWidth() / 2) - 130;
			y = getHeight() - 410;
			w = 600;
			h = 400;

			manfredSatz = String.format("Willst du das haben? Ich finde es super.");

		}
		case 3 -> {
			manfred = RessourceLoader.getInstance().ladeManfred(manfredStatus);

			x = (getWidth() / 2) - 30;
			y = getHeight() - 410;
			w = 400;
			h = 400;

			manfredSatz = String.format("KAUFEN!! .... Also natürlich nur, wenn du genug Moneten hast.");

		}
		default -> {
			manfredStatus = 0;
		}

		}

		// Schritt 1: An Zielposition und -größe anpassen (inkl. Spiegelung)
		tx.translate(x + w, y); // nach rechts verschieben
		tx.scale(-1.0 * w / manfred.getWidth(), h / (double) manfred.getHeight());

		g2d.drawImage(manfred, tx, null);

		manfredSprechblase(g2d, manfredSatz);

		g2d.dispose();

	}

	/**
	 * Zeichnet eine Sprechblase für Manfred mit dem übergebenen Text im unteren Bereich des Spielfensters.
	 * <p>
	 * Rendert die Sprechblase mit einem abgerundeten Rechteck und einem verbundenen Dreieck als "Schniepel".
	 * Der Text wird automatisch umbrochen und mittig in die Sprechblase geschrieben.
	 * </p>
	 *
	 * @param g2d  Das {@link Graphics2D}-Objekt zum Zeichnen.
	 * @param satz Der Text, der in der Sprechblase angezeigt werden soll.
	 */
	private void manfredSprechblase(Graphics2D g2d, String satz) {

		int x = (getWidth() / 2) - 30;
		int y = getHeight() - 410;

		int breite = 700;
		int höhe = 300;

		x = x - breite;
		y = y - GamePlay.skalieren(30);

		// Dreieck (Schniepel unten links)
		Polygon dreieck = new Polygon();
		dreieck.addPoint(x + 698, y + höhe - 50);
		dreieck.addPoint(x + 696, y + höhe - 10);
		dreieck.addPoint(x + 790, y + höhe - 60);
		g2d.setColor(Color.WHITE);
		g2d.fillPolygon(dreieck);
		g2d.setStroke(new BasicStroke(7));
		g2d.setColor(Color.BLACK);
		g2d.drawPolygon(dreieck);

		// Hauptblase
		g2d.setStroke(new BasicStroke(5));
		g2d.setColor(Color.WHITE);
		g2d.fillRoundRect(x, y, breite, höhe, 40, 40);
		g2d.setColor(Color.BLACK);
		g2d.drawRoundRect(x, y, breite, höhe, 40, 40);

		// Verbindungsstück für sauberen Übergang
		g2d.setColor(Color.WHITE);
		Polygon dreieck2 = new Polygon();
		dreieck2.addPoint(x + 697, y + höhe - 50);
		dreieck2.addPoint(x + 690, y + höhe - 10);
		dreieck2.addPoint(x + 789, y + höhe - 59);
		g2d.fillPolygon(dreieck2);

		String text = satz;

		g2d.setColor(Color.BLACK);
		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(45)));
		FontMetrics fm = g2d.getFontMetrics();
		int textX = x + 40;
		int textY = y + 60;
		int maxTextBreite = breite - 80; // etwas Padding von links/rechts

		drawWrappedText(g2d, text, textX, textY, maxTextBreite, fm.getHeight() + 5);

	}

	public void newShop() {
		shopInhalt = null;
	}

	/**
	 * Zeichnet das komplette Shop-Angebot inklusive Artikel, Preise und Steuerelementen.
	 * <p>
	 * Initialisiert das Shop-Angebot bei Bedarf, zeichnet alle Shop-Artikel in einem Grid-Layout,
	 * zeigt den aktuellen Geldbetrag an, rendert den Reroll-Button sowie die Buttons für "Speichern und beenden" und "Weiter".
	 * Artikel werden als Boxen mit Bild, Preis und Effekten dargestellt.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneAngebote(Graphics g) {
		if (shopInhalt == null) {
			shopInhalt = erzeugeAngebote();
		}

		Graphics2D g2d = (Graphics2D) g;
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(20)));

		int breite = getWidth();
		int höhe = getHeight();

		// Hintergrundbereich links
		int shopBereichBreite = (int) (breite * 0.65);
		int shopBereichHöhe = höhe - 150;
		int shopX = 25;
		int shopY = 100;

		g2d.setColor(new Color(0, 0, 0, 150));
		g2d.fillRoundRect(shopX, shopY, shopBereichBreite, shopBereichHöhe - 410, 20, 20);

		// Geldanzeige
		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(72)));
		int geld = GameState.getInstance().getMoney();
		g2d.setColor(Color.WHITE);
		g2d.drawString("Geld: " + geld, breite / 2 - 80, 75);

		// Grid-Layout: 4 Spalten × 2 Zeilen
		int cols = 4;
		int padding = 30;
		int itemW = (shopBereichBreite - padding * (cols + 1)) / cols;
		int itemH = 120;

		for (int i = 0; i < shopInhalt.size(); i++) {
			int row = i / cols;
			int col = i % cols;

			int x = shopX + padding + col * (itemW + padding);
			int y = shopY + padding + row * (itemH + padding);

			ShopArtikel artikel = shopInhalt.get(i);

			// Box
			g2d.setColor(new Color(255, 255, 255, 50));
			g2d.fillRoundRect(x, y, itemW, itemH, 15, 15);

			Dimension dim = new Dimension(64, 64);

			zeichneArtikel(g2d, artikel, x + 10, y + 10, dim);

			// Name & Preis
			g2d.setColor(Color.WHITE);
			// g2d.drawString(artikel.getName(), x + 80, y + 30);
			g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(35)));
			g2d.drawString(artikel.getPreis() + " Gold", x + 80, y + 55);
		}

		zeichneRerollButton(g2d);

		// Buttons unten
		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(35)));
		FontMetrics fm = g2d.getFontMetrics();
		String speibeString = "Speichern und beenden";
		
		g2d.setColor(Color.DARK_GRAY);
		g2d.fillRoundRect(50, höhe - 70, (int)((fm.getStringBounds(speibeString, g2d).getWidth()) *1.07), 
				(int) ((fm.getAscent()) * 1.5) , 15, 15); // Speichern und beenden
		speibeButton = new Rectangle(50, höhe - 70, (int)((fm.getStringBounds(speibeString, g2d).getWidth()) *1.07), 
				(int) ((fm.getAscent()) * 1.5));
		g2d.fillRoundRect(breite - 230, höhe - 75, 140, 60, 15, 15); // Weiter
		weiterButton = new Rectangle(breite - 230, höhe - 75, 140, 60);
		g2d.setColor(Color.WHITE);
		g2d.drawString(speibeString, 60, höhe - 35);
		g2d.drawString("Weiter", breite - 210, höhe - 35);
	}

	/**
	 * Zeichnet einen Shop-Artikel inklusive Bild und zugehöriger Effekte/Emojis.
	 * <p>
	 * Rendert das Bild des Artikels an der angegebenen Position und Größe.
	 * Wenn der Artikel Zusatzeffekte (bei Karten) oder Item-Effekte besitzt, werden deren Emojis gesammelt und unterhalb des Bildes angezeigt.
	 * Die Emojis werden mit einer passenden Emoji-Schriftart und automatischem Zeilenumbruch gezeichnet.
	 * </p>
	 *
	 * @param g2d     Das {@link Graphics2D}-Objekt zum Zeichnen.
	 * @param artikel Der zu zeichnende {@link ShopArtikel}.
	 * @param x       Die X-Koordinate der linken oberen Ecke.
	 * @param y       Die Y-Koordinate der linken oberen Ecke.
	 * @param groesse Die Größe, in der das Artikelbild gezeichnet wird.
	 */
	private void zeichneArtikel(Graphics2D g2d, ShopArtikel artikel, int x, int y, Dimension groesse) {

		// Bild
		g2d.drawImage(RessourceLoader.getInstance().ladeRessource(artikel.getLoaderIndex()), x, y, groesse.width,
				groesse.height, null);

		String alleEmojis = null;
		if (artikel instanceof Karte karte) {
			if (karte.getZusätze() != null) {
				// String test = "cock und sack";

				alleEmojis = karte.getZusätze().stream().map(Zusatzkarte::getEmoji).collect(Collectors.joining(" "));
			}
		} else if (artikel instanceof Item item) {
			if (item.getEffekte() != null) {
				alleEmojis = item.getEffekte().stream().map(Effekt::getEmoji).collect(Collectors.joining(" "));
			}
		}
		if (alleEmojis != null) {

			Font emojifont = new Font("Segoe UI Emoji", Font.PLAIN, GamePlay.skalieren(10));

			x = x + (groesse.width / 3);
			y = y + (groesse.height - (groesse.height / 5) * 4);
			y= y-1;

			int w = groesse.width / 2;
			int zeilenabstand = groesse.height / 2 + (groesse.height / 7);
			drawWrappedText(g2d, alleEmojis, x, y, w, zeilenabstand, emojifont);
		}

	}

	/**
	 * Zeichnet mehrzeiligen, automatisch umgebrochenen Text in ein Grafikobjekt mit angegebener Schriftart.
	 * <p>
	 * Teilt den Text anhand von Leerzeichen auf und zeichnet Zeile für Zeile, sodass der Text die maximale Breite nicht überschreitet.
	 * Die Schriftart wird auf {@code font} gesetzt und der Zeilenabstand mit {@code zeilenAbstand} gesteuert.
	 * </p>
	 *
	 * @param g2d           Das {@link Graphics2D}-Objekt zum Zeichnen.
	 * @param text          Der darzustellende Text.
	 * @param x             Die X-Koordinate des Textanfangs.
	 * @param y             Die Y-Koordinate der ersten Textzeile.
	 * @param maxWidth      Die maximale Breite, bevor ein Zeilenumbruch erfolgt.
	 * @param zeilenAbstand Der Abstand zwischen den Textzeilen.
	 * @param font          Die zu verwendende Schriftart.
	 */
	private void drawWrappedText(Graphics2D g2d, String text, int x, int y, int maxWidth, int zeilenAbstand,
			Font font) {
		g2d.setColor(Color.BLACK);
		g2d.setFont(font);
		FontMetrics fm = g2d.getFontMetrics();
		String[] wörter = text.split(" ");
		StringBuilder zeile = new StringBuilder();
		int aktuelleY = y;

		for (String wort : wörter) {
			String testZeile = zeile + wort + " ";
			if (fm.stringWidth(testZeile) > maxWidth) {
				g2d.drawString(zeile.toString(), x, aktuelleY);
				zeile = new StringBuilder(wort + " ");
				aktuelleY += zeilenAbstand;
			} else {
				zeile.append(wort).append(" ");
			}
		}
		if (!zeile.toString().isBlank()) {
			g2d.drawString(zeile.toString(), x, aktuelleY);
		}
	}

	/**
	 * Berechnet die Bereiche (Bounding-Boxen) für alle angezeigten Shop-Artikel.
	 * <p>
	 * Bestimmt auf Basis der Fensterbreite und Layoutparameter die Position und Größe jedes Artikels im Shop.
	 * Gibt für jedes Shop-Artikel-Objekt ein passendes {@link Rectangle} zurück, um z. B. Mausinteraktionen zu ermöglichen.
	 * </p>
	 *
	 * @return Liste mit Rechtecken, die die Bereiche aller Shop-Artikel repräsentieren.
	 */
	private ArrayList<Rectangle> getShopArtikelBereiche() {
		ArrayList<Rectangle> bereiche = new ArrayList<>();

		int breite = getWidth();

		int shopBereichBreite = (int) (breite * 0.65);
		int shopX = 25;
		int shopY = 100;

		int cols = 4;
		int padding = 30;
		int itemW = (shopBereichBreite - padding * (cols + 1)) / cols;
		int itemH = 120;

		for (int i = 0; i < shopInhalt.size(); i++) {
			int row = i / cols;
			int col = i % cols;

			int x = shopX + padding + col * (itemW + padding);
			int y = shopY + padding + row * (itemH + padding);

			bereiche.add(new Rectangle(x, y, itemW, itemH));
		}

		return bereiche;
	}

	/**
	 * Aktualisiert das aktuell „gehoverte“ Shop-Artikel-Objekt anhand der Mausposition.
	 * <p>
	 * Überprüft für den übergebenen Punkt alle Shop-Artikel-Bereiche und setzt das
	 * entsprechende {@link ShopArtikel}-Objekt als hoverArtikel, sofern sich die Maus darüber befindet.
	 * </p>
	 *
	 * @param p Die aktuelle Mausposition.
	 */
	private void updateHoverArtikel(Point p) {
		hoverArtikel = null;
		ArrayList<Rectangle> bereiche = getShopArtikelBereiche();

		for (int i = 0; i < bereiche.size(); i++) {
			if (bereiche.get(i).contains(p)) {
				hoverArtikel = shopInhalt.get(i);
				break;
			}
		}
	}

	/**
	 * Generiert und gibt das aktuelle Shop-Angebot als Liste von Shop-Artikeln zurück.
	 * <p>
	 * Bestimmt abhängig vom Level und Reroll-Zähler den Reroll-Preis und legt zufällig fest,
	 * wie viele normale Karten, Spezialkarten und Items das Angebot enthalten soll (bis zu insgesamt 8 Stück).
	 * Die Karten werden zufällig ausgewählt und die finale Angebotsliste wird gemischt zurückgegeben.
	 * </p>
	 *
	 * @return Die generierte Liste mit Shop-Artikeln für das aktuelle Angebot.
	 */
	private ArrayList<ShopArtikel> erzeugeAngebote() {
		ArrayList<ShopArtikel> inhalt = new ArrayList<>();
		Random rnd = new Random();

		int level = GameState.getInstance().getLevel();

		rerollPreis = 2 + (level * rerollCounter);

		int max = 8;

		// Sichere Verteilungen
		int anzahlNormaleKarten = rnd.nextInt(max + 1); // 0 bis 8
		int verbleibend = max - anzahlNormaleKarten;

		int anzahlSpezialKarten = rnd.nextInt(verbleibend + 1); // 0 bis verbleibend
		verbleibend -= anzahlSpezialKarten;

		int anzahlItems = verbleibend;

		for (int i = 0; i < anzahlNormaleKarten; i++) {
			inhalt.add(KartenGenerator.generiereNormaleZufallsKarte());
		}

		for (int i = 0; i < anzahlSpezialKarten; i++) {
			inhalt.add(KartenGenerator.generiereZufallsZusatzkarte());
		}

		Collections.shuffle(inhalt);
		return inhalt;
	}

	/**
	 * Zeichnet die Artikelbeschreibung-Box für Shop-Artikel.
	 * <p>
	 * Stellt eine halbtransparente Box mit goldener Umrahmung (oder individuellem Rahmenbild) dar,
	 * zeigt Titel und Beschreibung der aktuell ausgewählten oder „gehoverten“ Karte an
	 * und rendert den Kaufen-Button, sofern ein Artikel ausgewählt ist.
	 * Passt Schriftart und Rendering-Qualität dynamisch an.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneArtikelbeschreibungBox(Graphics g) {
		Graphics2D g2d = (Graphics2D) g.create();

		int boxBreite = GamePlay.skalieren(420);
		int boxHöhe = GamePlay.skalieren(500);
		int abstand = GamePlay.skalieren(30);
		int zeilenAbstand = GamePlay.skalieren(50);

		int x = getWidth() - boxBreite - abstand;
		int y = (getHeight() / 2 - boxHöhe / 2) - 100;

		// Hintergrund
		g2d.setColor(new Color(0, 0, 0, 150)); // halbtransparent
		g2d.fillRoundRect(x + 10, y + 10, boxBreite - 20, boxHöhe - 20, 20, 20);

		// Goldrahmen
		if (rahmen == null) {
			g2d.setColor(new Color(0xD4AF37));
			g2d.setStroke(new BasicStroke(3));
			g2d.drawRoundRect(x, y, boxBreite, boxHöhe, 20, 20);
		} else {
			g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
			g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
			g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);
			g2d.drawImage(rahmen, x, y, boxBreite, boxHöhe, null);
		}

		// Text
		g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(55)));

		g2d.setColor(Color.WHITE);

		String anzeigeKarte = "";
		if (hoverArtikel != null) {
			anzeigeKarte = "Verfügbare Karte";
			g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(45)));
		}
		if (klickArtikel != null) {
			anzeigeKarte = "Ausgewählte Karte";
			g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(45)));
		}

		g2d.drawString(anzeigeKarte, x + zeilenAbstand / 2, y + GamePlay.skalieren(70));

		ShopArtikel artikel = null;
		if (klickArtikel == null) {
			artikel = hoverArtikel;
		} else {
			artikel = klickArtikel;
		}

		if (artikel != null) {
			g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(38)));
			drawWrappedText(g2d, artikel.getBeschreibung(), x + zeilenAbstand / 2, y + GamePlay.skalieren(150),
					boxBreite - abstand, GamePlay.skalieren(40));
		}

		if (klickArtikel != null) {

			zeichneKaufenButton(g2d);

		} else {
			kaufenButton = new Rectangle(-1, -1, 0, 0);
		}

		g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);

		g2d.dispose();
	}
	
	/**
	 * Zeichnet mehrzeiligen, automatisch umgebrochenen Text in ein Grafikobjekt.
	 * <p>
	 * Teilt den Text anhand von Leerzeichen auf und zeichnet Zeile für Zeile, sodass der Text die angegebene maximale Breite nicht überschreitet.
	 * Zeilen werden durch den angegebenen Zeilenabstand getrennt.
	 * </p>
	 *
	 * @param g2d           Das {@link Graphics2D}-Objekt zum Zeichnen.
	 * @param text          Der darzustellende Text.
	 * @param x             Die X-Koordinate des Textanfangs.
	 * @param y             Die Y-Koordinate der ersten Textzeile.
	 * @param maxWidth      Die maximale Breite, bevor ein Zeilenumbruch erfolgt.
	 * @param zeilenAbstand Der Abstand zwischen den Textzeilen.
	 */
	private void drawWrappedText(Graphics2D g2d, String text, int x, int y, int maxWidth, int zeilenAbstand) {
		FontMetrics fm = g2d.getFontMetrics();
		String[] wörter = text.split(" ");
		StringBuilder zeile = new StringBuilder();
		int aktuelleY = y;

		for (String wort : wörter) {
			String testZeile = zeile + wort + " ";
			if (fm.stringWidth(testZeile) > maxWidth) {
				g2d.drawString(zeile.toString(), x, aktuelleY);
				zeile = new StringBuilder(wort + " ");
				aktuelleY += zeilenAbstand;
			} else {
				zeile.append(wort).append(" ");
			}
		}
		if (!zeile.toString().isBlank()) {
			g2d.drawString(zeile.toString(), x, aktuelleY);
		}
	}

	/**
	 * Zeichnet den Hintergrund für den aktuellen Bereich.
	 * <p>
	 * Lädt und rendert das passende Hintergrundbild in Fenstergröße.
	 * Überzieht das Bild anschließend mit einer halbtransparenten, schwarzen Fläche zur Abdunklung.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneHintergrund(Graphics g) {
		Graphics2D g2d = (Graphics2D) g.create();

		g2d.drawImage(RessourceLoader.getInstance().ladeHintergrundbild(1), 0, 0, getWidth(), getHeight(), null);
		g2d.setColor(new Color(0, 0, 0, 150)); // halbtransparent
		g2d.fillRect(0, 0, getWidth(), getHeight());

		g2d.dispose();

	}

	/**
	 * Zeichnet den Kaufen-Button im Shop-Bereich.
	 * <p>
	 * Positioniert den Kaufen-Button passend zur Shop-Oberfläche und stellt ihn mit goldener Umrandung sowie mittigem Text dar.
	 * Bei zu wenig Guthaben oder nach fehlgeschlagenem Kauf wird der Button kurzzeitig „wackelnd“ (Shake-Effekt) animiert.
	 * Die Bounding-Box des Buttons wird zur Klick-Erkennung gesetzt.
	 * </p>
	 *
	 * @param g2d Das {@link Graphics2D}-Objekt zum Zeichnen.
	 */
	private void zeichneKaufenButton(Graphics2D g2d) {

		int boxBreite = GamePlay.skalieren(420);
		int boxHöhe = GamePlay.skalieren(500);
		int abstand = GamePlay.skalieren(30);

		int offsetX = 0;
		if (kaufenButtonWackelt) {
			long vergangen = System.currentTimeMillis() - kaufenButtonShakeStart;
			if (vergangen < shakeDauer) {
				offsetX = (int) (Math.sin(vergangen / 30.0) * 10); // wackelt links/rechts
			} else {
				kaufenButtonWackelt = false;
			}
		}

		int x = (getWidth() - boxBreite - abstand) + offsetX;
		int y = (getHeight() / 2 - boxHöhe / 2) - 100;

		kaufenButton.setBounds(x, y + boxHöhe + 30, boxBreite, GamePlay.skalieren(100));

		g2d.setColor(new Color(0, 0, 0, 150));
		g2d.fillRoundRect(kaufenButton.x, kaufenButton.y, kaufenButton.width, kaufenButton.height, 20, 20);

		g2d.setColor(new Color(0xD4AF37));
		g2d.setStroke(new BasicStroke(3));
		g2d.drawRoundRect(kaufenButton.x, kaufenButton.y, kaufenButton.width, kaufenButton.height, 20, 20);

		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(55)));
		g2d.setColor(Color.WHITE);

		// Text mittig im Button
		FontMetrics fm = g2d.getFontMetrics();
		String text = "Kaufen";
		int textWidth = fm.stringWidth(text);
		int textHeight = fm.getAscent();

		int textX = kaufenButton.x + (kaufenButton.width - textWidth) / 2;
		int textY = kaufenButton.y + (kaufenButton.height + textHeight) / 2 - 5;

		g2d.drawString(text, textX, textY);

	}

	/**
	 * Zeichnet den Reroll-Button im Spielbereich.
	 * <p>
	 * Positioniert den Button oben links und stellt ihn mit aktuellem Reroll-Preis dar.
	 * Bei fehlendem Guthaben oder Interaktion wird der Button für eine kurze Zeit „wackelnd“ animiert (Shake-Effekt).
	 * Der Button wird als {@link Rectangle} für spätere Klick-Erkennung gespeichert.
	 * </p>
	 *
	 * @param g2d Das {@link Graphics2D}-Objekt zum Zeichnen.
	 */
	private void zeichneRerollButton(Graphics2D g2d) {
		// Reroll-Button oben links

		g2d.setColor(Color.DARK_GRAY);
		String rerollButtonText = String.format("Reroll: %d", rerollPreis);
		int offsetX = 0;
		if (rerollButtonWackelt) {
			long vergangen = System.currentTimeMillis() - rerollButtonShakeStart;
			if (vergangen < shakeDauer) {
				offsetX = (int) (Math.sin(vergangen / 30.0) * 10); // wackelt links/rechts
			} else {
				rerollButtonWackelt = false;
			}
		}

		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(40)));
		FontMetrics fm = g2d.getFontMetrics();
		int textWidth = fm.stringWidth(rerollButtonText);
		int textHeight = fm.getHeight();

		rerollButton = new Rectangle(50 + offsetX, 80, textWidth + 20, textHeight + 20);

		g2d.fillRoundRect(rerollButton.x, rerollButton.y - 17, rerollButton.width, rerollButton.height - 20, 5, 5);
		g2d.setColor(Color.WHITE);
		g2d.drawString(rerollButtonText, rerollButton.x + 10, rerollButton.y + 20);

	}

	/**
	 * Führt den Kaufvorgang für einen Shop-Artikel durch.
	 * <p>
	 * Überprüft, ob der Spieler genügend Geld für den ausgewählten {@link ShopArtikel} hat.
	 * Bei Erfolg wird das Geld abgezogen, der Artikel (Item oder Karte) dem Spielerinventar bzw. Deck hinzugefügt und aus dem Shop entfernt.
	 * Andernfalls wird der Kaufen-Button optisch hervorgehoben ("Wackeln"), um auf das fehlende Geld hinzuweisen.
	 * </p>
	 *
	 * @param artikel Der zu kaufende Shop-Artikel.
	 */
	private void kaufVorgang(ShopArtikel artikel) {
		int preis = artikel.getPreis();
		int kontostand = GameState.getInstance().getMoney();
		if (preis <= kontostand) {
			int summe = kontostand - preis;
			GameState.getInstance().setMoney(summe);

			if (artikel instanceof Item item) {
				GameState.getInstance().getSpieler().addToInventory(item);
			}

			if (artikel instanceof Karte karte) {
				GameState.getInstance().getSpieler().addCardToDeck(karte);
			}

			shopInhalt.remove(artikel);
			klickArtikel = null;
			

		} else {
			kaufenButtonWackelt = true;
			kaufenButtonShakeStart = System.currentTimeMillis();
			manfredStatus = 0;
		}

	}

	public void setWeiterButtonListener(WeiterButtonListener listener) {
		this.weiterButtonListener = listener;
	}

	public void setSpeibeButtonListener(SpeibeButtonListener speibeButtonListener) {
		this.speibeButtonListener = speibeButtonListener;
	}

	/**
	 * Führt einen Reroll des Shop-Angebots durch, sofern genügend Geld vorhanden ist.
	 * <p>
	 * Überprüft, ob der Spieler den Reroll-Preis bezahlen kann. Bei Erfolg wird der Reroll-Zähler erhöht,
	 * das Geld abgezogen und der Shop-Inhalt auf {@code null} gesetzt, um ein neues Angebot zu erzwingen.
	 * Bei zu wenig Geld wird der Reroll-Button optisch durch ein "Wackeln" hervorgehoben.
	 * </p>
	 */
	public void reroll() {

		int kontostand = GameState.getInstance().getMoney();
		if (rerollPreis <= kontostand) {

			rerollCounter++;
			int summe = kontostand - rerollPreis;
			GameState.getInstance().setMoney(summe);
			shopInhalt = null;

		} else {
			rerollButtonWackelt = true;
			rerollButtonShakeStart = System.currentTimeMillis();
		}
	}

}
