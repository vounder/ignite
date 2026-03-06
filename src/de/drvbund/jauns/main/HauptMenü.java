package de.drvbund.jauns.main;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;

import javax.imageio.ImageIO;
import javax.swing.JPanel;
import javax.swing.Timer;

public class HauptMenü extends JPanel {

	ArrayList<GameButton> buttons = new ArrayList<GameButton>();

	private WeiterButtonListener weiterButtonListener;
	private SpeibeButtonListener speibeButtonListener;
	private EinstellungenButtonListener einstellungenButtonListener;

	Image background = null;

	Image schrift = null;
	Image logo = null;
	
	private int yOffsetSchnell = 0;
	private int yOffsetSchnellDir = 1; // 1 = runter, -1 = hoch
	
	private Timer timer; 

	private int counterAnimation = 0;
	private int performanceStufe = 0;

	
	/**
	 * Erstellt das Hauptmenü, lädt die benötigten Ressourcen und initialisiert die Standard-Menübuttons.
	 * <p>
	 * Richtet das Hintergrundbild, das Logo und den Schriftzug ein, skaliert sie passend und 
	 * startet einen Timer zur regelmäßigen Aktualisierung der Darstellung. Registriert Maus-Listener für Button-Interaktion.
	 * </p>
	 *
	 * @param gameplay Die GamePlay-Instanz, die dem Hauptmenü zugeordnet ist.
	 */
	public HauptMenü(GamePlay gameplay) {
		
		performanceBestimmen();
		

		try (InputStream is = getClass().getResourceAsStream("/misc/png/mainBackground.png")) {
		    if (is != null) {
		        background = ImageIO.read(is);
		    } else {
		        System.err.println("mainBackground.png nicht gefunden!");
		    }
		} catch (IOException e) {
		    e.printStackTrace();
		}

		try (InputStream is = getClass().getResourceAsStream("/misc/png/schrift.png")) {
		    if (is != null) {
		        schrift = ImageIO.read(is);
		    } else {
		        System.err.println("schrift.png nicht gefunden!");
		    }
		} catch (IOException e) {
		    e.printStackTrace();
		}

		try (InputStream is = getClass().getResourceAsStream("/misc/png/logo.png")) {
		    if (is != null) {
		        logo = ImageIO.read(is);
		    } else {
		        System.err.println("logo.png nicht gefunden!");
		    }
		} catch (IOException e) {
		    e.printStackTrace();
		}

		if (logo != null)
		    logo = logo.getScaledInstance(800, 450, Image.SCALE_SMOOTH);
		if (schrift != null)
		    schrift = schrift.getScaledInstance(800, 450, Image.SCALE_SMOOTH);

        
		setBounds(0, 0, 1600, 900); // oder dynamisch setzen
		setVisible(true);

	    
	    timer = new Timer(16, e -> {
	    	repaint();
	    });
	    
		
		timer.start();
		
		buttons = standardMenü();
	
		//Klick-Events
		addMouseListener(new MouseAdapter() {
			@Override
		public void mouseClicked(MouseEvent e) {
			Point klick = e.getPoint();
			
			for (GameButton button : buttons) {
			    if (button.contains(klick)) {
			        String buttonText = button.getText();

			        switch (buttonText) {
			            case "Neues Spiel" -> {
						    if (weiterButtonListener != null) {
						    	gameplay.newRun();
						        weiterButtonListener.onWeiterGedrückt();
						        timer.stop();
						    }
			            }
			            
			            case "Speichern und Beenden" -> {
						    if (speibeButtonListener != null) {
						        speibeButtonListener.onSpeibeGedrückt();
						    }
			            }
			            
			            case "Laden" -> {
						    if (weiterButtonListener != null) {
						    	gameplay.play();
						        weiterButtonListener.onWeiterGedrückt();
						        timer.stop();
						    }
			            }
			            
			            case "Einstellungen" -> {
			            	if(einstellungenButtonListener != null) {
			            		einstellungenButtonListener.onEinstellungenGedrückt();
			            	}
			            }
			            
			            default -> {
			                System.out.println("Unbekannter Button.");
			            }
			        }
			    }
			}
			
			
			
			}
			});
	    
		addMouseMotionListener(new MouseMotionAdapter() {
			@Override
			public void mouseMoved(MouseEvent e) {
				Point hoverPoint = e.getPoint();
				for(GameButton button : buttons) {
					if (button.contains(hoverPoint)) {
						button.setColor(Color.gray);
					} else {
						button.setColor(Color.DARK_GRAY);
					}
				}
				
			}
		});
		
	}

