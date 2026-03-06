package de.drvbund.jauns.main;

import java.io.*;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

/**
 * Konfigurationsverwaltung für das Spiel.
 * 
 * Diese Klasse verwaltet alle Spieleinstellungen thread-sicher und ermöglicht
 * das Laden und Speichern von Konfigurationsdateien.
 */
public class GameConfig {
    
    private static volatile GameConfig instance;
    private final Properties properties;
    private final Map<String, Object> runtimeConfig;
    private final String configFilePath;
    
    // Standard-Konfigurationswerte
    private static final String DEFAULT_CONFIG_FILE = "game.properties";
    
    // Konfigurationsschlüssel
    public static final String WINDOW_WIDTH = "window.width";
    public static final String WINDOW_HEIGHT = "window.height";
    public static final String WINDOW_FULLSCREEN = "window.fullscreen";
    public static final String AUDIO_ENABLED = "audio.enabled";
    public static final String AUDIO_VOLUME_MASTER = "audio.volume.master";
    public static final String AUDIO_VOLUME_MUSIC = "audio.volume.music";
    public static final String AUDIO_VOLUME_EFFECTS = "audio.volume.effects";
    public static final String GRAPHICS_QUALITY = "graphics.quality";
    public static final String GRAPHICS_VSYNC = "graphics.vsync";
    public static final String GRAPHICS_FPS_LIMIT = "graphics.fps.limit";
    public static final String GAME_DIFFICULTY = "game.difficulty";
    public static final String GAME_AUTO_SAVE = "game.auto.save";
    public static final String GAME_ANIMATION_SPEED = "game.animation.speed";
    public static final String DEBUG_MODE = "debug.mode";
    public static final String DEBUG_SHOW_FPS = "debug.show.fps";
    public static final String DEBUG_PERFORMANCE_LOG = "debug.performance.log";
    
    private GameConfig(String configFile) {
        this.configFilePath = configFile;
        this.properties = new Properties();
        this.runtimeConfig = new ConcurrentHashMap<>();
        
        loadDefaults();
        loadFromFile();
    }
    
    /**
     * Singleton-Instanz mit Standard-Konfigurationsdatei.
     */
    public static GameConfig getInstance() {
        if (instance == null) {
            synchronized (GameConfig.class) {
                if (instance == null) {
                    instance = new GameConfig(DEFAULT_CONFIG_FILE);
                }
            }
        }
        return instance;
    }
    
    /**
     * Singleton-Instanz mit benutzerdefinierter Konfigurationsdatei.
     */
    public static GameConfig getInstance(String configFile) {
        if (instance == null) {
            synchronized (GameConfig.class) {
                if (instance == null) {
                    instance = new GameConfig(configFile);
                }
            }
        }
        return instance;
    }
    
    /**
     * Lädt die Standard-Konfigurationswerte.
     */
    private void loadDefaults() {
        // Fenster-Einstellungen
        properties.setProperty(WINDOW_WIDTH, "1600");
        properties.setProperty(WINDOW_HEIGHT, "900");
        properties.setProperty(WINDOW_FULLSCREEN, "false");
        
        // Audio-Einstellungen
        properties.setProperty(AUDIO_ENABLED, "true");
        properties.setProperty(AUDIO_VOLUME_MASTER, "0.8");
        properties.setProperty(AUDIO_VOLUME_MUSIC, "0.6");
        properties.setProperty(AUDIO_VOLUME_EFFECTS, "0.8");
        
        // Grafik-Einstellungen
        properties.setProperty(GRAPHICS_QUALITY, "medium"); // low, medium, high
        properties.setProperty(GRAPHICS_VSYNC, "true");
        properties.setProperty(GRAPHICS_FPS_LIMIT, "60");
        
        // Spiel-Einstellungen
        properties.setProperty(GAME_DIFFICULTY, "normal"); // easy, normal, hard
        properties.setProperty(GAME_AUTO_SAVE, "true");
        properties.setProperty(GAME_ANIMATION_SPEED, "1.0");
        
        // Debug-Einstellungen
        properties.setProperty(DEBUG_MODE, "false");
        properties.setProperty(DEBUG_SHOW_FPS, "false");
        properties.setProperty(DEBUG_PERFORMANCE_LOG, "false");
    }
    
    /**
     * Lädt die Konfiguration aus der Datei.
     */
    private void loadFromFile() {
        File configFile = new File(configFilePath);
        if (configFile.exists()) {
            try (InputStream input = new FileInputStream(configFile)) {
                properties.load(input);
                System.out.println("Konfiguration geladen: " + configFilePath);
            } catch (IOException e) {
                System.err.println("Fehler beim Laden der Konfiguration: " + e.getMessage());
            }
        } else {
            System.out.println("Konfigurationsdatei nicht gefunden, verwende Standardwerte: " + configFilePath);
            saveToFile(); // Erstelle Standard-Konfigurationsdatei
        }
    }
    
    /**
     * Speichert die aktuelle Konfiguration in die Datei.
     */
    public void saveToFile() {
        try (OutputStream output = new FileOutputStream(configFilePath)) {
            properties.store(output, "Zündung Game Configuration");
            System.out.println("Konfiguration gespeichert: " + configFilePath);
        } catch (IOException e) {
            System.err.println("Fehler beim Speichern der Konfiguration: " + e.getMessage());
        }
    }
    
    // String-Werte
    public String getString(String key) {
        return properties.getProperty(key);
    }
    
    public String getString(String key, String defaultValue) {
        return properties.getProperty(key, defaultValue);
    }
    
    public void setString(String key, String value) {
        properties.setProperty(key, value);
    }
    
    // Integer-Werte
    public int getInt(String key) {
        return getInt(key, 0);
    }
    
