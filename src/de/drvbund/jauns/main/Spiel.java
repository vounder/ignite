package de.drvbund.jauns.main;

import javax.swing.*;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringWriter;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.stream.Collectors;

import javax.imageio.ImageIO;

public class Spiel extends JPanel {

	private ArrayList<Karte> spielerKartenZumZeichnen = new ArrayList<>();
	private ArrayList<Karte> gegnerKartenZumZeichnen = new ArrayList<>();
	private boolean platzhalter = true;

	private Karte hoverKarte = null;
	private GamePlay gameplay;
	private Point ersteKartenPosition = new Point();
	private Point letzteKartenPosition = new Point();
	private Point gegnerDeckPosition = new Point();

	private boolean stapelWackelt = false;
	private long shakeStart = 0;
	private final int shakeDauer = 300; // ms

	public static Karte staticAnimierteKarte = null;
	private Karte animierteKarte = null;
	private Point start = null;
	private Point ziel = null;
	private long animationsStart = 0;
	private final int animationsDauer = 300; // ms
	private Runnable nachAnimation = null;

	private Karte ziehendeKarte = null;
	private Point ziehStart = null;
	private Point ziehZiel = null;
	private long ziehStartZeit = 0;
	private final int ziehDauer = 200;
	private Runnable nachZiehen = null;

	private Rectangle weiterButton = new Rectangle();
	private Rectangle gameOverButton = new Rectangle();
	private boolean gameOverAktiv = false;
	private boolean spielGewonnenAktiv = false;
	private boolean gameOver = false;
	private boolean spielGewonnen = false;

	private Rectangle deckKartenBereich = new Rectangle();

	private double kreisRotationSpieler = 0;
	private double kreisRotationGegner = 0;

	private int wartezeitScoreGewonnenAnzeige = 0;
	private double score = GameState.getInstance().getScore();
	private double tmpScore = 1;
	private double mult = 0.01;
	private double tmpMoney = 0;

	private boolean belohnungBekommen = false;
	
	private int wechsel = 30;
	
	long letzteZeit = System.nanoTime();

	private WeiterButtonListener weiterButtonListener;

