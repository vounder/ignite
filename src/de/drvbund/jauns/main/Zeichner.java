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
import java.io.StringWriter;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import javax.imageio.ImageIO;

public class Zeichner extends JPanel {

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

	private Rectangle deckKartenBereich = new Rectangle();

	private double kreisRotationSpieler = 0;
	private double kreisRotationGegner = 0;

	private double score = GameState.getInstance().getScore();
	private double tmpScore = 1;
	private double mult = 0.01;

	private WeiterButtonListener weiterButtonListener;

	// Konstruktor
	public Zeichner(GamePlay gameplay) {
		setDoubleBuffered(true);
		this.gameplay = gameplay;
		gameplay.starteSpielMusik();

		RessourceLoader.getInstance().addHintergrundbild("/de/drvbund/jauns/assets/misc/png/background.png");
		RessourceLoader.getInstance().addHintergrundbild("/de/drvbund/jauns/assets/misc/png/background4.png");

		// Kreis in den ReLad
		Path kreisPfad = Paths.get("src", "de", "drvbund", "jauns", "assets", "misc", "png", "kreis.png");
		BufferedImage kreis = null;
		try {
			kreis = ImageIO.read(kreisPfad.toFile());
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
						ziehendeKarte = GameState.getInstance().getSpieler().getHand().getFirst();
						ziehStart = new Point(deckKartenBereich.x, deckKartenBereich.y);
						ziehZiel = new Point(letzteKartenPosition.x, letzteKartenPosition.y);
						ziehStartZeit = System.currentTimeMillis();

						nachZiehen = () -> {
							GameState.getInstance().getSpieler().karteZiehen(1);
							gameplay.toggleSpielerZug();
						};

					}
					return;
				}

				if (gameOverAktiv && gameOverButton.contains(klick)) {
					gameOverAktiv = false;
					gameplay.newRun(); // Spiel neu starten
					setKartenZumZeichnen();

					return;
				}

