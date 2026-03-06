package de.drvbund.jauns.main;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;

import javax.swing.JButton;
import javax.swing.JPanel;

public class EscMenü extends JPanel {

	
	
	ArrayList<GameButton> buttons = new ArrayList<GameButton>();
	
	private SpeibeButtonListener speibeButtonListener;
	private EinstellungenButtonListener einstellungenButtonListener;
	
	public EscMenü() {
		setLayout(null);
		setOpaque(false);

        setBackground(new Color(0, 0, 0, 180));
		setBounds(0, 0, 1600, 900); // oder dynamisch setzen
		setVisible(false);

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
			            case "zurück zum Spiel" -> {
			                System.out.println("Test");
			            }
			            
			            case "Speichern und Beenden" -> {
						    if (speibeButtonListener != null) {
						        speibeButtonListener.onSpeibeGedrückt();
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
		
		
	}
		
		
	

	private ArrayList<GameButton> standardMenü() {
		
		int breite = 400;
		int höhe = 50;
		int x = (getWidth() / 2) - (breite / 2);
		int y = (getHeight() / 2) - (höhe / 2);
		
		GameButton speichernButton = new GameButton("Speichern und Beenden", x, y, breite, höhe);
		y -= höhe + 20;
		buttons.add(speichernButton);
		
		GameButton einstellungenButton = new GameButton("Einstellungen", x, y, breite, höhe);
		y -= höhe + 20;
		buttons.add(einstellungenButton);
		
		GameButton zurückButton = new GameButton("zurück zum Spiel", x, y, breite, höhe);
		y -= höhe + 20;
		buttons.add(zurückButton);

		return buttons;
	}
	
	protected void paintComponent(Graphics g) {
		super.paintComponent(g);

		Graphics2D g2d = (Graphics2D) g.create();
		
		g2d.setColor(new Color(0, 0, 0, 100));
		g2d.fillRect(0, 0, getWidth(), getHeight());
		
		zeichneStandardMenü(g2d);
		
	}
	
	
	private void zeichneStandardMenü(Graphics2D g2d) {
		
		
		int breite = 500;
		int höhe = 250;
		int x = (getWidth() / 2) - (breite / 2);
		int y = (getHeight() / 2) - (höhe) + 55;
		
		g2d.setColor(new Color(0, 0, 0, 150));
		
		g2d.fillRoundRect(x,y, breite, höhe, 30, 30);
		
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

	public void toggle() {
		setVisible(!isVisible());
		if (isVisible()) {
			requestFocusInWindow();
		}
	}
	public void setSpeibeButtonListener(SpeibeButtonListener listener) {
		this.speibeButtonListener = listener;
	}
	
	public void setEinstellungenButtonListener(EinstellungenButtonListener einstellungenButtonListener) {
		this.einstellungenButtonListener = einstellungenButtonListener;
	}
	
}
