package de.drvbund.jauns.main;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;
import javax.imageio.ImageIO;

/**
 * Utility-Klasse mit häufig verwendeten Hilfsmethoden.
 * 
 * Diese Klasse stellt statische Methoden für:
 * - Bildmanipulation und -skalierung
 * - Mathematische Operationen
 * - Zufallsgenerierung
 * - Farb- und UI-Utilities
 * - Performance-Optimierungen
 */
public final class GameUtils {
    
    // Verhindert Instanziierung
    private GameUtils() {
        throw new UnsupportedOperationException("Utility-Klasse kann nicht instanziiert werden");
    }
    
    /**
     * Skaliert ein Bild auf die angegebene Größe mit optimaler Qualität.
     * 
     * @param original Das ursprüngliche Bild
     * @param width Die Zielbreite
     * @param height Die Zielhöhe
     * @return Das skalierte Bild
     */
    public static BufferedImage scaleImage(BufferedImage original, int width, int height) {
        if (original == null || width <= 0 || height <= 0) {
            return null;
        }
        
        BufferedImage scaled = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = scaled.createGraphics();
        
        // Rendering-Qualität für bessere Skalierung
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        g2d.drawImage(original, 0, 0, width, height, null);
        g2d.dispose();
        
        return scaled;
    }
    
