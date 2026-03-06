package de.drvbund.jauns.main;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.event.ActionEvent;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;

import javax.imageio.ImageIO;
import javax.swing.*;

public class GameWindow extends JFrame {

	private Spiel spiel;
	private Shop shop;
	private HauptMenü hauptmenü;
	private Einstellungen einstellungen;
	
	private int performanceStufe = 0;

	private static boolean shopAktiv = false;

	/**
	 * Konstruktor für das Hauptfenster des Spiels.
	 * <p>
	 * Initialisiert das GameWindow mit Icons, Titel und allen UI-Elementen wie Hauptmenü, Einstellungen, Shop und Spielfeld.
	 * Setzt die Performance-Stufe, fügt ESC-Tastenkürzel für Menüs hinzu und registriert Listener für Fenstergröße, Buttons und Menüaktionen.
	 * Steuert das Wechseln zwischen Spiel, Shop und Hauptmenü und kümmert sich um Musikwechsel sowie das Beenden/Speichern des Spiels.
	 * </p>
	 *
	 * @param gameplay Die GamePlay-Instanz, die das aktuelle Spiel steuert.
	 */
	public GameWindow(GamePlay gameplay) {

		performanceStufe = PerformanceCheck.result();
		
		try (InputStream is = getClass().getResourceAsStream("/misc/png/icon4.png")) {
		    if (is != null) {
		        BufferedImage icon = ImageIO.read(is);
		        setIconImage(icon);
		    } else {
		        System.err.println("icon4.png nicht gefunden!");
		    }
		} catch (IOException e) {
		    e.printStackTrace();
		}


		setTitle("Zündung");
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		einstellungen = new Einstellungen(gameplay);
		EscMenü escMenü = new EscMenü();
		getLayeredPane().add(escMenü, JLayeredPane.POPUP_LAYER);
		getLayeredPane().add(einstellungen, JLayeredPane.POPUP_LAYER);

		getRootPane().getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("ESCAPE"), "toggleEsc");
		getRootPane().getActionMap().put("toggleEsc", new AbstractAction() {
			@Override
			public void actionPerformed(ActionEvent e) {
				if (hauptmenü.getParent() != null && !einstellungen.isShowing()) {
					System.exit(0);
				} else {
					if (einstellungen.isShowing()) {
						einstellungen.toggle();
					} else {

						escMenü.toggle();
					}
				}
			}
		});

		hauptmenü = new HauptMenü(gameplay);
		shop = new Shop(gameplay);
		setSize(800, 600);
		setLocationRelativeTo(null);
		this.spiel = new Spiel(gameplay);
		spiel.setPreferredSize(new Dimension(GamePlay.fensterWidth, GamePlay.fensterHeight));
		add(spiel);
		pack();
		remove(spiel);
		add(hauptmenü);
		addComponentListener(new ComponentAdapter() {
			@Override
			public void componentResized(ComponentEvent e) {
				Dimension newSize = spiel.getSize();
				System.out.println("Neue Fenstergröße: " + newSize.width + "x" + newSize.height);
				GamePlay.fensterWidth = newSize.width;
				GamePlay.fensterHeight = newSize.height;
			}
		});

		setVisible(true);

		hauptmenü.setWeiterButtonListener(() -> {
			// Hier Spiel anzeigen
			spiel.setKartenZumZeichnen();
			gameplay.clearHintergrundmusik();
			gameplay.starteSpielMusik();
			openSpiel(hauptmenü);
		});

		spiel.setWeiterButtonListener(() -> {
			// Hier Shop anzeigen
			shop.newShop();
			gameplay.clearHintergrundmusik();
			gameplay.starteShopMusik();
			openShop();
		});

		shop.setWeiterButtonListener(() -> {
			// Hier Spiel anzeigen
			gameplay.newRound();
			gameplay.clearHintergrundmusik();
			gameplay.starteSpielMusik();
			openSpiel(shop);
		});

		hauptmenü.setSpeibeButtonListener(() -> {
			System.exit(0);
		});