	/**
	 * Erstellt die Standard-Menübuttons und positioniert sie vertikal zentriert im Fenster.
	 * <p>
	 * Fügt Buttons für „Speichern und Beenden“, „Einstellungen“, „Laden“ und „Neues Spiel“ zur Liste hinzu und gibt diese zurück.
	 * </p>
	 *
	 * @return Die Liste der im Menü angezeigten {@link GameButton}-Objekte.
	 */
	private ArrayList<GameButton> standardMenü() {

		int breite = 400;
		int höhe = 50;
		int x = (getWidth() / 2) - (breite / 2);
		int y = (getHeight() / 2) - (höhe / 2) + (getWidth() / 9);

		GameButton speichernButton = new GameButton("Speichern und Beenden", x, y, breite, höhe);
		y -= höhe + 20;
		buttons.add(speichernButton);

		GameButton einstellungenButton = new GameButton("Einstellungen", x, y, breite, höhe);
		y -= höhe + 20;
		buttons.add(einstellungenButton);
		
		GameButton spielLadenButton = new GameButton("Laden", x, y, breite, höhe);
		y -= höhe + 20;
		buttons.add(spielLadenButton);

		GameButton neuesSpielButton = new GameButton("Neues Spiel", x, y, breite, höhe);
		y -= höhe + 20;
		buttons.add(neuesSpielButton);
		
		

		return buttons;
	}

	/**
	 * Überschreibt das Paint-Verhalten und zeichnet den Menü-Hintergrund, das Standard-Menü sowie das Logo mit Schriftzug.
	 * <p>
	 * Setzt einen halbtransparenten Hintergrund und ruft die Methoden zum Zeichnen der Menüs und des Logos auf.
	 * </p>
	 *
	 * @param g Das {@link Graphics}-Objekt zum Zeichnen.
	 */
	protected void paintComponent(Graphics g) {
		super.paintComponent(g);

		Graphics2D g2d = (Graphics2D) g.create();

		g2d.setColor(new Color(0, 0, 0, 100));
		g2d.drawImage(background, 0, 0, getWidth(), getHeight(), null);

		zeichneStandardMenü(g2d);
		zeichneLogoUndSchrift(g2d);

	}