    public int getInt(String key, int defaultValue) {
        try {
            String value = properties.getProperty(key);
            return value != null ? Integer.parseInt(value) : defaultValue;
        } catch (NumberFormatException e) {
            System.err.println("Ungültiger Integer-Wert für " + key + ": " + properties.getProperty(key));
            return defaultValue;
        }
    }
    
    public void setInt(String key, int value) {
        properties.setProperty(key, String.valueOf(value));
    }
    
    // Boolean-Werte
    public boolean getBoolean(String key) {
        return getBoolean(key, false);
    }
    
    public boolean getBoolean(String key, boolean defaultValue) {
        String value = properties.getProperty(key);
        return value != null ? Boolean.parseBoolean(value) : defaultValue;
    }
    
    public void setBoolean(String key, boolean value) {
        properties.setProperty(key, String.valueOf(value));
    }
    
    // Double-Werte
    public double getDouble(String key) {
        return getDouble(key, 0.0);
    }
    
    public double getDouble(String key, double defaultValue) {
        try {
            String value = properties.getProperty(key);
            return value != null ? Double.parseDouble(value) : defaultValue;
        } catch (NumberFormatException e) {
            System.err.println("Ungültiger Double-Wert für " + key + ": " + properties.getProperty(key));
            return defaultValue;
        }
    }
    
    public void setDouble(String key, double value) {
        properties.setProperty(key, String.valueOf(value));
    }
    
    // Runtime-Konfiguration (wird nicht gespeichert)
    public void setRuntimeValue(String key, Object value) {
        runtimeConfig.put(key, value);
    }
    
    @SuppressWarnings("unchecked")
    public <T> T getRuntimeValue(String key, Class<T> type) {
        Object value = runtimeConfig.get(key);
        if (value != null && type.isInstance(value)) {
            return (T) value;
        }
        return null;
    }
    
    public Object getRuntimeValue(String key) {
        return runtimeConfig.get(key);
    }
    
    // Convenience-Methoden für häufig verwendete Werte
    public int getWindowWidth() {
        return getInt(WINDOW_WIDTH, 1600);
    }
    
    public int getWindowHeight() {
        return getInt(WINDOW_HEIGHT, 900);
    }
    
    public boolean isFullscreen() {
        return getBoolean(WINDOW_FULLSCREEN, false);
    }
    
    public boolean isAudioEnabled() {
        return getBoolean(AUDIO_ENABLED, true);
    }
    
    public double getMasterVolume() {
        return GameUtils.clamp(getDouble(AUDIO_VOLUME_MASTER, 0.8), 0.0, 1.0);
    }
    
    public double getMusicVolume() {
        return GameUtils.clamp(getDouble(AUDIO_VOLUME_MUSIC, 0.6), 0.0, 1.0);
    }
    
    public double getEffectsVolume() {
        return GameUtils.clamp(getDouble(AUDIO_VOLUME_EFFECTS, 0.8), 0.0, 1.0);
    }
    
    public String getGraphicsQuality() {
        return getString(GRAPHICS_QUALITY, "medium");
    }
    
    public boolean isVSyncEnabled() {
        return getBoolean(GRAPHICS_VSYNC, true);
    }
    
    public int getFPSLimit() {
        return GameUtils.clamp(getInt(GRAPHICS_FPS_LIMIT, 60), 30, 144);
    }
    
    public String getDifficulty() {
        return getString(GAME_DIFFICULTY, "normal");
    }
    
    public boolean isAutoSaveEnabled() {
        return getBoolean(GAME_AUTO_SAVE, true);
    }
    
    public double getAnimationSpeed() {
        return GameUtils.clamp(getDouble(GAME_ANIMATION_SPEED, 1.0), 0.5, 2.0);
    }
    
    public boolean isDebugMode() {
        return getBoolean(DEBUG_MODE, false);
    }
    
    public boolean shouldShowFPS() {
        return getBoolean(DEBUG_SHOW_FPS, false);
    }
    
    public boolean shouldLogPerformance() {
        return getBoolean(DEBUG_PERFORMANCE_LOG, false);
    }
    
    // Utility-Methoden
    public void resetToDefaults() {
        properties.clear();
        loadDefaults();
        System.out.println("Konfiguration auf Standardwerte zurückgesetzt");
    }
    
    public void printAllSettings() {
        System.out.println("=== Aktuelle Spielkonfiguration ===");
        for (Map.Entry<Object, Object> entry : properties.entrySet()) {
            System.out.println(entry.getKey() + " = " + entry.getValue());
        }
        System.out.println("=================================");
    }
    
    /**
     * Überprüft, ob eine Konfiguration geändert wurde.
     */
    public boolean hasUnsavedChanges() {
        // In einer realen Implementierung würde man hier verfolgen,
        // ob seit dem letzten Speichern Änderungen vorgenommen wurden
        return false; // Placeholder
    }
    
    /**
     * Validiert die aktuellen Konfigurationswerte.
     */
    public boolean validateConfiguration() {
        boolean valid = true;
        
        // Fenstergrößen validieren
        if (getWindowWidth() < 800 || getWindowHeight() < 600) {
            System.err.println("Warnung: Fensterauflösung zu klein (minimum: 800x600)");
            valid = false;
        }
        
        // Audio-Volumes validieren
        if (getMasterVolume() < 0.0 || getMasterVolume() > 1.0) {
            System.err.println("Warnung: Master-Lautstärke außerhalb des gültigen Bereichs (0.0-1.0)");
            valid = false;
        }
        
        // Grafik-Qualität validieren
        String quality = getGraphicsQuality();
        if (!quality.equals("low") && !quality.equals("medium") && !quality.equals("high")) {
            System.err.println("Warnung: Ungültige Grafik-Qualität: " + quality);
            valid = false;
        }
        
        return valid;
    }
}
