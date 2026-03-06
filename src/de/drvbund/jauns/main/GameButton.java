package de.drvbund.jauns.main;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.io.InputStream;

public class GameButton {

	private Rectangle bounds;
	private String text;
	private boolean aktiv = true;
	private Font font;
	private Color color = Color.DARK_GRAY;

	/**
	 * Zeichnet den Button auf die übergebene Graphics2D-Oberfläche.
	 * Zeichnet nur, wenn der Button aktiv ist.
	 * Zeichnet Hintergrund, Rahmen und zentrierten Text mit der definierten Schriftart.
	 *
	 * @param g2d Die Graphics2D-Instanz, auf die gezeichnet wird.
	 */
	public GameButton(String text, int x, int y, int breite, int höhe) {

		this.text = text;
		this.bounds = new Rectangle(x, y, breite, höhe);
			try (InputStream is = getClass().getResourceAsStream("/misc/fonts/jqkas.ttf")) {
				if (is != null) {
					font = Font.createFont(Font.TRUETYPE_FONT, is).deriveFont(28f);
					GraphicsEnvironment.getLocalGraphicsEnvironment().registerFont(font);
				} else {
					System.err.println("Font jqkas.ttf nicht gefunden!");
					font = new Font("Arial", Font.PLAIN, 28);
				}
			} catch (Exception e) {
				e.printStackTrace();
				font = new Font("Arial", Font.PLAIN, 28);
			}
		}
	

	/**
	 * Zeichnet den Button auf die übergebene Graphics2D-Oberfläche.
	 * Zeichnet nur, wenn der Button aktiv ist.
	 * Zeichnet Hintergrund, Rahmen und zentrierten Text mit der definierten Schriftart.
	 *
	 * @param g2d Die Graphics2D-Instanz, auf die gezeichnet wird.
	 */
	public void draw(Graphics2D g2d) { // Joker-Font
		if (!aktiv)
			return;
		// Button-Hintergrund
		g2d.setColor(color);
		g2d.fillRoundRect(bounds.x, bounds.y, bounds.width, bounds.height, 20, 20);

		// Button-Rand
		g2d.setColor(Color.WHITE);
		g2d.setStroke(new BasicStroke(2));
		g2d.drawRoundRect(bounds.x, bounds.y, bounds.width, bounds.height, 20, 20);

		// Text
		g2d.setFont(font);
		FontMetrics fm = g2d.getFontMetrics();
		int textX = bounds.x + (bounds.width - fm.stringWidth(text)) / 2;
		int textY = bounds.y + (bounds.height + fm.getAscent()) / 2 - 5;
		
		g2d.drawString(text, textX, textY);
	}

	public boolean contains(Point p) {
		return bounds.contains(p);
	}

	public String getText() {
		return text;
	}

	public Rectangle getBounds() {
		return bounds;
	}

	public void setText(String text) {
		this.text = text;
	}

	public void setAktiv(boolean aktiv) {
		this.aktiv = aktiv;
	}

	public boolean isAktiv() {
		return aktiv;
	}



	public Color getColor() {
		return color;
	}



	public void setColor(Color color) {
		this.color = color;
	}



}