	/**
	 * Konstruktor für das Spielfeld-Panel.
	 * <p>
	 * Initialisiert das Spielfeld mit Ressourcen (Hintergrund, Kreisbild), startet die Menümusik und setzt einen Timer für das Repaint.
	 * Setzt die nötigen Maus-Listener für Karten- und Button-Interaktion, Karten ziehen sowie Hover-Effekte.
	 * </p>
	 *
	 * @param gameplay Die {@link GamePlay}-Instanz für Spiellogik und Ressourcenmanagement.
	 */
	public Spiel(GamePlay gameplay) {
		setDoubleBuffered(true);
		this.gameplay = gameplay;
		gameplay.starteMenüMusik();

		RessourceLoader.getInstance().addHintergrundbild("/misc/png/background.png");
		RessourceLoader.getInstance().addHintergrundbild("/misc/png/background4.png");

		BufferedImage kreis = null;
		try (InputStream is = getClass().getResourceAsStream("/misc/png/kreis.png")) {
		    if (is != null) {
		        kreis = ImageIO.read(is);
		    } else {
		        System.err.println("Kreis nicht gefunden: /misc/png/kreis.png");
		    }
		} catch (IOException e) {
		    e.printStackTrace();
		}
		RessourceLoader.getInstance().setKreis(kreis);


		Timer timer = new Timer(16, e -> {
			repaint();
		});
		timer.start();

		addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				Point klick = e.getPoint();
				// Deckkarte wurde angeklickt
				if (deckKartenBereich.contains(klick) && !gameOverAktiv && !spielGewonnenAktiv) {
					if (GameState.getInstance().isSpielerZug()) {
						if (GameState.getInstance().getSpieler().getDeck().size() > 0) {
							ziehendeKarte = GameState.getInstance().getSpieler().getHand().getFirst();
							ziehStart = new Point(deckKartenBereich.x, deckKartenBereich.y);
							ziehZiel = new Point(letzteKartenPosition.x, letzteKartenPosition.y);
							ziehStartZeit = System.currentTimeMillis();

							nachZiehen = () -> {
								GameState.getInstance().getSpieler().karteZiehen(1);
								gameplay.toggleSpielerZug();
							};
						} else {
							gameOver = true;
						}
					}
					return;
				}

				if (gameOverAktiv && gameOverButton.contains(klick)) {
					gameOverAktiv = false;
					gameOver = false;
					gameplay.clearSpielerZugListener();
					gameplay.newRun(); // Spiel neu starten
					setKartenZumZeichnen();

					return;
				}

				if (spielGewonnenAktiv && weiterButton.contains(klick)) {
					if (weiterButtonListener != null) {
						belohnungBekommen = false;
						wartezeitScoreGewonnenAnzeige = 0;
						tmpScore = 1;

						weiterButtonListener.onWeiterGedrückt();
					}
				}

				if (!gameOverAktiv)
					handleKartenKlick(klick);
			}
		});

		addMouseMotionListener(new MouseMotionAdapter() {
			@Override
			public void mouseMoved(MouseEvent e) {

				if (!gameOverAktiv && !spielGewonnenAktiv)
					updateHoverKarte(e.getPoint());
			}
		});

	}

	/**
	 * Überschreibt das Paint-Verhalten der Komponente und zeichnet das gesamte Spielfeld.
	 * <p>
	 * Lädt und zeichnet den Hintergrund, aktualisiert die Startpositionen, rendert alle Spielfelder (Level, Score, Geld, Karten, Animationen)
	 * und prüft am Ende, ob ein Game-Over- oder Gewonnen-Screen angezeigt werden muss.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	@Override
	protected void paintComponent(Graphics g) {
		super.paintComponent(g);

		g.drawImage(RessourceLoader.getInstance().ladeHintergrundbild(0), 0, 0, getWidth(), getHeight(), this);

		ersteKartenPosition.x = GamePlay.skalieren(160);
		ersteKartenPosition.y = getHeight() - GamePlay.skalieren(180);

		if (animierteKarte == null && staticAnimierteKarte != null) {
			animierteKarte = staticAnimierteKarte;
			staticAnimierteKarte = null;
		}

		if (GameState.getInstance().getSpieler() != null) {

			zeichneLevel(g);
			zeichneScoreAnzeige(g);
			zeichneGeldBox(g);
			zeichneKartenbeschreibungBox(g);

			zeichneSpielerKarten(g);
			zeichneStapelMitte(g);
			zeichneDeckSpieler(g);
			zeichneGegnerKarten(g);

			zeichneKartenAnimation(g);
			zeichneZiehAnimation(g);

			if (animierteKarte == null && staticAnimierteKarte != null) {
				animierteKarte = staticAnimierteKarte;
				staticAnimierteKarte = null;
			}

			checkGameOver(g);
		}

	}

	/**
	 * Zeichnet die Animation für das Ausspielen einer Karte.
	 * <p>
	 * Animiert die Bewegung und Skalierung der aktuell gespielten Karte von Start- zu Zielposition.
	 * Nach Abschluss der Animation wird optional eine Callback-Aktion ausgeführt
	 * und der Zug an den nächsten Spieler übergeben.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneKartenAnimation(Graphics g) {
		if (animierteKarte == null)
			return;

		long now = System.currentTimeMillis();
		double progress = Math.min(1.0, (now - animationsStart) / (double) animationsDauer);

		int x = (int) (start.x + (ziel.x - start.x) * progress);
		int y = (int) (start.y + (ziel.y - start.y) * progress);

		double scale = 0.8 + 0.2 * progress;
		int breite = (int) (GamePlay.skalieren(400) * scale);
		int höhe = (int) (GamePlay.skalieren(400) * scale);

		x -= breite / 2;
		y -= höhe / 2;

		zeichneKarte(g, animierteKarte, x, y, new Dimension(breite, höhe));

		if (progress >= 1.0) {
			if (nachAnimation != null) {
				System.out.println("Animation beendet, führe nachAnimation aus.");
				nachAnimation.run();
				nachAnimation = null;
			} else {

			}
			animierteKarte = null;
			gameplay.toggleSpielerZug();
		} else {

		}
	}

	/**
	 * Zeichnet die Animation für das Ziehen einer Karte vom Stapel zur Hand.
	 * <p>
	 * Animiert den Übergang einer Karte von der Stapelposition zum Zielpunkt in Abhängigkeit des Fortschritts.
	 * Während der ersten Hälfte der Animation wird die Kartenrückseite angezeigt, danach die gezogene Karte.
	 * Nach Abschluss der Animation wird eine Callback-Aktion ausgeführt.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneZiehAnimation(Graphics g) {
		if (ziehendeKarte == null)
			return;

		long now = System.currentTimeMillis();
		double progress = Math.min(1.0, (now - ziehStartZeit) / (double) ziehDauer);

		int x = (int) (ziehStart.x + (ziehZiel.x - ziehStart.x) * progress);
		int y = (int) (ziehStart.y + (ziehZiel.y - ziehStart.y) * progress);

		double scale = (progress < 0.5) ? 1.0 - (progress * 2) : (progress - 0.5) * 2;
		int breite = Math.max(1, (int) (GamePlay.skalieren(150) * scale));
		int höhe = GamePlay.skalieren(180);

		x -= breite / 2;
		y -= höhe / 2;

		Karte aktuelleKarte = (progress < 0.5) ? GameState.getInstance().getSpieler().getKartenRückseite()
				: ziehendeKarte;

		zeichneKarte(g, aktuelleKarte, x, y, new Dimension(breite, höhe));

		if (progress >= 1.0 && nachZiehen != null) {
			nachZiehen.run();
			nachZiehen = null;
			ziehendeKarte = null;
		} else {

		}
	}

	/**
	 * Berechnet den Mittelpunkt des mittleren Kartenstapels im Spielfenster.
	 * <p>
	 * Nutzt die aktuelle Fenstergröße und die festgelegte Kartengröße, um den Mittelpunkt des Stapels zu bestimmen.
	 * </p>
	 *
	 * @return Ein {@link Point}-Objekt mit den Bildschirmkoordinaten des Stapelmittelpunkts.
	 */
	private Point berechneStapelMittelpunkt() {
		Dimension kartenGroesse = new Dimension(GamePlay.skalieren(400), GamePlay.skalieren(400));

		int drawX = GamePlay.skalieren((getWidth() / 2) - (kartenGroesse.width / 2) + 100);
		int drawY = GamePlay.skalieren((getHeight() / 2) - kartenGroesse.height + 160);

		// Jetzt Mittelpunkt berechnen:
		int centerX = drawX + kartenGroesse.width / 2;
		int centerY = drawY + kartenGroesse.height / 2;

		return new Point(centerX, centerY);
	}

	/**
	 * Aktualisiert die Listen der zu zeichnenden Karten für Spieler und Gegner.
	 * <p>
	 * Ruft interne Methoden auf, um die aktuell sichtbaren Karten beider Parteien auf den neuesten Stand zu bringen.
	 * </p>
	 */
	public void setKartenZumZeichnen() {
		setSpielerKartenZumZeichnen();
		setGegnerKartenZumZeichnen();
	}

	public void setSpielerKartenZumZeichnen() {
		this.spielerKartenZumZeichnen = GameState.getInstance().getSpieler().getHand();

	}

	public void setGegnerKartenZumZeichnen() {
		this.gegnerKartenZumZeichnen = GameState.getInstance().getGegner().getHand();

	}

	/**
	 * Zeichnet einen Kreis mit der aktuellen Kartenanzahl für einen Spieler (Handkarten-Anzeige).
	 * <p>
	 * Stellt einen goldenen Kreis mit animierter Drehung für den aktiven Spieler bzw. Gegner dar,
	 * zeigt ein Bild im Kreis und rendert die Anzahl der Handkarten mittig.
	 * </p>
	 *
	 * @param g            Das {@link Graphics}-Objekt zum Zeichnen.
	 * @param y            Die Y-Position (oben) des Kreises.
	 * @param kreisGroesse Durchmesser des Kreises.
	 * @param kreisX       X-Koordinate der linken oberen Ecke.
	 * @param kreisY       Y-Koordinate der linken oberen Ecke.
	 * @param spieler      Der zugehörige {@link Spieler}, dessen Handkarten angezeigt werden.
	 */
	private void zeichneHandGroesseKreis(Graphics g, int y, int kreisGroesse, int kreisX, int kreisY, Spieler spieler) {
		BufferedImage img = RessourceLoader.getInstance().getKreis();
		Graphics2D g2d = (Graphics2D) g.create();

		// Smooth Rendering
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

		// Wer ist dran?
		boolean istAktiverSpieler = GameState.getInstance().isSpielerZug()
				&& spieler == GameState.getInstance().getSpieler();
		boolean istGegnerZug = !GameState.getInstance().isSpielerZug()
				&& spieler == GameState.getInstance().getGegner();

		// Rotation aktualisieren
		double rotation = 0;
		if (istAktiverSpieler) {
			kreisRotationSpieler += 0.3;
			rotation = kreisRotationSpieler;
		} else if (istGegnerZug) {
			kreisRotationGegner += 0.3;
			rotation = kreisRotationGegner;
		}

		// Kreis zeichnen
		g2d.setColor(new Color(0xD4AF37));
		g2d.fillOval(kreisX, kreisY, kreisGroesse, kreisGroesse);

		g2d.setColor(Color.BLACK);
		g2d.setStroke(new BasicStroke(GamePlay.skalieren(6)));
		g2d.drawOval(kreisX, kreisY, kreisGroesse, kreisGroesse);

		// Bild zeichnen (rotiert)
		if (img != null) {
			double dCenterX = kreisX + kreisGroesse / 2.0;
			double dCenterY = kreisY + kreisGroesse / 2.0;

			if (istAktiverSpieler || istGegnerZug) {
				AffineTransform transform = new AffineTransform();
				transform.rotate(Math.toRadians(rotation), dCenterX, dCenterY);
				transform.translate(kreisX, kreisY);
				transform.scale(kreisGroesse / (double) img.getWidth(), kreisGroesse / (double) img.getHeight());

				g2d.drawImage(img, transform, this);
			} else {
				g2d.drawImage(img, kreisX, kreisY, kreisGroesse, kreisGroesse, this);
			}
		}

		g2d.dispose();

		// Text separat zeichnen
		Graphics2D gText = (Graphics2D) g.create();
		gText.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
		gText.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
		gText.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

		String text = String.valueOf(spieler.getHand().size());
		gText.setFont(new Font("Arial", Font.BOLD, GamePlay.skalieren(55)));

		FontMetrics fm = gText.getFontMetrics();
		int textWidth = fm.stringWidth(text);
		int textHeight = fm.getAscent();

		double dCenterX = kreisX + kreisGroesse / 2.0;
		double dCenterY = kreisY + kreisGroesse / 2.0;

		gText.setColor(Color.BLACK);
		gText.drawString(text, (int) (dCenterX - textWidth / 2.0), (int) (dCenterY + textHeight / 3.0));
		gText.dispose();
	}

	/**
	 * Zeichnet einen einfachen Platzhalter an der angegebenen Position.
	 * <p>
	 * Stellt ein hellgraues Rechteck mit schwarzem Rahmen und beschriftendem Text dar,
	 * falls ein Kartenbild oder eine Ressource nicht geladen werden konnte.
	 * </p>
	 *
	 * @param g       Das {@link Graphics}-Objekt zum Zeichnen.
	 * @param x       Die X-Koordinate der linken oberen Ecke.
	 * @param y       Die Y-Koordinate der linken oberen Ecke.
	 * @param text    Der im Platzhalter anzuzeigende Text.
	 * @param groesse Die gewünschte Größe des Platzhalters.
	 */
	private void zeichnePlatzhalter(Graphics g, int x, int y, String text, Dimension groesse) {
		g.setColor(Color.LIGHT_GRAY);
		g.fillRect(x, y, GamePlay.skalieren(groesse.width), GamePlay.skalieren(groesse.height));
		g.setColor(Color.BLACK);
		g.drawRect(x, y, GamePlay.skalieren(groesse.width), GamePlay.skalieren(groesse.height));
		g.drawString(text, x + GamePlay.skalieren(10), y + GamePlay.skalieren(75));
	}

	/**
	 * Zeichnet alle Handkarten des Spielers inklusive Handgrößen-Anzeige.
	 * <p>
	 * Zeigt die Karten des Spielers an berechneten Positionen, hebt die „gehoverte“ Karte optisch hervor
	 * und stellt einen Kreis mit der aktuellen Kartenanzahl dar.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneSpielerKarten(Graphics g) {
		zeichneHandGroesseKreis(g, ersteKartenPosition.y, // y = oben
				GamePlay.skalieren(150), // größe
				10, // x = rechts
				ersteKartenPosition.y + 15, // y = oben
				GameState.getInstance().getSpieler());

		ArrayList<Point> positionen = getKartenPositionen();
		Dimension standard = new Dimension(GamePlay.skalieren(150), GamePlay.skalieren(180));
		Dimension hover = new Dimension(GamePlay.skalieren(170), GamePlay.skalieren(204));

		for (int i = 0; i < spielerKartenZumZeichnen.size(); i++) {
			Karte karte = spielerKartenZumZeichnen.get(i);
			Point pos = positionen.get(i);

			if (karte == hoverKarte)
				continue; // später separat zeichnen

			zeichneKarte(g, karte, pos.x, pos.y, standard);
		}

		if (hoverKarte != null) {
			int i = spielerKartenZumZeichnen.indexOf(hoverKarte);
			if (i >= 0 && i < getKartenPositionen().size()) {
				Point pos = getKartenPositionen().get(i);
				zeichneKarte(g, hoverKarte, pos.x - GamePlay.skalieren(10), pos.y - GamePlay.skalieren(20), hover);
			}
		}

	}
	
	/**
	 * Zeichnet die Kartenhand des Gegners inklusive Handgrößen-Anzeige.
	 * <p>
	 * Stellt einen Kreis oben rechts im Fenster dar, der die Anzahl der gegnerischen Handkarten anzeigt.
	 * Links daneben werden die Rückseiten (oder echten Karten bei Debug) nebeneinander als Handkarten des Gegners gezeichnet.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneGegnerKarten(Graphics g) {
		// Kreis oben rechts
		int kreisGroesse = GamePlay.skalieren(150);
		int kreisX = getWidth() - GamePlay.skalieren(160);
		int kreisY = 10;

		zeichneHandGroesseKreis(g, 0, kreisGroesse, kreisX, kreisY, GameState.getInstance().getGegner());

		// Karten links vom Kreis
		int startX = kreisX - GamePlay.skalieren(160); // Platz links vom Kreis
		int startY = kreisY;
		int abstand = GamePlay.skalieren(30);
		Dimension kartengroesse = new Dimension(GamePlay.skalieren(150), GamePlay.skalieren(180));

		for (int i = 0; i < gegnerKartenZumZeichnen.size(); i++) {
			Karte karte;
			if (platzhalter) {
				karte = GameState.getInstance().getSpieler().getKartenRückseite();
			} else {
				karte = gegnerKartenZumZeichnen.get(i);
			}
			int x = startX - i * abstand;
			int y = startY;
			zeichneKarte(g, karte, x, y, kartengroesse);
		}
	}

	/**
	 * Berechnet die Bildschirmpositionen für alle Handkarten des Spielers.
	 * <p>
	 * Die Karten werden mit dynamischem Abstand nebeneinander platziert, sodass sie gleichmäßig im Spielfenster verteilt sind.
	 * Ist keine Karte vorhanden, wird nur die Startposition zurückgegeben.
	 * Die letzte Kartenposition wird für weitere Zwecke gespeichert.
	 * </p>
	 *
	 * @return Liste aller berechneten Kartenpositionen.
	 */
	private ArrayList<Point> getKartenPositionen() {
		ArrayList<Point> positionen = new ArrayList<>();

		if (!GameState.getInstance().getSpieler().getHand().isEmpty()) {
			int kartenAnzahl = spielerKartenZumZeichnen.size();
			int kartenBreite = GamePlay.skalieren(150);
			int gesamtBreite = getWidth() - ersteKartenPosition.x - GamePlay.skalieren(500);
			int maxSpacing = GamePlay.skalieren(110);

			int spacing = (kartenAnzahl > 1) ? Math.min(maxSpacing, (gesamtBreite - kartenBreite) / (kartenAnzahl - 1))
					: 0;

			int x = ersteKartenPosition.x;
			int y = ersteKartenPosition.y;

			for (int i = 0; i < kartenAnzahl; i++) {
				positionen.add(new Point(x, y));
				x += spacing;
			}
			letzteKartenPosition = positionen.get(positionen.size() - 1);
		} else {
			letzteKartenPosition = ersteKartenPosition;
			positionen.add(ersteKartenPosition);
		}

		return positionen;
	}

	/**
	 * Zeichnet eine einzelne Karte inklusive Bild und aller zugehörigen Emoji-Effekte.
	 * <p>
	 * Rendert das Kartenbild an gegebener Position und Größe. Bei Fehlern oder fehlender Ressource wird ein Platzhalter gezeichnet.
	 * Sind Zusatzeffekte vorhanden, werden die zugehörigen Emojis mit automatischem Umbruch als Overlay auf der Karte angezeigt.
	 * </p>
	 *
	 * @param g       Das {@link Graphics}-Objekt zum Zeichnen.
	 * @param karte   Die zu zeichnende {@link Karte}.
	 * @param x       Die X-Koordinate der linken oberen Ecke.
	 * @param y       Die Y-Koordinate der linken oberen Ecke.
	 * @param groesse Die Größe, in der die Karte gezeichnet werden soll.
	 */
	private void zeichneKarte(Graphics g, Karte karte, int x, int y, Dimension groesse) {
		try {
			if (platzhalter) {
				BufferedImage img = RessourceLoader.getInstance().ladeRessource(karte.getLoaderIndex());
				if (img != null) {
					g.drawImage(img, x, y, groesse.width, groesse.height, this);
				} else {
					zeichnePlatzhalter(g, x, y, "Bild leer", groesse);
				}
			} else {
				zeichnePlatzhalter(g, x, y, "Kein Pfad", groesse);
			}
		} catch (NullPointerException e) {
			e.printStackTrace();
			zeichnePlatzhalter(g, x, y, "Fehler", groesse);
		}
		if (karte.getZusätze() != null) {
			// String test = "cock und sack";

			String alleEmojis = karte.getZusätze().stream().map(Zusatzkarte::getEmoji).collect(Collectors.joining(" "));

			Graphics2D g2d = (Graphics2D) g.create();

			int fontGroesse = groesse.height / 11;

			Font emojifont = new Font("Segoe UI Emoji", Font.PLAIN, GamePlay.skalieren(fontGroesse));

			x = x + (groesse.width / 3);
			y = y + (groesse.height - (groesse.height / 5) * 4);

			int w = groesse.width / 2;
			int zeilenabstand = groesse.height / 2 + (groesse.height / 7);

			drawWrappedText(g2d, alleEmojis, x, y, w, zeilenabstand, emojifont);

		}

	}

	/**
	 * Aktualisiert die aktuell „gehoverte“ Spielerkarte anhand der Mausposition.
	 * <p>
	 * Überprüft alle gezeichneten Spieler-Kartenbereiche und setzt die {@code hoverKarte} auf die Karte,
	 * über deren Bereich sich die Maus befindet.
	 * </p>
	 *
	 * @param p Die aktuelle Mausposition.
	 */
	private void updateHoverKarte(Point p) {
		ArrayList<Point> positionen = getKartenPositionen();
		Dimension standard = new Dimension(GamePlay.skalieren(150), GamePlay.skalieren(180));
		hoverKarte = null;

		for (int i = 0; i < spielerKartenZumZeichnen.size(); i++) {
			Point pos = positionen.get(i);
			Rectangle bereich = new Rectangle(pos.x, pos.y, standard.width, standard.height);
			if (bereich.contains(p)) {
				hoverKarte = spielerKartenZumZeichnen.get(i);
				break;
			}
		}
	}

	/**
	 * Behandelt den Klick auf eine Spielerkarte und startet ggf. die Ausspiel-Animation.
	 * <p>
	 * Prüft für jede gezeichnete Spielerkarte, ob der Klick in ihren Bereich fällt. Ist der Spieler am Zug und die gewählte Karte passend,
	 * wird die Ausspiel-Animation gestartet und nach Abschluss die Karte aus der Hand entfernt, zur Ablage hinzugefügt und Effekte sowie Score berechnet.
	 * Ist die Karte nicht passend, wird der mittlere Kartenstapel animiert („wackelt“).
	 * </p>
	 *
	 * @param klick Die angeklickte Position.
	 */
	private void handleKartenKlick(Point klick) {
		ArrayList<Point> positionen = getKartenPositionen();
		Dimension standard = new Dimension(GamePlay.skalieren(150), GamePlay.skalieren(180));

		for (int i = 0; i < spielerKartenZumZeichnen.size(); i++) {
			Point pos = positionen.get(i);
			Rectangle bereich = new Rectangle(pos.x, pos.y, standard.width, standard.height);
			if (bereich.contains(klick)) {
				Karte karte = spielerKartenZumZeichnen.get(i);
				if (GameState.getInstance().isSpielerZug()) {
					if (GamePlay.passendeKarte(karte)) {
						// Starte Animation
						animierteKarte = karte;
						start = positionen.get(i);
						ziel = berechneStapelMittelpunkt();
						animationsStart = System.currentTimeMillis();

						nachAnimation = () -> {
							System.out.println("Spieler legt Karte: " + karte);
							GameState.getInstance().getSpieler().getHand().remove(karte);
							GameState.getInstance().getSpieler().getAblage().add(karte);
							GameState.getInstance().setLastCard(karte);
							gameplay.kartenAction(karte);
							gameplay.scoreBerechnen(karte);
						};

						return;
					} else {
						stapelWackelt = true;
						shakeStart = System.currentTimeMillis();
					}
				}

			}
		}
	}

	/**
	 * Zeichnet den mittleren Kartenstapel im Spielfeld.
	 * <p>
	 * Platziert die aktuell oberste Karte (oder die Rückseite, falls keine vorhanden ist) zentral mit einer festen Größe.
	 * Bei bestimmten Aktionen wird der Stapel für kurze Zeit wackelnd animiert (Shake-Effekt).
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneStapelMitte(Graphics g) {
		Dimension kartenGroesse = new Dimension(400, 400);

		int offsetX = 0;
		if (stapelWackelt) {
			long vergangen = System.currentTimeMillis() - shakeStart;
			if (vergangen < shakeDauer) {
				offsetX = (int) (Math.sin(vergangen / 30.0) * 10); // wackelt links/rechts
			} else {
				stapelWackelt = false;
			}
		}

		int drawX = GamePlay.skalieren((getWidth() / 2) - (kartenGroesse.width / 2) + 100) + offsetX;
		int drawY = GamePlay.skalieren((getHeight() / 2) - kartenGroesse.height + 160);

		Karte karte = GameState.getInstance().getLastCard() != null ? GameState.getInstance().getLastCard()
				: GameState.getInstance().getSpieler().getKartenRückseite();

		zeichneKarte(g, karte, drawX, drawY, kartenGroesse);

		if (stapelWackelt) {

		}
	}


	/**
	 * Zeichnet das Deck des Spielers inklusive Kartenbild und Restkarten-Anzeige.
	 * <p>
	 * Stellt an fester Position die Rückseite des Decks oder einen Platzhalter dar und zeigt die aktuelle Deckgröße als Zahl.
	 * Bei weniger als 10 Karten wird die Zahl farblich animiert, um den niedrigen Stand hervorzuheben.
	 * Fehler beim Laden des Kartenbilds werden mit Platzhaltern abgefangen.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneDeckSpieler(Graphics g) {

		Dimension kartenGroesse = new Dimension(275, 275); // KartenGröße

		// KartenPosition
		int drawX = GamePlay.skalieren((getWidth() / 2) - (((int) kartenGroesse.getWidth() / 2)) - 260);
		;
		int drawY = GamePlay.skalieren((getHeight() / 2) - ((int) kartenGroesse.getHeight()) + 150);
		;
		deckKartenBereich.setBounds(drawX, drawY, GamePlay.skalieren(kartenGroesse.width),
				GamePlay.skalieren(kartenGroesse.height));

		try {
			if (platzhalter) {
				BufferedImage img = RessourceLoader.getInstance().ladeRessource(0);
				if (img != null) {
					g.drawImage(img, drawX, drawY, GamePlay.skalieren(kartenGroesse.width),
							GamePlay.skalieren(kartenGroesse.height), this);
				} else {
					zeichnePlatzhalter(g, drawX, drawY, "Bild leer", kartenGroesse);
				}
			} else {
				zeichnePlatzhalter(g, drawX, drawY, "Kein Pfad", kartenGroesse);
			}
		} catch (NullPointerException e) {
			e.printStackTrace();
			zeichnePlatzhalter(g, drawX, drawY, "Fehler", kartenGroesse);
		}

		Graphics2D g2d = (Graphics2D) g.create();

		g2d.setFont(gameplay.bitFont.deriveFont((float) GamePlay.skalieren(35)));
		int deckSize = GameState.getInstance().getSpieler().getDeck().size();
		if (deckSize > 9)
			g2d.setColor(new Color(106, 90, 205, 200));
		else {
			wechsel++;
			if ((wechsel / 20) % 2 == 0) {
				g2d.setColor(new Color(255, 0, 0, 200));
			} else {
				g2d.setColor(new Color(150, 0, 0, 50));
			}
		}

		int anzahlX = drawX + (drawX / 4);
		int anzahlY = drawY + (drawY / 2) - GamePlay.skalieren(5);

		FontMetrics fm = g2d.getFontMetrics();

		String text = String.valueOf(GameState.getInstance().getSpieler().getDeck().size());

		int textWidth = fm.stringWidth(text);

		if (deckSize < 10) {
			g2d.drawString(text, anzahlX + (textWidth / 2), anzahlY);
		} else {
			g2d.drawString(text, anzahlX, anzahlY);
		}

	}



	/**
	 * Aktualisiert die Zeitvariable und führt ggf. Zeichen- oder Update-Operationen durch.
	 * <p>
	 * Speichert die aktuelle Systemzeit (in Nanosekunden) in der Variablen {@code letzteZeit}.
	 * </p>
	 */
	void updateUndZeichne() {
		long aktuelleZeit = System.nanoTime();
		letzteZeit = aktuelleZeit;
	}

	/**
	 * Prüft, ob das Spiel verloren wurde.
	 * <p>
	 * Das Spiel gilt als verloren, wenn entweder die Hand des Gegners leer ist oder der aktuelle Score negativ ist.
	 * </p>
	 *
	 * @return {@code true}, wenn das Spiel verloren wurde, sonst {@code false}.
	 */
	private boolean spielIstVerloren() {
		return GameState.getInstance().getGegner().getHand().isEmpty() || GameState.getInstance().getScore() < 0;
	}

	
	/**
	 * Prüft, ob das Spiel gewonnen wurde.
	 * <p>
	 * Ein Spiel gilt als gewonnen, wenn entweder die Hand des Spielers leer ist oder das Deck des Gegners aufgebraucht wurde.
	 * In diesem Fall wird der aktuelle Score gespeichert und die Geldbelohnung ausgezahlt (sofern noch nicht geschehen).
	 * </p>
	 *
	 * @return {@code true}, wenn das Spiel gewonnen wurde, sonst {@code false}.
	 */
	private boolean spielIstGewonnen() {
		if (GameState.getInstance().getSpieler().getHand().isEmpty()
				|| GameState.getInstance().getGegner().getDeck().isEmpty()) {
			score = GameState.getInstance().getScore();

			if (!belohnungBekommen) {
				gameplay.geldBelohnung();
				belohnungBekommen = true;
			}
		}
		return GameState.getInstance().getSpieler().getHand().isEmpty()
				|| GameState.getInstance().getGegner().getDeck().isEmpty();
	}

	/**
	 * Zeichnet den Screen für einen gewonnenen Durchlauf inklusive animierter Score- und Geldanzeige.
	 * <p>
	 * Legt ein halbtransparentes Overlay über das Spielfeld, zeigt den „Gewonnen!“-Text, den erreichten Score sowie die Belohnung (animiert) an.
	 * Ist die Animation abgeschlossen, wird ein Weiter-Button angezeigt, um fortzufahren.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeigeGewonnenScreen(Graphics g) {
		Graphics2D g2d = (Graphics2D) g.create();

		// Hintergrund
		g2d.setColor(new Color(0, 0, 0, 180));
		g2d.fillRect(0, 0, getWidth(), getHeight());

		// "Gewonnen!" Text
		String text = "Gewonnen!";
		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(80)));
		g2d.setColor(Color.WHITE);
		FontMetrics fm = g2d.getFontMetrics();
		int text1Width = fm.stringWidth(text);
		int x = (getWidth() - text1Width) / 2;
		int y = getHeight() / 2 - GamePlay.skalieren(100);
		g2d.drawString(text, x, y);

		// Score-Animation
		if (tmpScore < score) {
			if (wartezeitScoreGewonnenAnzeige <= 15) {
				tmpScore = 0;
				wartezeitScoreGewonnenAnzeige++;
			} else {
				double diff = score - tmpScore;
				if (tmpScore < (score * 0.5)) {
					tmpScore += diff * 0.05; // langsamer Start
				} else {
					tmpScore += diff * 0.4; // schnelles Finish
					if (diff < 1) {
						tmpScore = score;
					}
				}
			}
		}

		// Score-Anzeige (wie gehabt)
		String scoreText = "Dein Score: ";
		String scoreAnzahlText = (tmpScore == score) ? String.valueOf((int) score) : String.format("%.0f", tmpScore);

		Font fontText = gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(40));
		Font fontZahl = gameplay.bitFont.deriveFont((float) GamePlay.skalieren(28));

		// Breiten berechnen
		g2d.setFont(fontText);
		FontMetrics fmText = g2d.getFontMetrics();
		int textWidth = fmText.stringWidth(scoreText);

		g2d.setFont(fontZahl);
		FontMetrics fmZahl = g2d.getFontMetrics();
		int zahlWidth = fmZahl.stringWidth(scoreAnzahlText);

		// Gesamte Breite
		int gesamtWidth = textWidth + zahlWidth;

		// Position berechnen
		int scoreX = (getWidth() - gesamtWidth) / 2;
		int scoreY = y + GamePlay.skalieren(70);

		// Zeichnen
		g2d.setFont(fontText);
		g2d.drawString(scoreText, scoreX, scoreY);

		g2d.setFont(fontZahl);
		g2d.drawString(scoreAnzahlText, scoreX + textWidth, scoreY);

		// Geld-Anzeige wie Score!
		int geld = GameState.getInstance().getMoney();
		int belohnung = gameplay.belohnung;

		// Animation für Geld, falls du das willst (optional)
		if (tmpScore == score) { // Geld animiert sich erst, wenn Score voll
			if (tmpMoney < belohnung) {
				tmpMoney += Math.max(1, (belohnung - tmpMoney) * 0.4);
				if ((belohnung - tmpMoney) < 1)
					tmpMoney = belohnung;
			}
		} else {
			tmpMoney = 0;
		}

		String moneyText = "Geld: ";
		String moneyAnzahlText = String.format("%d + %d", GameState.getInstance().getMoney() - belohnung, (tmpScore == score ? (int) tmpMoney : 0));

		// Geld-Zeile berechnen wie Score
		g2d.setFont(fontText);
		int moneyTextWidth = g2d.getFontMetrics().stringWidth(moneyText);
		g2d.setFont(fontZahl);
		int moneyZahlWidth = g2d.getFontMetrics().stringWidth(moneyAnzahlText);

		int moneyGesamtWidth = moneyTextWidth + moneyZahlWidth;
		int moneyX = (getWidth() - moneyGesamtWidth) / 2;
		int moneyY = scoreY + GamePlay.skalieren(100);

		// Zeichnen
		g2d.setFont(fontText);
		g2d.drawString(moneyText, moneyX, moneyY);

		g2d.setFont(fontZahl);
		g2d.drawString(moneyAnzahlText, moneyX + moneyTextWidth, moneyY);

		// Button direkt darunter
		int btnW = GamePlay.skalieren(300);
		int btnH = GamePlay.skalieren(80);
		int btnX = (getWidth() - btnW) / 2;
		int btnY = moneyY + GamePlay.skalieren(100);

		if (tmpScore == score && tmpMoney == belohnung) {
			weiterButton.setBounds(btnX, btnY, btnW, btnH);
			g2d.setColor(Color.DARK_GRAY);
			g2d.fillRoundRect(btnX, btnY, btnW, btnH, 20, 20);
			g2d.setColor(Color.WHITE);
			g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(40)));
			String buttonText = "Weiter";
			int bty = btnY + (btnH + g2d.getFontMetrics().getAscent()) / 2 - 5;
			int btx = btnX + (btnW - g2d.getFontMetrics().stringWidth(buttonText)) / 2;
			g2d.drawString(buttonText, btx, bty);
		}

		g2d.dispose();
	}

	/**
	 * Startet die Animationssequenz für das Ausspielen einer gegnerischen Karte.
	 * <p>
	 * Setzt die animierte Karte, berechnet Start- und Zielpunkt der Animation und initialisiert die Laufzeit.
	 * Nach Abschluss der Animation wird die Karte als letzte Karte im {@link GameState} gesetzt und eine Konsolenausgabe erzeugt.
	 * </p>
	 *
	 * @param karte Die vom Gegner auszuspielende Karte.
	 */
	public void animationGegnerTrigger(Karte karte) {
		animierteKarte = karte;

		// Startposition oben rechts
		start = new Point(getWidth() - GamePlay.skalieren(320), GamePlay.skalieren(10));
		ziel = berechneStapelMittelpunkt();
		animationsStart = System.currentTimeMillis();

		nachAnimation = () -> {
			GameState.getInstance().setLastCard(karte);
			System.out.println("Gegner spielt: " + karte.toString());

		};

	}

	/**
	 * Prüft, ob aktuell eine Karten-Animation läuft.
	 * <p>
	 * Gibt den Animationsstatus zur Diagnose auf der Konsole aus und liefert {@code true} zurück,
	 * wenn eine Karte animiert wird ({@code animierteKarte} ist nicht {@code null}).
	 * </p>
	 *
	 * @return {@code true}, wenn gerade animiert wird, sonst {@code false}.
	 */
	public boolean animiertGerade() {
		StringBuilder sb = new StringBuilder();
		sb.append("gerade wird animiert");
		sb.append(animierteKarte != null);
		String str = sb.toString();
		System.out.println(str);
		return animierteKarte != null;
	}

	/**
	 * Prüft, ob das Spiel vorbei ist, und zeigt den entsprechenden Endbildschirm an.
	 * <p>
	 * Überprüft, ob das Spiel verloren oder gewonnen wurde, aktiviert das jeweilige Event und rendert den passenden Screen (Game Over oder Gewonnen).
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	public void checkGameOver(Graphics g) {

		if (spielIstVerloren() || gameOver) {
			gameOverAktiv = true;
			zeigeGameOverScreen(g);
		} else if (spielIstGewonnen() || spielGewonnen) {
			spielGewonnenAktiv = true;
			zeigeGewonnenScreen(g);
		} else {
			return;
		}

	}

	/**
	 * Zeichnet den Game-Over-Screen inklusive Overlay und Neustart-Button.
	 * <p>
	 * Legt ein halbtransparentes, schwarzes Overlay über das Spielfenster, zeigt zentral den „Game Over“-Text und darunter
	 * einen Button zum Neustart des Spiels. Position und Größe werden dynamisch berechnet.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeigeGameOverScreen(Graphics g) {
		Graphics2D g2d = (Graphics2D) g.create();

		g2d.setColor(new Color(0, 0, 0, 180));
		g2d.fillRect(0, 0, getWidth(), getHeight());

		// Text
		String text = "Game Over";
		g2d.setFont(new Font("Arial", Font.BOLD, GamePlay.skalieren(80)));
		g2d.setColor(Color.WHITE);
		FontMetrics fm = g2d.getFontMetrics();
		int textWidth = fm.stringWidth(text);
		int x = (getWidth() - textWidth) / 2;
		int y = getHeight() / 2 - GamePlay.skalieren(60);
		g2d.drawString(text, x, y);

		// Button
		int btnW = GamePlay.skalieren(300);
		int btnH = GamePlay.skalieren(80);
		int btnX = (getWidth() - btnW) / 2;
		int btnY = y + GamePlay.skalieren(100);
		gameOverButton.setBounds(btnX, btnY, btnW, btnH);

		g2d.setColor(Color.DARK_GRAY);
		g2d.fillRoundRect(btnX, btnY, btnW, btnH, 20, 20);
		g2d.setColor(Color.WHITE);
		g2d.setFont(new Font("Arial", Font.BOLD, GamePlay.skalieren(30)));
		String buttonText = "Neues Spiel";
		int btx = btnX + (btnW - g2d.getFontMetrics().stringWidth(buttonText)) / 2;
		int bty = btnY + (btnH + g2d.getFontMetrics().getAscent()) / 2 - 5;
		g2d.drawString(buttonText, btx, bty);

		g2d.dispose();
	}

	public Karte getZiehendeKarte() {
		return ziehendeKarte;
	}

	public void setZiehendeKarte(Karte ziehendeKarte) {
		this.ziehendeKarte = ziehendeKarte;
	}

	/**
	 * Zeichnet die Score-Anzeige oben links im Spielfenster.
	 * <p>
	 * Stellt den aktuellen Punktestand des Spielers in einer halbtransparenten, goldumrandeten Box dar.
	 * Der Score wird mit weißer Schrift und schwarzem Schatteneffekt angezeigt.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneScoreAnzeige(Graphics g) {

		Graphics2D g2d = (Graphics2D) g.create();

		int abstand = GamePlay.skalieren(20);
		int padding = GamePlay.skalieren(15);

		String text = "Score: " + GameState.getInstance().getScore();
		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(44)));
		FontMetrics fm = g2d.getFontMetrics();

		int textWidth = fm.stringWidth(text);
		int textHeight = fm.getHeight();

		int boxWidth = textWidth + padding * 2;
		int boxHeight = textHeight + padding;

		// Box Position
		int x = abstand;
		int y = abstand;

		// Box-Hintergrund (leicht transparent, dunkelgrün)
		g2d.setColor(new Color(0, 0, 0, 150));
		g2d.fillRoundRect(x, y, boxWidth, boxHeight, 20, 20);

		// Goldener Rahmen
		g2d.setStroke(new BasicStroke(3));
		g2d.setColor(new Color(0xD4AF37)); // Gold
		g2d.drawRoundRect(x, y, boxWidth, boxHeight, 20, 20);

		// Text (zentriert in Box)
		int textX = x + padding;
		int textY = y + padding + fm.getAscent() - 5;

		// Optional: dunkler Schatten
		g2d.setColor(Color.BLACK);
		g2d.drawString(text, textX + 2, textY + 2);

		g2d.setColor(Color.WHITE);
		g2d.drawString(text, textX, textY);

		g2d.dispose();

	}

	/**
	 * Zeichnet die Geldanzeige-Box unten rechts im Spielfenster.
	 * <p>
	 * Stellt den aktuellen Geldbetrag des Spielers in einer halbtransparenten, goldumrandeten Box dar.
	 * Der Betrag wird doppelt gezeichnet (mit Schatteneffekt) und die Schriftart dynamisch angepasst.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneGeldBox(Graphics g) {
		Graphics2D g2d = (Graphics2D) g.create();

		int abstand = GamePlay.skalieren(20);
		int padding = GamePlay.skalieren(15);

		String text = "Geld: " + GameState.getInstance().getMoney();
		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(33)));
		FontMetrics fm = g2d.getFontMetrics();

		int textWidth = fm.stringWidth(text);
		int textHeight = fm.getHeight();

		int boxWidth = textWidth + padding * 2;
		int boxHeight = textHeight + padding;

		// Position: unten rechts
		int x = getWidth() - boxWidth - abstand;
		int y = getHeight() - boxHeight - abstand;

		// Hintergrund
		g2d.setColor(new Color(0, 0, 0, 150));
		g2d.fillRoundRect(x, y, boxWidth, boxHeight, 20, 20);

		// Goldrahmen
		g2d.setStroke(new BasicStroke(3));
		g2d.setColor(new Color(0xD4AF37));
		g2d.drawRoundRect(x, y, boxWidth, boxHeight, 20, 20);

		// Text
		int textX = x + padding;
		int textY = y + padding + fm.getAscent() - 5;

		g2d.setColor(Color.BLACK);
		g2d.drawString(text, textX + 2, textY + 2);

		g2d.setColor(Color.WHITE);
		g2d.drawString(text, textX, textY);

		g2d.dispose();
	}

	/**
	 * Zeichnet die Beschreibungsbox für die aktuell ausgewählte oder gelegte Karte.
	 * <p>
	 * Stellt eine halbtransparente Box mit goldener Umrahmung dar und zeigt den Titel („Gelegte Karte“ oder „Ausgewählte Karte“) 
	 * sowie die Kartenbeschreibung (automatisch umgebrochen) an. Schriftart und Rendering-Qualität werden dynamisch angepasst.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneKartenbeschreibungBox(Graphics g) {
		Graphics2D g2d = (Graphics2D) g.create();

		int boxBreite = GamePlay.skalieren(420);
		int boxHöhe = GamePlay.skalieren(500);
		int abstand = GamePlay.skalieren(30);
		int zeilenAbstand = GamePlay.skalieren(50);

		int x = getWidth() - boxBreite - abstand;
		int y = getHeight() / 2 - boxHöhe / 2;

		// Hintergrund
		g2d.setColor(new Color(0, 0, 0, 150)); // halbtransparent
		g2d.fillRoundRect(x, y, boxBreite, boxHöhe, 20, 20);

		// Goldrahmen
		g2d.setColor(new Color(0xD4AF37));
		g2d.setStroke(new BasicStroke(3));
		g2d.drawRoundRect(x, y, boxBreite, boxHöhe, 20, 20);

		// Text
		g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(55)));

		g2d.setColor(Color.WHITE);

		String anzeigeKarte = "Gelegte Karte";
		if (hoverKarte != null) {
			anzeigeKarte = "Ausgewählte Karte";
			g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(45)));
		}
		g2d.drawString(anzeigeKarte, x + zeilenAbstand / 2, y + GamePlay.skalieren(70));

		Karte karte = getHoverOderLetzteKarte(); // sieh unten

		if (karte != null && karte.getBeschreibung() != null) {

			Font font = gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(38));
			drawWrappedText(g2d, karte.getBeschreibung(), x + zeilenAbstand / 2, y + GamePlay.skalieren(150),
					boxBreite - abstand, GamePlay.skalieren(40), font);
		}

		g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);

		g2d.dispose();
	}

	/**
	 * Zeichnet mehrzeiligen, automatisch umgebrochenen Text mit der angegebenen Schriftart.
	 * <p>
	 * Teilt den Text anhand von Leerzeichen in Zeilen auf, sodass jede Zeile die maximale Breite nicht überschreitet.
	 * Die Schriftart wird auf {@code font} gesetzt und der Abstand zwischen den Zeilen mit {@code zeilenAbstand} gesteuert.
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
	 * Gibt die aktuell „gehoverte“ Karte oder, falls keine vorhanden ist, die zuletzt gespielte Karte zurück.
	 * <p>
	 * Dient als Hilfsmethode, um kontextabhängig die relevante Karte (Hover- oder Fallback-Karte) bereitzustellen.
	 * </p>
	 *
	 * @return Die aktuell „gehoverte“ Karte oder die letzte Karte aus dem {@link GameState}.
	 */
	private Karte getHoverOderLetzteKarte() {
		if (hoverKarte != null)
			return hoverKarte;
		return GameState.getInstance().getLastCard(); // fallback
	}

	/**
	 * Zeichnet die aktuelle Levelanzeige mittig im oberen Bereich des Spielfensters.
	 * <p>
	 * Stellt das aktuelle Level aus dem {@link GameState} in großer, weißer Schrift dar.
	 * Die Anzeige wird zentriert positioniert und nutzt die angepasste Joker-Schriftart.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	private void zeichneLevel(Graphics g) {
		Graphics2D g2d = (Graphics2D) g.create();

		g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(45)));
		g2d.setColor(Color.WHITE);
		String level = String.format("Level: %d", GameState.getInstance().getLevel());

		FontMetrics fm = g2d.getFontMetrics();
		int breite = fm.stringWidth(level);
		int höhe = fm.getHeight();

		int x = (getWidth() - breite) / 2;
		int y = höhe;
		g2d.drawString(level, x, y);

	}

	public void setWeiterButtonListener(WeiterButtonListener listener) {
		this.weiterButtonListener = listener;
	}

	/**
	 * @param gameOverAktiv wird false gesetzt
	 * @param spielGewonnenAktiv wird false gesetzt
	 */
	public void eventsBeenden() {
		gameOverAktiv = false;
		spielGewonnenAktiv = false;
	}

	/**
	 * Prüft, ob aktuell ein Spielende-Event (Game Over oder Spiel gewonnen) aktiv ist.
	 * <p>
	 * Gibt den Status beider Events zur Diagnose auf der Konsole aus und liefert {@code true} zurück, 
	 * wenn mindestens eines der beiden Events aktiv ist.
	 * </p>
	 *
	 * @return {@code true}, wenn Game Over oder Spiel gewonnen aktiv ist, sonst {@code false}.
	 */
	public boolean eventsAmLaufen() {
		StringBuilder sb = new StringBuilder();
		sb.append("GameOverAktiv: ");
		sb.append(gameOverAktiv);
		sb.append(", ");
		sb.append("spielGewonnenAktiv: ");
		sb.append(spielGewonnenAktiv);
		String str = sb.toString();
		System.out.println(str);
		return gameOverAktiv || spielGewonnenAktiv;
	}

	public void setGameOver(boolean gameOver) {
		this.gameOver = gameOver;
	}

}
