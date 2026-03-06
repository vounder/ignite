package de.drvbund.jauns.main;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;

import javax.swing.JPanel;

public class Einstellungen extends JPanel{
	
	/**
	 * Konstruktor für das Einstellungs-Panel.
	 * 
	 * Setzt das Layout auf null für manuelle Positionierung,
	 * macht das Panel transparent (Opaque=false),
	 * setzt einen halbtransparenten schwarzen Hintergrund,
	 * legt die Größe fest und macht das Panel zunächst unsichtbar.
	 * 
	 * @param gameplay Referenz auf das Spiel-Objekt (zur späteren Verwendung)
	 */
	public Einstellungen(GamePlay gameplay) {
		setLayout(null);
		setOpaque(false);

        setBackground(new Color(0, 0, 0, 180));
		setBounds(0, 0, 1600, 900); // oder dynamisch setzen
		setVisible(false);
	}
	
	/**
	 * Überschreibt die paintComponent-Methode, um den halbtransparenten
	 * schwarzen Hintergrund zu zeichnen und das Einstellungsmenü zu rendern.
	 *
	 * @param g Der Grafik-Kontext zum Zeichnen.
	 */
	protected void paintComponent(Graphics g) {
		super.paintComponent(g);
		
		Graphics2D g2d = (Graphics2D) g.create();
		
		g2d.setColor(new Color(0, 0, 0, 150));
		g2d.fillRect(0, 0, getWidth(), getHeight());
		
		zeichneEinstellungMenü(g2d);
		
	}

	/**
	 * Zeichnet das Einstellungsmenü mit halbtransparentem Hintergrund
	 * und ruft das Lautstärke-Menü mit 100% Lautstärke auf.
	 *
	 * @param g2d Grafik-Kontext zum Zeichnen
	 */
	private void zeichneEinstellungMenü(Graphics2D g2d) {
	
		int breite = getWidth() - (getWidth() / 5);
		int höhe = getHeight() - (getHeight() / 10);
		int x = (getWidth() / 2) - (breite / 2);
		int y = (getHeight() / 2) - (höhe) + (getWidth() / 9);
		
		y += 55;
		
		g2d.setColor(new Color(0, 0, 0, 50));
		
		g2d.fillRoundRect(x,y, breite, höhe, 30, 30);
		
		// In paintComponent aufrufen, z.B.:
		zeichneLautstaerkeMenue(g2d, 100);

	}
	
	/**
	 * Zeichnet das Lautstärke-Menü mit Prozentanzeige und Plus/Minus-Buttons.
	 * 
	 * @param g2d    Grafik-Kontext zum Zeichnen
	 * @param percent Aktueller Lautstärke-Prozentsatz (0-100)
	 */
	private void zeichneLautstaerkeMenue(Graphics2D g2d, int percent) {
	    // Menü-Hintergrund
	    int boxWidth = 400;
	    int boxHeight = 120;
	    int x = (getWidth() - boxWidth) / 2;
	    int y = (getHeight() - boxHeight) / 2 + 80;

	    // Hauptbox
	    g2d.setColor(new Color(20, 20, 20, 200));
	    g2d.fillRoundRect(x, y, boxWidth, boxHeight, 32, 32);

	    // Lautstärke-Text
	    g2d.setFont(getFont().deriveFont(Font.BOLD, 28f));
	    g2d.setColor(Color.WHITE);
	    String text = "Lautstärke: " + percent + " %";
	    int textWidth = g2d.getFontMetrics().stringWidth(text);
	    g2d.drawString(text, x + (boxWidth - textWidth) / 2, y + 50);

	    // Buttons zeichnen
	    int buttonWidth = 50;
	    int buttonHeight = 50;
	    int buttonY = y + boxHeight - buttonHeight - 20;
	    int abstand = 50;

	    // Leiser-Button (-)
	    int leiserX = x + boxWidth / 2 - buttonWidth - abstand / 2;
	    g2d.setColor(new Color(60, 60, 60, 230));
	    g2d.fillRoundRect(leiserX, buttonY, buttonWidth, buttonHeight, 20, 20);
	    g2d.setColor(Color.WHITE);
	    g2d.setFont(getFont().deriveFont(Font.BOLD, 36f));
	    g2d.drawString("-", leiserX + 17, buttonY + 37);

	    // Lauter-Button (+)
	    int lauterX = x + boxWidth / 2 + abstand / 2;
	    g2d.setColor(new Color(60, 60, 60, 230));
	    g2d.fillRoundRect(lauterX, buttonY, buttonWidth, buttonHeight, 20, 20);
	    g2d.setColor(Color.WHITE);
	    g2d.setFont(getFont().deriveFont(Font.BOLD, 36f));
	    g2d.drawString("+", lauterX + 13, buttonY + 38);

	    // Optional: Speichere dir die Button-Rects, damit du bei MouseEvents weißt, wo geklickt wurde
	    // leiserButtonRect = new Rectangle(leiserX, buttonY, buttonWidth, buttonHeight);
	    // lauterButtonRect = new Rectangle(lauterX, buttonY, buttonWidth, buttonHeight);
	}

	/**
	 * Wandelt einen Lautstärkeprozentsatz (0-100) in Dezibel um.
	 * 0% entspricht MIN_DB (-80 dB, sehr leise),
	 * 100% entspricht MAX_DB (0 dB, maximale Lautstärke).
	 *
	 * @param percent Lautstärke in Prozent
	 * @return Lautstärke in Dezibel
	 */
	private float percentToDb(int percent) {
	    float MIN_DB = -80.0f;
	    float MAX_DB = 0.0f;
	    return MIN_DB + (MAX_DB - MIN_DB) * (percent / 100f);
	}

	/**
	 * Schaltet die Sichtbarkeit des Panels um.
	 * Wenn das Panel sichtbar wird, wird der Fokus auf dieses Panel gesetzt.
	 */
	public void toggle() {
		setVisible(!isVisible());
		if (isVisible()) {
			requestFocusInWindow();
		}
	}
	
}