				if (spielGewonnenAktiv && weiterButton.contains(klick)) {
					if (weiterButtonListener != null) {
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

	// Paint
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

	// Animationen
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
			}
			animierteKarte = null;
		} else {

		}
	}

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

	// Restliche Methoden

	private Point berechneStapelMittelpunkt() {
		Dimension kartenGroesse = new Dimension(GamePlay.skalieren(400), GamePlay.skalieren(400));

		int drawX = GamePlay.skalieren((getWidth() / 2) - (kartenGroesse.width / 2) + 100);
		int drawY = GamePlay.skalieren((getHeight() / 2) - kartenGroesse.height + 160);

		// Jetzt Mittelpunkt berechnen:
		int centerX = drawX + kartenGroesse.width / 2;
		int centerY = drawY + kartenGroesse.height / 2;

		return new Point(centerX, centerY);
	}

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

	private void zeichnePlatzhalter(Graphics g, int x, int y, String text, Dimension groesse) {
		g.setColor(Color.LIGHT_GRAY);
		g.fillRect(x, y, GamePlay.skalieren(groesse.width), GamePlay.skalieren(groesse.height));
		g.setColor(Color.BLACK);
		g.drawRect(x, y, GamePlay.skalieren(groesse.width), GamePlay.skalieren(groesse.height));
		g.drawString(text, x + GamePlay.skalieren(10), y + GamePlay.skalieren(75));
	}

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
	}

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

	private void handleKartenKlick(Point klick) {
		ArrayList<Point> positionen = getKartenPositionen();
		Dimension standard = new Dimension(GamePlay.skalieren(150), GamePlay.skalieren(180));

		Spieler spieler = GameState.getInstance().getSpieler();

		if (spieler.getAussetzRunden() > 0) {
			spieler.setAussetzRunden(spieler.getAussetzRunden() - 1);
			System.out.println("Spieler muss aussetzen.");
			gameplay.toggleSpielerZug();
			return;
		}

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

						// Entferne Karte aus der Hand
						GameState.getInstance().getSpieler().getHand().remove(i);

						// Was nach der Animation passieren soll
						nachAnimation = () -> {
							System.out.println("Spieler legt Karte: " + karte);
							GameState.getInstance().setLastCard(karte);
							gameplay.kartenAction(karte);
							gameplay.scoreBerechnen(karte);
							gameplay.toggleSpielerZug();
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

	private int wechsel = 30;

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
			if ((wechsel / 30) % 2 == 0) {
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

	long letzteZeit = System.nanoTime();

	void updateUndZeichne() {
		long aktuelleZeit = System.nanoTime();
		letzteZeit = aktuelleZeit;
	}

	private boolean spielIstVerloren() {
		return GameState.getInstance().getGegner().getHand().isEmpty()
				|| GameState.getInstance().getSpieler().getDeck().isEmpty() || GameState.getInstance().getScore() < 0;
	}

	private boolean spielIstGewonnen() {
		if (GameState.getInstance().getSpieler().getHand().isEmpty()
				|| GameState.getInstance().getGegner().getDeck().isEmpty()) {
			score = GameState.getInstance().getScore();
		}
		return GameState.getInstance().getSpieler().getHand().isEmpty()
				|| GameState.getInstance().getGegner().getDeck().isEmpty();
	}

	private int wartezeitScoreGewonnenAnzeige = 0;

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

		// Score-Anzeige

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

					if (diff < 1) { // nicht 10, das sieht zu grob aus
						tmpScore = score;
					}
				}
			}
		}

		String scoreText = "Dein Score: ";
		String scoreAnzahlText = (tmpScore == score) ? String.valueOf((int) score) : String.format("%.0f", tmpScore);

		// Schriftarten
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

		// "Weiter"-Button
		int btnW = GamePlay.skalieren(300);
		int btnH = GamePlay.skalieren(80);
		int btnX = (getWidth() - btnW) / 2;
		int btnY = scoreY + GamePlay.skalieren(100);
		weiterButton.setBounds(btnX, btnY, btnW, btnH);

		// Button zeichnen
		if (tmpScore == score) {
			g2d.setColor(Color.DARK_GRAY);
			g2d.fillRoundRect(btnX, btnY, btnW, btnH, 20, 20);
			g2d.setColor(Color.WHITE);
			g2d.setFont(new Font("Arial", Font.BOLD, GamePlay.skalieren(30)));
			String buttonText = "Weiter";
			int btx = btnX + (btnW - g2d.getFontMetrics().stringWidth(buttonText)) / 2;
			int bty = btnY + (btnH + g2d.getFontMetrics().getAscent()) / 2 - 5;
			g2d.drawString(buttonText, btx, bty);
		}

		g2d.dispose();
	}

	public void animationGegnerTrigger(Karte karte) {
		animierteKarte = karte;

		// Startposition oben rechts
		start = new Point(getWidth() - GamePlay.skalieren(320), GamePlay.skalieren(10));
		ziel = berechneStapelMittelpunkt();
		animationsStart = System.currentTimeMillis();

		nachAnimation = () -> {
			GameState.getInstance().setLastCard(karte);
			gameplay.toggleSpielerZug();
			System.out.println("Gegner spielt: " + karte.toString());

		};

	}

	public boolean animiertGerade() {
		return animierteKarte != null;
	}

	// Später wichtig, wenn Shop kommt
	public void checkGameOver(Graphics g) {

		if (spielIstVerloren()) {
			gameOverAktiv = true;
			zeigeGameOverScreen(g);
		} else if (spielIstGewonnen()) {
			spielGewonnenAktiv = true;
			zeigeGewonnenScreen(g);
		} else {
			return;
		}

	}

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
			g2d.setFont(gameplay.jokerFont.deriveFont((float) GamePlay.skalieren(38)));
			drawWrappedText(g2d, karte.getBeschreibung(), x + zeilenAbstand / 2, y + GamePlay.skalieren(150),
					boxBreite - abstand, GamePlay.skalieren(40));
		}

		g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);

		g2d.dispose();
	}

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

	private Karte getHoverOderLetzteKarte() {
		if (hoverKarte != null)
			return hoverKarte;
		return GameState.getInstance().getLastCard(); // fallback
	}

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

	public void eventsBeenden() {
		gameOverAktiv = false;
		spielGewonnenAktiv = false;
	}

	public boolean eventsAmLaufen() {
		return gameOverAktiv || spielGewonnenAktiv;
	}

}
