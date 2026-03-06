package de.drvbund.jauns.main;

import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Optimierter Renderer für bessere Performance.
 * 
 * Reduziert die Anzahl der Repaints durch intelligente Dirty-Region-Tracking
 * und verwendet Double-Buffering für flüssige Animationen.
 */
public class PerformanceOptimizedRenderer {
    
    private final JComponent component;
    private final Timer animationTimer;
    private final AtomicBoolean needsRepaint = new AtomicBoolean(false);
    private final AtomicBoolean animationActive = new AtomicBoolean(false);
    
    // Double-Buffering
    private BufferedImage backBuffer;
    private Graphics2D backGraphics;
    private Dimension lastSize;
    
    // Performance-Tracking
    private long lastFrameTime = 0;
    private int frameCount = 0;
    private double averageFPS = 0;
    
    // Dirty Regions für optimierte Repaints
    private final Rectangle dirtyRegion = new Rectangle();
    private boolean fullRepaintNeeded = true;
    
    public PerformanceOptimizedRenderer(JComponent component) {
        this.component = component;
        
        // Reduzierte Timer-Frequenz: nur bei aktiven Animationen
        this.animationTimer = new Timer(33, e -> { // ~30 FPS statt 60+ FPS
            if (animationActive.get() || needsRepaint.getAndSet(false)) {
                updateFrame();
            }
        });
        
        // Timer startet nicht automatisch - nur bei Bedarf
        setupPerformanceMonitoring();
    }
    
    /**
     * Startet den Renderer nur wenn Animationen aktiv sind.
     */
    public void startIfNeeded() {
        if (!animationTimer.isRunning() && (animationActive.get() || needsRepaint.get())) {
            animationTimer.start();
        }
    }
    
    /**
     * Stoppt den Renderer wenn keine Animationen laufen.
     */
    public void stopIfNotNeeded() {
        if (animationTimer.isRunning() && !animationActive.get() && !needsRepaint.get()) {
            animationTimer.stop();
        }
    }
    
    /**
     * Markiert eine Region als "dirty" für optimierte Repaints.
     */
    public void markDirty(Rectangle region) {
        if (fullRepaintNeeded) {
            return; // Bereits vollständiger Repaint geplant
        }
        
        if (dirtyRegion.isEmpty()) {
            dirtyRegion.setBounds(region);
        } else {
            dirtyRegion.union(region);
        }
        
        needsRepaint.set(true);
        startIfNeeded();
    }
    
    /**
     * Markiert das gesamte Component für Repaint.
     */
    public void markFullRepaint() {
        fullRepaintNeeded = true;
        needsRepaint.set(true);
        startIfNeeded();
    }
    
    /**
     * Setzt den Animation-Status.
     */
    public void setAnimationActive(boolean active) {
        animationActive.set(active);
        if (active) {
            startIfNeeded();
        } else {
            // Kleiner Delay bevor gestoppt wird, falls neue Animation startet
            Timer stopDelay = new Timer(100, e -> {
                stopIfNotNeeded();
                ((Timer) e.getSource()).stop();
            });
            stopDelay.setRepeats(false);
            stopDelay.start();
        }
    }
    
    /**
     * Führt das Frame-Update durch.
     */
    private void updateFrame() {
        long currentTime = System.currentTimeMillis();
        
        // FPS-Tracking
        if (lastFrameTime > 0) {
            long deltaTime = currentTime - lastFrameTime;
            frameCount++;
            if (frameCount % 30 == 0) { // Alle 30 Frames FPS berechnen
                averageFPS = 1000.0 / deltaTime;
            }
        }
        lastFrameTime = currentTime;
        
        // Nur repainten wenn nötig
        if (needsRepaint.get() || animationActive.get()) {
            if (fullRepaintNeeded) {
                component.repaint();
                fullRepaintNeeded = false;
                dirtyRegion.setBounds(0, 0, 0, 0);
            } else if (!dirtyRegion.isEmpty()) {
                component.repaint(dirtyRegion);
                dirtyRegion.setBounds(0, 0, 0, 0);
            }
            needsRepaint.set(false);
        }
        
        // Auto-Stop bei Inaktivität
        stopIfNotNeeded();
    }
    
    /**
     * Erstellt oder aktualisiert den Back-Buffer für Double-Buffering.
     */
    public Graphics2D getBackBuffer() {
        Dimension currentSize = component.getSize();
        
        if (backBuffer == null || !currentSize.equals(lastSize)) {
            if (backGraphics != null) {
                backGraphics.dispose();
            }
            
            if (currentSize.width > 0 && currentSize.height > 0) {
                backBuffer = new BufferedImage(currentSize.width, currentSize.height, BufferedImage.TYPE_INT_RGB);
                backGraphics = backBuffer.createGraphics();
                
                // Rendering-Qualität optimieren
                backGraphics.setRenderingHint(RenderingHints.KEY_ALPHA_INTERPOLATION, RenderingHints.VALUE_ALPHA_INTERPOLATION_SPEED);
                backGraphics.setRenderingHint(RenderingHints.KEY_COLOR_RENDERING, RenderingHints.VALUE_COLOR_RENDER_SPEED);
                backGraphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_SPEED);
                
                lastSize = new Dimension(currentSize);
                markFullRepaint();
            }
        }
        
        return backGraphics;
    }
    
    /**
     * Kopiert den Back-Buffer auf das Component.
     */
    public void presentBackBuffer(Graphics2D g) {
        if (backBuffer != null) {
            g.drawImage(backBuffer, 0, 0, null);
        }
    }
    
    /**
     * Performance-Monitoring Setup.
     */
    private void setupPerformanceMonitoring() {
        // Alle 5 Sekunden Performance-Info ausgeben (nur in Debug-Modus)
        Timer performanceTimer = new Timer(5000, e -> {
            if (frameCount > 0) {
                System.out.printf("Performance: %.1f FPS, Timer aktiv: %b, Animationen: %b%n", 
                    averageFPS, animationTimer.isRunning(), animationActive.get());
            }
        });
        performanceTimer.start();
    }
    
    /**
     * Cleanup-Methode für Ressourcen.
     */
    public void dispose() {
        animationTimer.stop();
        if (backGraphics != null) {
            backGraphics.dispose();
        }
        backBuffer = null;
    }
    
    // Getter für Debugging
    public boolean isTimerRunning() { return animationTimer.isRunning(); }
    public boolean isAnimationActive() { return animationActive.get(); }
    public double getAverageFPS() { return averageFPS; }
}
