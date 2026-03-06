package de.drvbund.jauns.main;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

import javax.imageio.ImageIO;

/**
 * Optimierter Singleton-Ressourcenloader mit Caching und Thread-Sicherheit.
 * 
 * Diese Klasse verwaltet alle Bildressourcen der Anwendung effizient durch:
 * - Lazy Loading (Bilder werden nur bei Bedarf geladen)
 * - Caching (einmal geladene Bilder werden wiederverwendet)
 * - Thread-Sicherheit durch ConcurrentHashMap
 * - Bessere Fehlerbehandlung und Logging
 */
public class RessourceLoader {

    private static volatile RessourceLoader instance;
    
    // Thread-sichere Maps für verschiedene Bildtypen
    private final Map<String, BufferedImage> imageCache = new ConcurrentHashMap<>();
    private final Map<Integer, String> bildListePaths = new ConcurrentHashMap<>();
    private final Map<Integer, String> hintergrundBildListePaths = new ConcurrentHashMap<>();
    private final Map<Integer, String> manfredBildListePaths = new ConcurrentHashMap<>();
    
    private BufferedImage kreis = null;
    
    // Zähler für automatische Indexvergabe
    private volatile int bildIndex = 0;
    private volatile int hintergrundIndex = 0;
    private volatile int manfredIndex = 0;

    private RessourceLoader() {
        // Private Konstruktor für Singleton-Pattern
    }

    /**
     * Gibt die Singleton-Instanz des RessourceLoader zurück.
     * Verwendet Double-Checked Locking für optimale Performance.
     * 
     * @return Die Singleton-Instanz des RessourceLoader
     */
    public static RessourceLoader getInstance() {
        if (instance == null) {
            synchronized (RessourceLoader.class) {
                if (instance == null) {
                    instance = new RessourceLoader();
                }
            }
        }
        return instance;
    }
    
    /**
     * Fügt ein Bild zur allgemeinen Bildliste hinzu.
     * 
     * @param resourcePath Der Ressourcenpfad zum Bild
     * @return Der Index des Bildes oder -1 bei Fehlern
     */
    public int addRessource(String resourcePath) {
        if (resourcePath == null || resourcePath.trim().isEmpty()) {
            System.err.println("Ungültiger Ressourcenpfad: " + resourcePath);
            return -1;
        }
        
        // Prüfe ob das Bild ladbar ist
        if (ladeBildAusRessource(resourcePath) == null) {
            return -1;
        }
        
        int currentIndex = bildIndex++;
        bildListePaths.put(currentIndex, resourcePath);
        return currentIndex;
    }

    /**
     * Fügt ein Hintergrundbild zur Hintergrundbild-Liste hinzu.
     * 
     * @param resourcePath Der Ressourcenpfad zum Bild
     * @return Der Index des Bildes oder -1 bei Fehlern
     */
    public int addHintergrundbild(String resourcePath) {
        if (resourcePath == null || resourcePath.trim().isEmpty()) {
            System.err.println("Ungültiger Ressourcenpfad: " + resourcePath);
            return -1;
        }
        
        if (ladeBildAusRessource(resourcePath) == null) {
            return -1;
        }
        
        int currentIndex = hintergrundIndex++;
        hintergrundBildListePaths.put(currentIndex, resourcePath);
        return currentIndex;
    }

    /**
     * Fügt ein Manfred-Bild zur Manfred-Bildliste hinzu.
     * 
     * @param resourcePath Der Ressourcenpfad zum Bild
     * @return Der Index des Bildes oder -1 bei Fehlern
     */
    public int addManfredBild(String resourcePath) {
        if (resourcePath == null || resourcePath.trim().isEmpty()) {
            System.err.println("Ungültiger Ressourcenpfad: " + resourcePath);
            return -1;
        }
        
        if (ladeBildAusRessource(resourcePath) == null) {
            return -1;
        }
        
        int currentIndex = manfredIndex++;
        manfredBildListePaths.put(currentIndex, resourcePath);
        return currentIndex;
    }

    /**
     * Lädt ein Bild aus dem Cache oder von der Ressource.
     * 
     * @param resourcePath Der Ressourcenpfad
     * @return Das BufferedImage oder null bei Fehlern
     */
    private BufferedImage ladeBildAusRessource(String resourcePath) {
        // Erst im Cache prüfen
        BufferedImage cached = imageCache.get(resourcePath);
        if (cached != null) {
            return cached;
        }
        
        // Ressourcenpfad korrigieren - von absolut zu Package-relativ
        String correctedPath = resourcePath;
        if (resourcePath.startsWith("/")) {
            // Von main Package zu assets Package: entferne / und füge Package-Pfad hinzu
            correctedPath = "/de/drvbund/jauns/assets" + resourcePath;
        }
        
        // Bild von Ressource laden
        try (InputStream is = RessourceLoader.class.getResourceAsStream(correctedPath)) {
            if (is == null) {
                System.err.println("Ressource nicht gefunden: " + resourcePath + " (korrigiert zu: " + correctedPath + ")");
                return null;
            }
            
            BufferedImage image = ImageIO.read(is);
            if (image != null) {
                // Im Cache speichern für zukünftige Verwendung
                imageCache.put(resourcePath, image);
            }
            return image;
            
        } catch (IOException e) {
            System.err.println("Fehler beim Laden der Ressource " + resourcePath + ": " + e.getMessage());
            return null;
        }
    }

    // Getter-Methoden mit verbesserter Fehlerbehandlung
    public BufferedImage ladeRessource(int index) {
        String path = bildListePaths.get(index);
        if (path == null) {
            System.err.println("Kein Bild mit Index " + index + " in der Bildliste gefunden");
            return null;
        }
        return ladeBildAusRessource(path);
    }
    
    public BufferedImage ladeHintergrundbild(int index) {
        String path = hintergrundBildListePaths.get(index);
        if (path == null) {
            System.err.println("Kein Hintergrundbild mit Index " + index + " gefunden");
            return null;
        }
        return ladeBildAusRessource(path);
    }
    
    public BufferedImage ladeManfred(int index) {
        String path = manfredBildListePaths.get(index);
        if (path == null) {
            System.err.println("Kein Manfred-Bild mit Index " + index + " gefunden");
            return null;
        }
        return ladeBildAusRessource(path);
    }
    
    public BufferedImage getKreis() { 
        return kreis; 
    }
    
    public void setKreis(BufferedImage kreis) { 
        this.kreis = kreis; 
    }
    
    /**
     * Lädt ein Bild direkt über den Pfad (ohne Indexierung).
     * 
     * @param resourcePath Der Ressourcenpfad
     * @return Das BufferedImage oder null bei Fehlern
     */
    public BufferedImage ladeBild(String resourcePath) {
        return ladeBildAusRessource(resourcePath);
    }
    
    /**
     * Räumt den Cache auf und gibt Speicher frei.
     */
    public void clearCache() {
        imageCache.clear();
        System.out.println("Bildcache wurde geleert");
    }
    
    /**
     * Gibt Informationen über den aktuellen Cache-Status zurück.
     * 
     * @return String mit Cache-Statistiken
     */
    public String getCacheInfo() {
        return String.format("Cache-Status: %d Bilder geladen, %d Bildlisteneinträge, %d Hintergrundbilder, %d Manfred-Bilder",
                imageCache.size(), bildListePaths.size(), hintergrundBildListePaths.size(), manfredBildListePaths.size());
    }
}