		escMenü.setSpeibeButtonListener(() -> {
			speichernUndBeenden();
		});

		shop.setSpeibeButtonListener(() -> {
			speichernUndBeenden();
		});

		escMenü.setEinstellungenButtonListener(() -> {
			escMenü.toggle();
			einstellungen.toggle();
		});

		hauptmenü.setEinstellungenButtonListener(() -> {
			einstellungen.toggle();
		});
	}

	private void openShop() {
		übergangsAnimationAusführen(spiel, shop);
	}

	private void openSpiel(JPanel panel) {
		übergangsAnimationAusführen(panel, spiel);
	}

	public Spiel getZeichner() {
		return spiel;
	}

	public static boolean isShopAktiv() {
		return shopAktiv;
	}

	public static void setShopAktiv(boolean shopTriggerBoolean) {
		GameWindow.shopAktiv = shopTriggerBoolean;
	}

	/**
	 * Speichert den aktuellen Spielstand und beendet das Programm.
	 * <p>
	 * Ruft die Methode zum Speichern des {@link GameState} als XML-Datei auf und beendet anschließend die Anwendung.
	 * </p>
	 */
	private void speichernUndBeenden() {
		GameState.getInstance().saveToXml(GamePlay.getSavePath());
		System.exit(0);
	}

	/**
	 * Führt die passende Übergangsanimation zwischen zwei {@link JPanel}s entsprechend der Performance-Stufe aus.
	 * <p>
	 * Je nach Wert von {@code performanceStufe} wird entweder ein Crossfade, eine Vorhang-Animation oder ein sofortiger Wechsel der Panels durchgeführt.
	 * </p>
	 *
	 * @param fromPanel Das aktuelle (auszublendende) Panel.
	 * @param toPanel   Das Ziel-Panel, das angezeigt werden soll.
	 */
	private void übergangsAnimationAusführen(JPanel fromPanel, JPanel toPanel) {
		if(performanceStufe >= 2) {
			crossfadePanels(fromPanel, toPanel);
		} else if (performanceStufe == 1) {
			vorhangAnimation(fromPanel, toPanel);
		} else {
			remove(fromPanel);
			add(toPanel);
		}
	}
	
	/**
	 * Führt eine Vorhang-Animation zwischen zwei {@link JPanel}s aus.
	 * <p>
	 * Überblendet das Ausgangspanel zunächst mit einem schwarzen Vorhang von oben nach unten, ersetzt dann das Panel und zieht anschließend den Vorhang wieder nach oben weg.
	 * Die Animation wird mit zwei Timern realisiert: einem für das Herunterziehen (Fade-Out), einem für das Hochziehen (Fade-In) des Vorhangs.
	 * Der Overlay-Screenshot wird am Ende zur Ressourcenschonung freigegeben.
	 * </p>
	 *
	 * @param fromPanel Das Panel, das ausgeblendet wird.
	 * @param toPanel   Das Panel, das eingeblendet wird.
	 */
	public void vorhangAnimation(JPanel fromPanel, JPanel toPanel) {
	    int width = getContentPane().getWidth();
	    int height = getContentPane().getHeight();

	    BufferedImage screenshot = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
	    fromPanel.paint(screenshot.getGraphics());

	    final int[] blackHeight = {0};
	    final int step = Math.max(1, height / 10);

	    // Bild als Feld im Overlay!
	    JComponent overlay = new JComponent() {
	        BufferedImage img = screenshot;
	        @Override
	        protected void paintComponent(Graphics g) {
	            if (img != null)
	                g.drawImage(img, 0, 0, width, height, null);
	            g.setColor(Color.BLACK);
	            g.fillRect(0, 0, width, blackHeight[0]);
	        }
	        // Bild-Freigabe
	        public void clearImg() {
	            if (img != null) img.flush();
	            img = null;
	        }
	    };
	    overlay.setBounds(0, 0, width, height);
	    getLayeredPane().add(overlay, JLayeredPane.DRAG_LAYER);

	    Timer fadeOut = new Timer(20, null);
	    fadeOut.addActionListener(e -> {
	        blackHeight[0] += step;
	        if (blackHeight[0] >= height) {
	            blackHeight[0] = height;
	            fadeOut.stop();

	            // Panelwechsel
	            getContentPane().remove(fromPanel);
	            getContentPane().add(toPanel);
	            getContentPane().revalidate();
	            getContentPane().repaint();

	            // Hier: Overlay-Screenshot freigeben!
	            ((JComponent)overlay).repaint(); // zur Sicherheit
	            // Bild im Overlay freigeben:
	            try {
	                overlay.getClass().getMethod("clearImg").invoke(overlay);
	            } catch (Exception ex) { ex.printStackTrace(); }

	            // Fade-In (Vorhang wieder hoch)
	            Timer fadeIn = new Timer(32, null);
	            fadeIn.addActionListener(ev -> {
	                blackHeight[0] -= step;
	                if (blackHeight[0] <= 0) {
	                    blackHeight[0] = 0;
	                    fadeIn.stop();
	                    getLayeredPane().remove(overlay);
	                }
	                overlay.repaint();
	            });
	            fadeIn.start();
	        }
	        overlay.repaint();
	    });
	    fadeOut.start();
	}


	/**
	 * Führt einen Crossfade-Übergang zwischen zwei {@link JPanel}s aus.
	 * <p>
	 * Erzeugt von beiden Panels Screenshots als {@link BufferedImage} und legt sie übereinander.
	 * Ein animiertes Overlay-Panel blendet das Zielpanel durch allmähliches Erhöhen der Transparenz ein (Crossfade).
	 * Am Ende der Animation wird das alte Panel entfernt, das neue Panel hinzugefügt und das Overlay gelöscht.
	 * </p>
	 *
	 * @param fromPanel Das Ausgangspanel, das ausgeblendet wird.
	 * @param toPanel   Das Zielpanel, das eingeblendet wird.
	 */
	public void crossfadePanels(JPanel fromPanel, JPanel toPanel) {
	    int width = getContentPane().getWidth();
	    int height = getContentPane().getHeight();

	    // Panel als Screenshot
	    BufferedImage fromImg = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
	    fromPanel.paint(fromImg.getGraphics());

	    // Zielpanel auf richtige Größe bringen, falls nötig
	    toPanel.setSize(width, height);
	    toPanel.doLayout();

	    BufferedImage toImg = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
	    toPanel.paint(toImg.getGraphics());

	    // Overlay Panel für den Fade
	    JComponent overlay = new JComponent() {
	        float alpha = 0f;
	        @Override
	        protected void paintComponent(Graphics g) {
	            Graphics2D g2d = (Graphics2D) g.create();
	            g2d.drawImage(fromImg, 0, 0, null);
	            g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, alpha));
	            g2d.drawImage(toImg, 0, 0, null);
	            g2d.dispose();
	        }
	    };
	    overlay.setBounds(0, 0, width, height);
	    getLayeredPane().add(overlay, JLayeredPane.DRAG_LAYER);

	    // Animation Timer
	    Timer timer = new Timer(16, null); // ~60 FPS
	    timer.addActionListener(e -> {
	        overlay.repaint();
	        ((JComponent) overlay).repaint();
	        ((JComponent) overlay).putClientProperty("alpha", ((JComponent) overlay).getClientProperty("alpha"));
	        try {
	            java.lang.reflect.Field alphaField = overlay.getClass().getDeclaredField("alpha");
	            alphaField.setAccessible(true);
	            float alpha = alphaField.getFloat(overlay) + 0.12f; //Schnelligkeit
	            if (alpha >= 1f) {
	                alpha = 1f;
	                timer.stop();
	                getContentPane().remove(fromPanel);
	                getContentPane().add(toPanel);
	                getLayeredPane().remove(overlay);
	                revalidate();
	                repaint();
	            }
	            alphaField.setFloat(overlay, alpha);
	        } catch (Exception ex) {
	            ex.printStackTrace();
	        }
	    });
	    timer.start();
	}

	
}
