package de.drvbund.jauns.main;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.Marshaller;
import jakarta.xml.bind.Unmarshaller;
import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlRootElement;
import jakarta.xml.bind.annotation.XmlTransient;

/**
 * Optimiertes GameState-Management mit Observer-Pattern und besserer Kapselung.
 * 
 * Diese Klasse verwaltet den gesamten Spielzustand thread-sicher und benachrichtigt
 * Listener über Änderungen für bessere UI-Updates.
 */
@XmlRootElement
@XmlAccessorType(XmlAccessType.FIELD)
public class GameState {

    // Spielzustand
    private volatile int score;
    private volatile int money;
    private Spieler spieler;
    private Spieler gegner;
    private volatile int level;
    private ArrayList<String> unlocks = new ArrayList<>();
    private Karte lastCard;
    private ArrayList<Karte> spielStapel = new ArrayList<>();
    private volatile boolean spielerZug = true;
    
    // Neue Features für besseres Gameplay
    private volatile int lives = 3;
    private volatile int streak = 0;
    private volatile long gameStartTime = System.currentTimeMillis();
    private volatile boolean paused = false;
    
    // Nicht serialisierte Felder (Observer Pattern)
    @XmlTransient
    private final List<Consumer<GameState>> stateChangeListeners = new CopyOnWriteArrayList<>();
    
    @XmlTransient
    private static volatile GameState instance;
    
    @XmlTransient
    private final Object lock = new Object(); // Für Thread-Sicherheit

    /**
     * Thread-sichere Singleton-Implementierung.
     */
    public static GameState getInstance() {
        if (instance == null) {
            synchronized (GameState.class) {
                if (instance == null) {
                    instance = new GameState();
                }
            }
        }
        return instance;
    }
    
    // Konstruktoren
    public GameState() {
        this.gameStartTime = System.currentTimeMillis();
    }
    
    public GameState(int score, int money, Spieler spieler, Spieler gegner, int level, 
                    ArrayList<String> unlocks, Karte lastCard) {
        this();
        this.score = score;
        this.money = money;
        this.spieler = spieler;
        this.gegner = gegner;
        this.level = level;
        this.unlocks = new ArrayList<>(unlocks);
        this.lastCard = lastCard;
    }

    // Observer Pattern für State Changes
    public void addStateChangeListener(Consumer<GameState> listener) {
        stateChangeListeners.add(listener);
    }
    
    public void removeStateChangeListener(Consumer<GameState> listener) {
        stateChangeListeners.remove(listener);
    }
    
    private void notifyStateChange() {
        for (Consumer<GameState> listener : stateChangeListeners) {
            try {
                listener.accept(this);
            } catch (Exception e) {
                System.err.println("Fehler beim Benachrichtigen des State-Listeners: " + e.getMessage());
            }
        }
    }

    // Thread-sichere Getter
    public int getScore() {
        return score;
    }
    
    public int getMoney() {
        return money;
    }
    
    public synchronized Spieler getSpieler() {
        return spieler;
    }
    
    public synchronized Spieler getGegner() {
        return gegner;
    }
    
    public int getLevel() {
        return level;
    }
    
    public synchronized List<String> getUnlocks() {
        return new ArrayList<>(unlocks);
    }
    
    public synchronized Karte getLastCard() {
        return lastCard;
    }
    
    public synchronized List<Karte> getSpielStapel() {
        return new ArrayList<>(spielStapel);
    }
    
    public boolean isSpielerZug() {
        return spielerZug;
    }
    
    public int getLives() {
        return lives;
    }
    
    public int getStreak() {
        return streak;
    }
    
    public long getGameStartTime() {
        return gameStartTime;
    }
    
    public boolean isPaused() {
        return paused;
    }
    
    public long getPlayTime() {
        return System.currentTimeMillis() - gameStartTime;
    }

    // Thread-sichere Setter mit Benachrichtigung
    public void setScore(int score) {
        synchronized (lock) {
            int oldScore = this.score;
            this.score = score;
            if (oldScore != score) {
                notifyStateChange();
            }
        }
    }
    
    public void addScore(int points) {
        synchronized (lock) {
            this.score += points;
            if (points > 0) {
                this.streak++;
            } else {
                this.streak = 0;
            }
            notifyStateChange();
        }
    }
    
    public void setMoney(int money) {
        synchronized (lock) {
            int oldMoney = this.money;
            this.money = Math.max(0, money); // Geld kann nicht negativ werden
            if (oldMoney != this.money) {
                notifyStateChange();
            }
        }
    }
    
    public boolean spendMoney(int amount) {
        synchronized (lock) {
            if (this.money >= amount) {
                this.money -= amount;
                notifyStateChange();
                return true;
            }
            return false;
        }
    }
    
    public void addMoney(int amount) {
        synchronized (lock) {
            this.money += Math.max(0, amount);
            notifyStateChange();
        }
    }
    
    public synchronized void setSpieler(Spieler spieler) {
        this.spieler = spieler;
        notifyStateChange();
    }
    