	/**
	 * Zeichnet das Standard-Menü mit halbtransparentem Hintergrund und allen enthaltenen Buttons.
	 * <p>
	 * Zentriert das Menü im Fenster, wendet hochwertige Rendering-Optionen an und zeichnet alle GameButton-Elemente.
	 * </p>
	 *
	 * @param g2d Das {@link Graphics2D}-Objekt zum Zeichnen.
	 */
	private void zeichneStandardMenü(Graphics2D g2d) {

		int breite = 450;
		int höhe = 320;
		int x = (getWidth() / 2) - (breite / 2);
		int y = (getHeight() / 2) - (höhe) + (getWidth() / 9);

		y += 55;

		g2d.setColor(new Color(0, 0, 0, 150));

		g2d.fillRoundRect(x, y, breite, höhe, 30, 30);
		g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
		for (GameButton button : buttons) {
			button.draw(g2d);
		}
		g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_OFF);
		g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);
	}

	public void setWeiterButtonListener(WeiterButtonListener listener) {
		this.weiterButtonListener = listener;
	}

	public void setSpeibeButtonListener(SpeibeButtonListener listener) {
		this.speibeButtonListener = listener;
	}

	public void setEinstellungenButtonListener(EinstellungenButtonListener einstellungenButtonListener) {
		this.einstellungenButtonListener = einstellungenButtonListener;
	}

	/**
	 * Zeichnet das Logo und den Schriftzug mit einer schönen, sanften Sinus-Animation im Hauptmenü.
	 * <p>
	 * Positioniert das Logo zentriert und lässt den Schriftzug weich nach oben und unten „schweben“ 
	 * für einen hochwertigen, flüssigen Animationseffekt.
	 * </p>
	 *
	 * @param g2d Das {@link Graphics2D}-Objekt zum Zeichnen.
	 */
	private void zeichneLogoUndSchriftSchön(Graphics2D g2d) {
	    int breite = 800;
	    int höhe = 450;
	    int x = (getWidth() / 2) - (breite / 2) + 25;
	    int y = (getHeight() / 2) - (höhe) - (getWidth() / 40);

	    g2d.drawImage(logo, x, y, breite, höhe, null);

	    // Animation
	    counterAnimation++;
	    double speed = 0.05;  // Kannste feintunen
	    int amplitude = 15;   
	    int yOffset = (int) (Math.sin(counterAnimation * speed) * amplitude);

	    g2d.drawImage(schrift, x, y + 45 + yOffset, breite, höhe, null);
	}

	/**
	 * Bestimmt die aktuelle Performance des Systems anhand eines Benchmarks und setzt die Animationsstufe entsprechend.
	 * <p>
	 * Führt einen kurzen Sinus-Benchmark durch und weist der Variable {@code performanceStufe} einen Wert zu, 
	 * der die Animationsqualität (0=aus, 3=voll) steuert. Gibt das Ergebnis als Text auf der Konsole aus.
	 * </p>
	 */
	private void performanceBestimmen() {
		double result = PerformanceCheck.benchmarkSinus();
		if(result < 300) {
			System.out.println("Ultra Performance! Animationen voll an.");
			performanceStufe = 3;
		} else if (result < 700) {
			System.out.println("High Performance! Animationen auf hoch.");
			performanceStufe = 2;
		} else if (result < 1500) {
			System.out.println("Mittlere Performance. Animationen auf Mittel.");
			performanceStufe = 1;
		} else {
			System.out.println("Low Performance! Animationen minimal, Effekte aus.");
			performanceStufe = 0;
		}
	}
	
	/**
	 * Zeichnet das Spiel-Logo und den Schriftzug im Hauptmenü – abhängig von der Performance-Stufe.
	 * <p>
	 * Wählt zwischen einer aufwändigeren Animation, einer schnelleren vereinfachten Animation oder der statischen Darstellung
	 * von Logo und Schriftzug. Die Position ist stets zentriert am oberen Bildschirmrand.
	 * </p>
	 *
	 * @param g2d Das {@link Graphics2D}-Objekt zum Zeichnen.
	 */
	private void zeichneLogoUndSchrift(Graphics2D g2d) {
		int breite = 800;
		int höhe = 450;
		int x = (getWidth() / 2) - (breite / 2) + 25;
		int y = (getHeight() / 2) - (höhe) - (getWidth() / 40);

		if (performanceStufe >= 2) {
			zeichneLogoUndSchriftSchön(g2d);
		} else if (performanceStufe == 1) {
			zeichneLogoUndSchriftSchnell(g2d);
		} else {
			g2d.drawImage(logo, x, y, breite, höhe, null);
			g2d.drawImage(schrift, x, y + 30, breite, höhe, null);
		}
	}

	/**
	 * Zeichnet das Logo und den Schriftzug mit schneller, einfacher Offset-Animation im Hauptmenü.
	 * <p>
	 * Positioniert das Logo zentriert und animiert den Schriftzug vertikal mit einem einfachen Up-Down-Offset für einen „wippenden“ Effekt.
	 * </p>
	 *
	 * @param g2d Das {@link Graphics2D}-Objekt zum Zeichnen.
	 */
	private void zeichneLogoUndSchriftSchnell(Graphics2D g2d) {
	    int breite = 800;
	    int höhe = 450;
	    int x = (getWidth() / 2) - (breite / 2) + 25;
	    int y = (getHeight() / 2) - (höhe) - (getWidth() / 40);

	    g2d.drawImage(logo, x, y, breite, höhe, null);

	    // Offset berechnen
	    yOffsetSchnell += yOffsetSchnellDir;
	    if (yOffsetSchnell >= 20) yOffsetSchnellDir = -1;
	    if (yOffsetSchnell <= 0) yOffsetSchnellDir = 1;

	    g2d.drawImage(schrift, x, y + 30 + yOffsetSchnell, breite, höhe, null);
	}


}