    /**
     * Lädt ein Bild aus den Ressourcen mit Fehlerbehandlung.
     * 
     * @param resourcePath Der Pfad zur Ressource
     * @return Das geladene Bild oder null bei Fehlern
     */
    public static BufferedImage loadImageResource(String resourcePath) {
        try (InputStream is = GameUtils.class.getResourceAsStream(resourcePath)) {
            if (is == null) {
                System.err.println("Ressource nicht gefunden: " + resourcePath);
                return null;
            }
            return ImageIO.read(is);
        } catch (IOException e) {
            System.err.println("Fehler beim Laden der Ressource " + resourcePath + ": " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Erstellt ein Standard-Platzhalterbild.
     * 
     * @param width Breite des Bildes
     * @param height Höhe des Bildes
     * @param color Farbe des Bildes
     * @return Ein einfarbiges Platzhalterbild
     */
    public static BufferedImage createPlaceholderImage(int width, int height, Color color) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = image.createGraphics();
        g2d.setColor(color != null ? color : Color.GRAY);
        g2d.fillRect(0, 0, width, height);
        g2d.setColor(Color.BLACK);
        g2d.drawRect(0, 0, width - 1, height - 1);
        g2d.dispose();
        return image;
    }
    
    /**
     * Thread-sichere Zufallszahl zwischen min und max (inklusive).
     * 
     * @param min Minimum (inklusive)
     * @param max Maximum (inklusive)
     * @return Zufällige Zahl im angegebenen Bereich
     */
    public static int randomInt(int min, int max) {
        if (min > max) {
            throw new IllegalArgumentException("Min muss kleiner oder gleich Max sein");
        }
        return ThreadLocalRandom.current().nextInt(min, max + 1);
    }
    
    /**
     * Thread-sichere Zufallszahl zwischen 0.0 und 1.0.
     * 
     * @return Zufällige Dezimalzahl zwischen 0.0 und 1.0
     */
    public static double randomDouble() {
        return ThreadLocalRandom.current().nextDouble();
    }
    
    /**
     * Überprüft mit einer bestimmten Wahrscheinlichkeit.
     * 
     * @param probability Wahrscheinlichkeit zwischen 0.0 und 1.0
     * @return true wenn der Zufallswert unter der Wahrscheinlichkeit liegt
     */
    public static boolean chance(double probability) {
        return ThreadLocalRandom.current().nextDouble() < probability;
    }
    
    /**
     * Begrenzt einen Wert zwischen min und max.
     * 
     * @param value Der zu begrenzende Wert
     * @param min Minimum
     * @param max Maximum
     * @return Der begrenzte Wert
     */
    public static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
    
    /**
     * Begrenzt einen Wert zwischen min und max (double-Version).
     * 
     * @param value Der zu begrenzende Wert
     * @param min Minimum
     * @param max Maximum
     * @return Der begrenzte Wert
     */
    public static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
    
    /**
     * Lineares Interpolieren zwischen zwei Werten.
     * 
     * @param start Startwert
     * @param end Endwert
     * @param t Interpolationsfaktor (0.0 = start, 1.0 = end)
     * @return Interpolierter Wert
     */
    public static double lerp(double start, double end, double t) {
        return start + t * (end - start);
    }
    
    /**
     * Berechnet die Distanz zwischen zwei Punkten.
     * 
     * @param p1 Erster Punkt
     * @param p2 Zweiter Punkt
     * @return Die Distanz
     */
    public static double distance(Point p1, Point p2) {
        if (p1 == null || p2 == null) {
            return 0.0;
        }
        double dx = p1.x - p2.x;
        double dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Erstellt eine Farbe mit Alpha-Transparenz.
     * 
     * @param color Die Basis-Farbe
     * @param alpha Alpha-Wert (0-255)
     * @return Farbe mit Transparenz
     */
    public static Color withAlpha(Color color, int alpha) {
        if (color == null) {
            return null;
        }
        return new Color(color.getRed(), color.getGreen(), color.getBlue(), clamp(alpha, 0, 255));
    }
    
    /**
     * Verdunkelt eine Farbe um einen bestimmten Faktor.
     * 
     * @param color Die ursprüngliche Farbe
     * @param factor Verdunkelungsfaktor (0.0 = schwarz, 1.0 = unverändert)
     * @return Die verdunkelte Farbe
     */
    public static Color darken(Color color, double factor) {
        if (color == null) {
            return null;
        }
        factor = clamp(factor, 0.0, 1.0);
        return new Color(
            (int) (color.getRed() * factor),
            (int) (color.getGreen() * factor),
            (int) (color.getBlue() * factor),
            color.getAlpha()
        );
    }
    
    /**
     * Aufhellen einer Farbe um einen bestimmten Faktor.
     * 
     * @param color Die ursprüngliche Farbe
     * @param factor Aufhellungsfaktor (0.0 = unverändert, 1.0 = weiß)
     * @return Die aufgehellte Farbe
     */
    public static Color lighten(Color color, double factor) {
        if (color == null) {
            return null;
        }
        factor = clamp(factor, 0.0, 1.0);
        return new Color(
            (int) (color.getRed() + (255 - color.getRed()) * factor),
            (int) (color.getGreen() + (255 - color.getGreen()) * factor),
            (int) (color.getBlue() + (255 - color.getBlue()) * factor),
            color.getAlpha()
        );
    }
    
    /**
     * Formatiert eine Zeit in Millisekunden zu einem lesbaren String.
     * 
     * @param millis Zeit in Millisekunden
     * @return Formatierte Zeit (z.B. "2:30" für 2 Minuten 30 Sekunden)
     */
    public static String formatTime(long millis) {
        long seconds = millis / 1000;
        long minutes = seconds / 60;
        seconds = seconds % 60;
        
        if (minutes > 0) {
            return String.format("%d:%02d", minutes, seconds);
        } else {
            return String.format("%d", seconds);
        }
    }
    
    /**
     * Formatiert eine große Zahl mit Suffixen (K, M, B).
     * 
     * @param number Die zu formatierende Zahl
     * @return Formatierte Zahl (z.B. "1.2K" für 1200)
     */
    public static String formatNumber(long number) {
        if (number < 1000) {
            return String.valueOf(number);
        } else if (number < 1_000_000) {
            return String.format("%.1fK", number / 1000.0);
        } else if (number < 1_000_000_000) {
            return String.format("%.1fM", number / 1_000_000.0);
        } else {
            return String.format("%.1fB", number / 1_000_000_000.0);
        }
    }
    
    /**
     * Überprüft, ob ein Rechteck einen Punkt enthält.
     * Null-sichere Version von Rectangle.contains().
     * 
     * @param rect Das Rechteck
     * @param point Der Punkt
     * @return true wenn der Punkt im Rechteck liegt
     */
    public static boolean contains(Rectangle rect, Point point) {
        return rect != null && point != null && rect.contains(point);
    }
    
    /**
     * Erstellt ein abgerundetes Rechteck als Graphics2D-Path.
     * 
     * @param x X-Koordinate
     * @param y Y-Koordinate
     * @param width Breite
     * @param height Höhe
     * @param cornerRadius Radius der Ecken
     * @return Graphics2D zum Zeichnen des abgerundeten Rechtecks
     */
    public static void drawRoundedRect(Graphics2D g2d, int x, int y, int width, int height, int cornerRadius) {
        g2d.fillRoundRect(x, y, width, height, cornerRadius, cornerRadius);
    }
    
    /**
     * Berechnet die optimale Textgröße für einen gegebenen Bereich.
     * 
     * @param g2d Graphics-Kontext
     * @param text Der zu zeichnende Text
     * @param maxWidth Maximale Breite
     * @param maxHeight Maximale Höhe
     * @param baseFont Basis-Schriftart
     * @return Optimierte Schriftart
     */
    public static Font getOptimalFont(Graphics2D g2d, String text, int maxWidth, int maxHeight, Font baseFont) {
        if (g2d == null || text == null || baseFont == null) {
            return baseFont;
        }
        
        Font testFont = baseFont;
        FontMetrics metrics = g2d.getFontMetrics(testFont);
        
        // Verkleinern bis Text passt
        while ((metrics.stringWidth(text) > maxWidth || metrics.getHeight() > maxHeight) && testFont.getSize() > 8) {
            testFont = testFont.deriveFont((float) (testFont.getSize() - 1));
            metrics = g2d.getFontMetrics(testFont);
        }
        
        return testFont;
    }
    
    /**
     * Misst die Performance eines Code-Blocks.
     * 
     * @param runnable Der auszuführende Code
     * @param description Beschreibung für das Logging
     * @return Die Ausführungszeit in Millisekunden
     */
    public static long measurePerformance(Runnable runnable, String description) {
        long startTime = System.currentTimeMillis();
        runnable.run();
        long endTime = System.currentTimeMillis();
        long duration = endTime - startTime;
        
        if (description != null) {
            System.out.printf("Performance [%s]: %d ms%n", description, duration);
        }
        
        return duration;
    }
}