    public synchronized void setGegner(Spieler gegner) {
        this.gegner = gegner;
        notifyStateChange();
    }
    
    public void setLevel(int level) {
        synchronized (lock) {
            int oldLevel = this.level;
            this.level = level;
            if (oldLevel != level) {
                notifyStateChange();
            }
        }
    }
    
    public synchronized void setUnlocks(ArrayList<String> unlocks) {
        this.unlocks = new ArrayList<>(unlocks);
        notifyStateChange();
    }
    
    public synchronized void addUnlock(String unlock) {
        if (!this.unlocks.contains(unlock)) {
            this.unlocks.add(unlock);
            notifyStateChange();
        }
    }
    
    public synchronized void setLastCard(Karte lastCard) {
        this.lastCard = lastCard;
        notifyStateChange();
    }
    
    public synchronized void setSpielStapel(ArrayList<Karte> spielStapel) {
        this.spielStapel = new ArrayList<>(spielStapel);
        notifyStateChange();
    }
    
    public synchronized void addToSpielStapel(Karte karte) {
        this.spielStapel.add(karte);
        notifyStateChange();
    }
    
    public void setSpielerZug(boolean spielerZug) {
        synchronized (lock) {
            boolean oldZug = this.spielerZug;
            this.spielerZug = spielerZug;
            if (oldZug != spielerZug) {
                System.out.println("GameState: Spieler ist dran: " + spielerZug);
                notifyStateChange();
            }
        }
    }
    
    public void toggleSpielerZug() {
        setSpielerZug(!this.spielerZug);
    }
    
    public void setLives(int lives) {
        synchronized (lock) {
            int oldLives = this.lives;
            this.lives = Math.max(0, lives);
            if (oldLives != this.lives) {
                notifyStateChange();
            }
        }
    }
    
    public boolean loseLife() {
        synchronized (lock) {
            if (this.lives > 0) {
                this.lives--;
                this.streak = 0; // Streak zurücksetzen bei Leben verloren
                notifyStateChange();
                return this.lives > 0; // true wenn noch Leben übrig
            }
            return false;
        }
    }
    
    public void setPaused(boolean paused) {
        synchronized (lock) {
            boolean oldPaused = this.paused;
            this.paused = paused;
            if (oldPaused != paused) {
                notifyStateChange();
            }
        }
    }
    
    /**
     * Setzt den GameState für ein neues Spiel zurück.
     */
    public synchronized void resetForNewGame() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.streak = 0;
        this.spielerZug = true;
        this.paused = false;
        this.gameStartTime = System.currentTimeMillis();
        this.lastCard = null;
        this.spielStapel.clear();
        // Geld und Unlocks bleiben erhalten
        notifyStateChange();
    }

    // Speichern/Laden mit verbesserter Fehlerbehandlung
    public void saveToXml(String filename) {
        synchronized (lock) {
            try {
                File file = new File(filename);
                File parentDir = file.getParentFile();
                if (parentDir != null && !parentDir.exists()) {
                    parentDir.mkdirs();
                }
                
                JAXBContext context = JAXBContext.newInstance(GameState.class);
                Marshaller marshaller = context.createMarshaller();
                marshaller.setProperty(Marshaller.JAXB_FORMATTED_OUTPUT, true);
                marshaller.marshal(this, file);
                
                System.out.println("Spielstand erfolgreich gespeichert: " + filename);
            } catch (Exception e) {
                System.err.println("Fehler beim Speichern des Spielstands: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    public static GameState loadFromXml(String filename) {
        try {
            File file = new File(filename);
            if (!file.exists()) {
                System.err.println("Spielstand-Datei nicht gefunden: " + filename);
                return null;
            }
            
            JAXBContext context = JAXBContext.newInstance(GameState.class);
            Unmarshaller unmarshaller = context.createUnmarshaller();
            GameState loadedState = (GameState) unmarshaller.unmarshal(file);
            
            // Singleton-Instanz aktualisieren
            instance = loadedState;
            
            System.out.println("Spielstand erfolgreich geladen: " + filename);
            return instance;
        } catch (Exception e) {
            System.err.println("Fehler beim Laden des Spielstands: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Erstellt eine Kopie des aktuellen GameStates für Backup-Zwecke.
     */
    public synchronized GameState createBackup() {
        GameState backup = new GameState();
        backup.score = this.score;
        backup.money = this.money;
        backup.level = this.level;
        backup.lives = this.lives;
        backup.streak = this.streak;
        backup.spielerZug = this.spielerZug;
        backup.paused = this.paused;
        backup.gameStartTime = this.gameStartTime;
        backup.unlocks = new ArrayList<>(this.unlocks);
        backup.spielStapel = new ArrayList<>(this.spielStapel);
        // Spieler und Gegner müssten auch geklont werden, wenn nötig
        return backup;
    }
    
    @Override
    public synchronized String toString() {
        return String.format("GameState{score=%d, money=%d, level=%d, lives=%d, streak=%d, spielerZug=%b}", 
                           score, money, level, lives, streak, spielerZug);
    }
}
