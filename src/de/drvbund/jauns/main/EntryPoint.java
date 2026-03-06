package de.drvbund.jauns.main;

import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.UnsupportedLookAndFeelException;

/**
 * Haupteinstiegspunkt der Zündung-Anwendung.
 * 
 * Diese Klasse initialisiert das Spiel im Event Dispatch Thread und
 * konfiguriert das Look-and-Feel für eine bessere Benutzererfahrung.
 */
public class EntryPoint {

    /**
     * Einstiegspunkt des Programms.
     * 
     * Initialisiert das Spiel sicher im EDT, setzt das System-Look-and-Feel
     * und startet das Hauptfenster mit optimaler Konfiguration.
     * 
     * @param args Kommandozeilenargumente (werden derzeit nicht verwendet)
     */
    public static void main(String[] args) {
        System.out.println("Zündung wird gestartet...");
        
        // Look-and-Feel auf System-Standard setzen für bessere Integration
        try {
            String systemLookAndFeel = UIManager.getSystemLookAndFeelClassName();
            UIManager.setLookAndFeel(systemLookAndFeel);
        } catch (ClassNotFoundException | InstantiationException | 
                 IllegalAccessException | UnsupportedLookAndFeelException e) {
            System.err.println("Warnung: Konnte System-Look-and-Feel nicht setzen: " + e.getMessage());
        }
        
        // Anwendung im Event Dispatch Thread starten für Thread-Sicherheit
        SwingUtilities.invokeLater(() -> {
            try {
                initializeGame();
            } catch (Exception e) {
                System.err.println("Kritischer Fehler beim Initialisieren des Spiels: " + e.getMessage());
                e.printStackTrace();
                System.exit(1);
            }
        });
    }
    
    /**
     * Initialisiert das Spiel und das Hauptfenster.
     * Diese Methode wird im EDT ausgeführt.
     */
    private static void initializeGame() {
        System.out.println("Initialisiere Spielkomponenten...");
        
        GamePlay game = new GamePlay();
        GameWindow fenster = new GameWindow(game);
        
        // Bidirektionale Referenz zwischen GamePlay und UI herstellen
        game.setZeichner(fenster.getZeichner());
        
        // Fenster konfigurieren
        fenster.setResizable(false);
        fenster.setLocationRelativeTo(null);
        
        System.out.println("Spiel erfolgreich gestartet");
    }
}
